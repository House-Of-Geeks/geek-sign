import { NextResponse } from "next/server";
import {
  AssistantCreateDocumentSchema,
  MAX_PDF_BYTES,
  checkRemoteFileUrl,
  cleanQuery,
  decodePdfBase64,
  isPdfBytes,
  parseDocumentStatus,
  parsePage,
  presentDocument,
  slugify,
} from "@/lib/assistant";
import {
  HttpError,
  assistantErrorResponse,
  readJsonBody,
  requireAssistant,
} from "@/lib/assistantAccess";
import { APP_URL } from "@/lib/app-url";
import { createPdfDocument, listAccessibleDocuments } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, teamIds } = await requireAssistant(request);
    const { searchParams } = new URL(request.url);
    const parsedStatus = parseDocumentStatus(searchParams.get("status"));
    if (parsedStatus.error) throw new HttpError(400, parsedStatus.error);
    const q = cleanQuery(searchParams.get("q"));
    const { limit, offset } = parsePage(searchParams.get("limit"), searchParams.get("offset"));

    const { documents, total } = await listAccessibleDocuments({
      userId: user.id,
      teamIds,
      status: parsedStatus.status,
      q: q || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      documents: documents.map(({ recipientSummary, ...doc }) => ({
        ...presentDocument(doc, APP_URL),
        recipientSummary,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}

/** Download a PDF from a public https URL. Redirects are refused so the host check cannot be bypassed. */
async function fetchRemotePdf(rawUrl: string): Promise<Uint8Array> {
  const checked = checkRemoteFileUrl(rawUrl);
  if ("error" in checked) throw new HttpError(400, checked.error);

  let response: Response;
  try {
    response = await fetch(checked.url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new HttpError(400, "Could not download fileUrl (it must respond within 15 seconds without redirecting).");
  }
  if (!response.ok) throw new HttpError(400, `fileUrl responded with status ${response.status}.`);

  const tooBig = new HttpError(400, "The PDF is larger than 20 MB.");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) throw tooBig;

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_PDF_BYTES) throw tooBig;
  if (!isPdfBytes(bytes)) throw new HttpError(400, "Only PDF files are allowed.");
  return bytes;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAssistant(request);
    const body = AssistantCreateDocumentSchema.parse(await readJsonBody(request));

    let bytes: Uint8Array;
    if (body.fileBase64) {
      const decoded = decodePdfBase64(body.fileBase64);
      if (typeof decoded === "string") throw new HttpError(400, decoded);
      bytes = decoded;
    } else {
      bytes = await fetchRemotePdf(body.fileUrl as string);
    }

    const document = await createPdfDocument({
      userId: user.id,
      title: body.title,
      fileName: body.fileName ?? `${slugify(body.title)}.pdf`,
      data: bytes,
      size: bytes.length,
    });

    return NextResponse.json({ document: presentDocument(document, APP_URL) }, { status: 201 });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
