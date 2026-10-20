import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { collectSigningFields } from "./richtext/content-walk";

/**
 * Door for an external assistant. Bearer token only: a session cookie is not
 * consulted, and this key does not unlock any other route.
 *
 * `ASSISTANT_API_KEY` unset (or blank) is "unconfigured": callers get 503 and
 * nothing is accepted. A present key is compared in constant time.
 *
 * Everything here is pure (no db imports) so it can be unit tested directly.
 */

export const ASSISTANT_KEY_MISSING = "Set ASSISTANT_API_KEY to let an assistant reach GeekSign.";
export const ASSISTANT_USER_MISSING =
  "Set ASSISTANT_USER_ID or ASSISTANT_USER_EMAIL to choose the account the assistant acts as.";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Blank env values count as unset, including a trailing newline from a dashboard paste. */
export function readAssistantKey(raw: string | undefined): string | undefined {
  const key = raw?.trim();
  return key ? key : undefined;
}

/** Constant-time check of an `Authorization: Bearer <token>` header against a shared secret. */
export function bearerMatches(authorization: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assistantAuthStatus(
  authorization: string | null | undefined,
  secret: string | undefined,
): "ok" | "unconfigured" | "unauthorized" {
  if (!secret) return "unconfigured";
  return bearerMatches(authorization, secret) ? "ok" : "unauthorized";
}

export type AssistantUserRef = { id: string } | { email: string };

/** Which account the assistant acts as. The id wins when both are set. */
export function readAssistantUserRef(env: {
  ASSISTANT_USER_ID?: string;
  ASSISTANT_USER_EMAIL?: string;
}): AssistantUserRef | undefined {
  const id = env.ASSISTANT_USER_ID?.trim();
  if (id) return { id };
  const email = env.ASSISTANT_USER_EMAIL?.trim().toLowerCase();
  if (email) return { email };
  return undefined;
}

export function cleanQuery(raw: string | null): string {
  return (raw ?? "").trim().slice(0, 200);
}

export function parsePage(
  limitRaw: string | null,
  offsetRaw: string | null,
  defaults: { limit?: number; max?: number } = {},
): { limit: number; offset: number } {
  const max = defaults.max ?? 100;
  const fallback = defaults.limit ?? 25;
  const limitNum = Number(limitRaw);
  const limit = Number.isFinite(limitNum) && limitNum >= 1 ? Math.min(Math.floor(limitNum), max) : fallback;
  const offsetNum = Number(offsetRaw);
  const offset = Number.isFinite(offsetNum) && offsetNum >= 0 ? Math.min(Math.floor(offsetNum), 10_000) : 0;
  return { limit, offset };
}

export const DOCUMENT_STATUSES = ["draft", "pending", "completed", "voided"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Unknown statuses are an error (the assistant should hear about a typo). Case doesn't matter. */
export function parseDocumentStatus(raw: string | null): { status?: DocumentStatus; error?: string } {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return {};
  if (!(DOCUMENT_STATUSES as readonly string[]).includes(s)) {
    return { error: `Status must be one of: ${DOCUMENT_STATUSES.join(", ")}.` };
  }
  return { status: s as DocumentStatus };
}

/** File-name friendly version of a title. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "document";
}

export const AssistantRecipientSchema = z.object({
  email: z.string().trim().email("That email address isn't valid.").max(320),
  name: z.string().trim().max(200).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

/** Partial recipient edit. Unknown keys (such as `status`) are dropped. An empty or null name clears it. */
export const AssistantUpdateRecipientSchema = z
  .object({
    email: z.string().trim().email("That email address isn't valid.").max(320).optional(),
    name: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional()
      .transform((name) => (name === undefined ? undefined : name || null)),
    orderIndex: z.number().int().min(0).optional(),
  })
  .refine((v) => v.email !== undefined || v.name !== undefined || v.orderIndex !== undefined, {
    message: "Send at least one of name, email or orderIndex.",
  });

export const AssistantFieldSchema = z.object({
  type: z.enum(["signature", "initials", "date", "text", "checkbox"]),
  page: z.number().int().min(1).default(1),
  xPosition: z.number().min(0),
  yPosition: z.number().min(0),
  width: z.number().gt(0).default(200),
  height: z.number().gt(0).default(60),
  required: z.boolean().default(true),
});

export const AssistantRecipientWithFieldsSchema = AssistantRecipientSchema.extend({
  fields: z.array(AssistantFieldSchema).max(50).optional(),
});

/** A lone recipient object is treated as a batch of one, so the schema below can report precise errors. */
export function wrapRecipients(raw: unknown): unknown {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "recipients" in raw) return raw;
  return { recipients: [raw] };
}

export const AssistantAddRecipientsSchema = z.preprocess(
  wrapRecipients,
  z.object({ recipients: z.array(AssistantRecipientWithFieldsSchema).min(1).max(50) }),
);

export type AssistantRecipientInput = z.infer<typeof AssistantRecipientWithFieldsSchema>;

/** Either body shape, as a plain array of recipients. */
export function normaliseRecipients(raw: unknown): AssistantRecipientInput[] {
  return AssistantAddRecipientsSchema.parse(raw).recipients;
}

export const AssistantCreateDocumentSchema = z
  .object({
    title: z.string().trim().min(1, "Give the document a title.").max(300),
    fileName: z.string().trim().min(1).max(200).optional(),
    fileBase64: z.string().min(1).optional(),
    fileUrl: z.string().trim().url("fileUrl must be a valid URL.").optional(),
  })
  .refine((v) => Boolean(v.fileBase64) !== Boolean(v.fileUrl), {
    message: "Send exactly one of fileBase64 or fileUrl.",
    path: ["fileBase64"],
  });

const TemplateRecipientSchema = z.union([
  z.string().trim().email("That email address isn't valid.").max(320),
  z.object({
    email: z.string().trim().email("That email address isn't valid.").max(320),
    name: z.string().trim().max(200).optional(),
  }),
]);

export const AssistantUseTemplateSchema = z.object({
  title: z.string().trim().min(1, "Give the document a title.").max(300),
  recipients: z.array(TemplateRecipientSchema).min(1).max(50),
  customMessage: z.string().max(5_000).optional(),
  senderDisplayName: z.string().trim().max(200).optional(),
  variables: z.record(z.string()).optional(),
  senderFieldValues: z.record(z.string()).optional(),
});

/** The shape createDocumentFromTemplate expects for `recipientEmails`. */
export function toRecipientEmails(
  recipients: Array<string | { email: string; name?: string }>,
): Array<string | { email: string; name?: string }> {
  return recipients.map((r) => (typeof r === "string" ? r : r.name ? { email: r.email, name: r.name } : r.email));
}

export const AssistantSendSchema = z.object({
  senderName: z.string().trim().max(200).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderIntervalDays: z.number().int().min(1).max(30).optional(),
  reminderRepeatDays: z.number().int().min(1).max(30).optional(),
});

export function isPdfBytes(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  return bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b);
}

/** Accepts raw base64 or a `data:application/pdf;base64,` URL. Returns the bytes, or an error message. */
export function decodePdfBase64(input: string): Uint8Array | string {
  const stripped = input.trim().replace(/^data:application\/pdf;base64,/i, "");
  const b64 = stripped.replace(/\s+/g, "");
  if (!b64) return "fileBase64 is empty.";
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(b64)) return "fileBase64 is not valid base64.";
  if (Math.floor((b64.length * 3) / 4) > MAX_PDF_BYTES) return "The PDF is larger than 20 MB.";
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  if (bytes.length > MAX_PDF_BYTES) return "The PDF is larger than 20 MB.";
  if (!isPdfBytes(bytes)) return "Only PDF files are allowed.";
  return bytes;
}

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(host: string): boolean {
  const first = host.split(":")[0];
  const head = first ? parseInt(first, 16) : 0;
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("::ffff:")) return true; // IPv4-mapped, could hide a private v4
  if (Number.isNaN(head)) return false;
  return (head & 0xfe00) === 0xfc00 || (head & 0xffc0) === 0xfe80;
}

/** Only public https URLs. Names and addresses that point inside a network are refused. */
export function checkRemoteFileUrl(raw: string): { url: string } | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { error: "fileUrl must be a valid URL." };
  }
  if (parsed.protocol !== "https:") return { error: "fileUrl must use https." };
  if (parsed.username || parsed.password) return { error: "fileUrl must not contain credentials." };
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const blocked = "fileUrl must point to a public host.";
  if (!host) return { error: blocked };
  if (host.startsWith("[")) {
    return isPrivateIpv6(host.slice(1, -1)) ? { error: blocked } : { url: parsed.toString() };
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    isPrivateIpv4(host)
  ) {
    return { error: blocked };
  }
  return { url: parsed.toString() };
}

type RecipientLike = {
  id: string;
  email: string;
  name: string | null;
  orderIndex: number;
  status: string;
  viewedAt: Date | null;
  signedAt: Date | null;
  consentGiven: boolean | null;
  consentTimestamp: Date | null;
  createdAt: Date;
};

/** External shape of a recipient. Never the signing token, IP address or user agent. */
export function presentRecipient(recipient: RecipientLike) {
  return {
    id: recipient.id,
    email: recipient.email,
    name: recipient.name,
    orderIndex: recipient.orderIndex,
    status: recipient.status,
    viewedAt: recipient.viewedAt,
    signedAt: recipient.signedAt,
    consentGiven: recipient.consentGiven,
    consentTimestamp: recipient.consentTimestamp,
    createdAt: recipient.createdAt,
  };
}

type DocumentLike = {
  id: string;
  title: string;
  status: string;
  contentType: string;
  fileName: string | null;
  fileSize: number | null;
  pageCount: number | null;
  customMessage: string | null;
  senderDisplayName: string | null;
  reminderEnabled: boolean;
  nextReminderAt: Date | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** External shape of a document: no content blobs, and no public file URL of the unsigned PDF. */
export function presentDocument(doc: DocumentLike, appUrl: string) {
  return {
    id: doc.id,
    title: doc.title,
    status: doc.status,
    contentType: doc.contentType,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    pageCount: doc.pageCount,
    customMessage: doc.customMessage,
    senderDisplayName: doc.senderDisplayName,
    reminderEnabled: doc.reminderEnabled,
    nextReminderAt: doc.nextReminderAt,
    expiresAt: doc.expiresAt,
    completedAt: doc.completedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    url: `${appUrl}/dashboard/documents/${doc.id}`,
  };
}

export function signingLink(appUrl: string, token: string): string {
  return `${appUrl}/sign/${token}`;
}

type TemplateLike = {
  id: string;
  name: string;
  description: string | null;
  contentType: string;
  fields: unknown;
  content: unknown;
  recipientSlots: unknown;
  recipientRoles: unknown;
  variableSchema: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type PdfTemplateField = { id?: unknown; label?: unknown; recipientIndex?: unknown };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * External shape of a template: what the assistant needs to fill it in
 * (signer slots, variables, sender-fill fields) and nothing else. No file URL, no content blob.
 */
export function presentTemplate(template: TemplateLike) {
  const base = {
    id: template.id,
    name: template.name,
    description: template.description,
    contentType: template.contentType,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };

  if (template.contentType === "richtext") {
    const roles = asArray<{ id?: unknown; label?: unknown }>(template.recipientRoles);
    const variables = asArray<{ key?: unknown; label?: unknown; type?: unknown; defaultValue?: unknown }>(
      template.variableSchema,
    );
    return {
      ...base,
      recipientCount: roles.length,
      recipientRoles: roles.map((r) => ({ id: r.id, label: r.label })),
      fieldCount: collectSigningFields(template.content).length,
      variables: variables.map((v) => ({
        key: v.key,
        label: v.label,
        type: v.type,
        defaultValue: v.defaultValue ?? null,
      })),
      senderFields: [] as Array<{ id: unknown; label: unknown }>,
    };
  }

  const fields = asArray<PdfTemplateField>(template.fields);
  const slots = asArray<unknown>(template.recipientSlots);
  const regular = fields.filter((f) => typeof f.recipientIndex !== "number" || f.recipientIndex >= 0);
  const maxIndex = regular.reduce(
    (max, f) => Math.max(max, typeof f.recipientIndex === "number" ? f.recipientIndex : 0),
    0,
  );
  return {
    ...base,
    recipientCount: Math.max(1, slots.length, regular.length > 0 ? maxIndex + 1 : 0),
    recipientRoles: [] as Array<{ id: unknown; label: unknown }>,
    fieldCount: fields.length,
    variables: [] as Array<{ key: unknown; label: unknown; type: unknown; defaultValue: unknown }>,
    senderFields: fields.filter((f) => f.recipientIndex === -1).map((f) => ({ id: f.id, label: f.label })),
  };
}
