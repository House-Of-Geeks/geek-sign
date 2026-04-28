import { auth } from "@/lib/auth";
import { db, documents, recipients, documentFields, auditLogs } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Loader2,
  Table2,
} from "lucide-react";
import { formatDate, formatDistanceToNow } from "@/lib/utils";
import { SendDocumentWithWorkflow } from "@/components/documents/send-document-with-workflow";
import { ResendEmailsButton } from "@/components/documents/resend-emails-button";
import { DownloadButton } from "@/components/documents/download-button";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { CopySigningLinkButton } from "@/components/documents/copy-signing-link-button";
import { EditRecipientNameButton } from "@/components/documents/edit-recipient-name-button";

// Dynamically import PDF preview to avoid SSR issues
const DocumentPreview = dynamic(
  () => import("@/components/pdf/document-preview").then((mod) => mod.DocumentPreview),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[8.5/11] rounded-lg border bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// Signed document preview with signature overlays
const SignedDocumentPreview = dynamic(
  () => import("@/components/pdf/signed-document-preview").then((mod) => mod.SignedDocumentPreview),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[8.5/11] rounded-lg border bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface DocumentPageProps {
  params: { id: string };
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Get team IDs the user belongs to so team members can access shared documents
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, session.user.id));
  const teamIds = memberships.map((m) => m.teamId);

  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, params.id),
        teamIds.length > 0
          ? or(
              eq(documents.userId, session.user.id),
              inArray(documents.teamId, teamIds)
            )
          : eq(documents.userId, session.user.id)
      )
    )
    .limit(1);

  if (!document) {
    notFound();
  }

  const docRecipients = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, params.id));

  const docFields = await db
    .select()
    .from(documentFields)
    .where(eq(documentFields.documentId, params.id));

  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.documentId, params.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="text-base px-3 py-1">Draft</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-[#F15C3E] text-[#F15C3E] text-base px-3 py-1">Pending</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-[#07AFBA] hover:bg-[#07AFBA]/90 text-base px-3 py-1">Completed</Badge>;
      case "expired":
        return <Badge variant="destructive" className="text-base px-3 py-1">Expired</Badge>;
      default:
        return <Badge variant="secondary" className="text-base px-3 py-1">{status}</Badge>;
    }
  };

  const getRecipientStatusIcon = (status: string) => {
    switch (status) {
      case "signed":
        return <CheckCircle2 className="h-4 w-4 text-[#07AFBA]" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-[#F15C3E]" />;
    }
  };

  const fieldLabel = (type: string): string => {
    if (type.startsWith("custom:")) return type.substring(7);
    if (type.startsWith("dropdown:")) return type.split(":")[1] || "Dropdown";
    if (type.startsWith("sender_")) return "Sender Fill";
    const labels: Record<string, string> = {
      signature: "Signature", initials: "Initials", date: "Date", date_auto: "Signing Date",
      text: "Text", checkbox: "Checkbox", name: "Name", email: "Email", address: "Address",
      title: "Title", company: "Company", firstname: "First Name", lastname: "Last Name",
      phone: "Phone", suburb: "Suburb / City", state: "State", postcode: "Postcode",
      country: "Country", paragraph: "Paragraph", number: "Number", postcodes: "Postcodes",
    };
    return labels[type] || type;
  };

  const formatFieldValue = (type: string, value: string | null): string => {
    if (!value) return "—";
    if (value.startsWith("data:image")) return "✓ Signed";
    if (type === "checkbox") return value === "checked" ? "✓ Checked" : "Unchecked";
    if (type === "postcodes") {
      const count = value.split(/[\n,]+/).filter(Boolean).length;
      return `${count} postcode${count !== 1 ? "s" : ""} entered`;
    }
    return value.length > 120 ? value.substring(0, 120) + "…" : value;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/dashboard/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-muted p-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{document.title}</h1>
              <p className="text-muted-foreground">{document.fileName}</p>
              <div className="mt-2">
                {getStatusBadge(document.status)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {document.status === "draft" && (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/documents/${document.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
                <SendDocumentWithWorkflow
                  documentId={document.id}
                  documentTitle={document.title}
                  hasRecipients={docRecipients.length > 0}
                  hasFields={docFields.length > 0}
                />
              </>
            )}
            {document.status === "pending" && (
              <ResendEmailsButton documentId={document.id} />
            )}
            <DownloadButton
              documentId={document.id}
              documentTitle={document.title}
              isCompleted={document.status === "completed"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Document Preview</CardTitle>
              {(document.status === "completed" || document.status === "pending") && docFields.some(f => f.value) && (
                <CardDescription>Showing signed fields as overlays</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {(document.status === "completed" || document.status === "pending") && docFields.some(f => f.value) ? (
                <SignedDocumentPreview
                  fileUrl={document.fileUrl}
                  fields={docFields.map(f => ({
                    id: f.id,
                    type: f.type,
                    page: f.page,
                    xPosition: f.xPosition,
                    yPosition: f.yPosition,
                    width: f.width,
                    height: f.height,
                    value: f.value,
                    recipientId: f.recipientId,
                  }))}
                />
              ) : (
                <DocumentPreview fileUrl={document.fileUrl} />
              )}
            </CardContent>
          </Card>

          {/* Submitted Fields */}
          {docFields.some(f => f.value) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table2 className="h-5 w-5" />
                  Submitted Fields
                </CardTitle>
                <CardDescription>Field values entered by each recipient</CardDescription>
              </CardHeader>
              <CardContent>
                {docRecipients.map((recipient) => {
                  const recipientFields = docFields.filter(
                    f => f.recipientId === recipient.id && f.value && !f.type.startsWith("sender_")
                  );
                  if (recipientFields.length === 0) return null;
                  return (
                    <div key={recipient.id} className="mb-6 last:mb-0">
                      <p className="text-sm font-semibold mb-2 text-muted-foreground">
                        {recipient.name || recipient.email}
                        {recipient.name && <span className="font-normal ml-1">({recipient.email})</span>}
                      </p>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <tbody>
                            {recipientFields.map((field, i) => (
                              <tr key={field.id} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                                <td className="px-4 py-2 font-medium w-1/3 text-muted-foreground whitespace-nowrap">
                                  {fieldLabel(field.type)}
                                </td>
                                <td className="px-4 py-2 break-words">
                                  {formatFieldValue(field.type, field.value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
                {/* Sender-fill fields */}
                {docFields.some(f => f.value && f.type.startsWith("sender_")) && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2 text-muted-foreground">Pre-filled by sender</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody>
                          {docFields.filter(f => f.value && f.type.startsWith("sender_")).map((field, i) => (
                            <tr key={field.id} className={i % 2 === 0 ? "bg-amber-50" : ""}>
                              <td className="px-4 py-2 font-medium w-1/3 text-muted-foreground whitespace-nowrap">
                                {fieldLabel(field.type)}
                              </td>
                              <td className="px-4 py-2 break-words">
                                {formatFieldValue(field.type, field.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent activity for this document</CardDescription>
            </CardHeader>
            <CardContent>
              {logs && logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-4">
                      <div className="relative flex flex-col items-center">
                        <div className="rounded-full bg-muted p-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 w-px bg-border" />
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="font-medium capitalize">
                          {log.action.replace("_", " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt))} ago
                        </p>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground mt-1">
                            IP: {log.ipAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activity recorded yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Document Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(document.createdAt)}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">File Size</p>
                <p className="font-medium">{formatFileSize(document.fileSize)}</p>
              </div>
              {document.expiresAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Expires</p>
                    <p className="font-medium">{formatDate(document.expiresAt)}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recipients</CardTitle>
              {document.status === "draft" && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/documents/${document.id}/edit`}>
                    Edit
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {docRecipients && docRecipients.length > 0 ? (
                <div className="space-y-3">
                  {docRecipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {recipient.name || recipient.email}
                          </p>
                          {recipient.name && (
                            <p className="text-xs text-muted-foreground">
                              {recipient.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {document.status === "pending" && recipient.status !== "signed" && recipient.status !== "declined" && (
                          <EditRecipientNameButton
                            documentId={document.id}
                            recipientId={recipient.id}
                            currentName={recipient.name}
                            email={recipient.email}
                          />
                        )}
                        {document.status === "pending" && recipient.status === "pending" && recipient.signingToken && (
                          <CopySigningLinkButton signingToken={recipient.signingToken} />
                        )}
                        {getRecipientStatusIcon(recipient.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No recipients added</p>
                  {document.status === "draft" && (
                    <Button variant="link" size="sm" asChild className="mt-2">
                      <Link href={`/dashboard/documents/${document.id}/edit`}>
                        Add recipients
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <DeleteDocumentButton
                documentId={document.id}
                documentTitle={document.title}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
