import { auth } from "@/lib/auth";
import { db, documents, recipients, users, teamMembers } from "@/lib/db";
import { eq, desc, or, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import {
  FileText,
  Upload,
  Search,
  Eye,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow, formatDate } from "@/lib/utils";
import { DocumentActions } from "@/components/documents/document-actions";
import { plansConfig } from "@/config/plans";
import type { Plan } from "@/types";

export default async function DocumentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  // Fetch user to check plan
  const [user] = await db
    .select({
      plan: users.plan,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const effectivePlan = isSuperAdmin ? "team" : ((user?.plan || "free") as Plan);
  const retentionDays = plansConfig[effectivePlan].limits.retentionDays;
  const showRetentionWarning = retentionDays > 0 && !isSuperAdmin;

  // Get team IDs the user belongs to
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, session.user.id));
  const teamIds = memberships.map((m) => m.teamId);

  // Fetch own documents + team documents, with owner info
  const userDocuments = await db
    .select({
      id: documents.id,
      userId: documents.userId,
      teamId: documents.teamId,
      title: documents.title,
      fileUrl: documents.fileUrl,
      fileName: documents.fileName,
      fileSize: documents.fileSize,
      pageCount: documents.pageCount,
      status: documents.status,
      customMessage: documents.customMessage,
      documentHash: documents.documentHash,
      expiresAt: documents.expiresAt,
      completedAt: documents.completedAt,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(documents)
    .leftJoin(users, eq(documents.userId, users.id))
    .where(
      teamIds.length > 0
        ? or(
            eq(documents.userId, session.user.id),
            inArray(documents.teamId, teamIds)
          )
        : eq(documents.userId, session.user.id)
    )
    .orderBy(desc(documents.createdAt));

  // Fetch recipients for all documents
  const documentIds = userDocuments.map(d => d.id);
  const allRecipients = documentIds.length > 0
    ? await db.select().from(recipients).where(
        // @ts-ignore - We'll handle the empty case
        documentIds.length === 1
          ? eq(recipients.documentId, documentIds[0])
          : undefined
      )
    : [];

  // Group recipients by document
  const recipientsByDocument = allRecipients.reduce((acc, r) => {
    if (!acc[r.documentId]) acc[r.documentId] = [];
    acc[r.documentId].push(r);
    return acc;
  }, {} as Record<string, typeof allRecipients>);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "pending":
        return <Badge variant="outline" className="border-[#F15C3E] text-[#F15C3E]">Pending</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-[#07AFBA] hover:bg-[#07AFBA]/90">Completed</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRecipientStatus = (docRecipients: typeof allRecipients | undefined) => {
    if (!docRecipients || docRecipients.length === 0) return "No recipients";
    const signed = docRecipients.filter((r) => r.status === "signed").length;
    return `${signed}/${docRecipients.length} signed`;
  };

  return (
    <div className="space-y-8">
      {/* Retention Warning for Free Users */}
      {showRetentionWarning && (
        <Alert className="border-[#F15C3E]/30 bg-[#F15C3E]/5 dark:border-[#F15C3E]/50 dark:bg-[#F15C3E]/10">
          <Clock className="h-4 w-4 text-[#F15C3E]" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-[#252A61] dark:text-[#F15C3E]/90">
              Documents on the Free plan are automatically deleted after {retentionDays} days.
            </span>
            <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
              <Link href="/dashboard/billing">
                <Sparkles className="mr-2 h-3 w-3" />
                Upgrade for Unlimited
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Documents</h1>
          <p className="text-muted-foreground">
            Manage and track all your documents
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/upload">
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                All Status
              </Button>
              <Button variant="outline" size="sm">
                Date Range
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            {userDocuments?.length || 0} total documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userDocuments && userDocuments.length > 0 ? (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
                <div className="col-span-4">Document</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Recipients</div>
                <div className="col-span-2">Created</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Document Rows */}
              {userDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  {/* Document Info */}
                  <div className="md:col-span-4 flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {doc.fileName}
                      </p>
                      {doc.userId !== session.user?.id && doc.ownerName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-medium">Team</span> · {doc.ownerName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="md:col-span-2">
                    <span className="md:hidden text-sm text-muted-foreground mr-2">Status:</span>
                    {getStatusBadge(doc.status)}
                  </div>

                  {/* Recipients */}
                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    <span className="md:hidden text-muted-foreground mr-2">Recipients:</span>
                    {getRecipientStatus(recipientsByDocument[doc.id])}
                  </div>

                  {/* Created Date */}
                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    <span className="md:hidden mr-2">Created:</span>
                    <span title={formatDate(doc.createdAt)}>
                      {formatDistanceToNow(new Date(doc.createdAt))} ago
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-2 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/documents/${doc.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
                    <DocumentActions
                      documentId={doc.id}
                      documentTitle={doc.title}
                      status={doc.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No documents yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your first document to get started
              </p>
              <Button asChild>
                <Link href="/dashboard/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
