"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Plus,
  MoreHorizontal,
  FileText,
  Copy,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RecipientSlot {
  index: number;
  preAssignedEmail: string | null;
  preAssignedName: string | null;
}

interface TemplateFieldInfo {
  id?: string;
  recipientIndex?: number;
  label?: string;
  type?: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string | null;
  fields: TemplateFieldInfo[] | null;
  recipientSlots: RecipientSlot[] | null;
  createdAt: string;
}

interface PlanLimits {
  templates: {
    used: number;
    limit: number;
    canCreate: boolean;
  };
  planConfig: {
    name: string;
  };
}

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null);
  const [useTemplateData, setUseTemplateData] = useState({
    title: "",
    customMessage: "",
  });
  const [useTemplateSlots, setUseTemplateSlots] = useState<Array<{ email: string; name: string }>>([{ email: "", name: "" }]);
  const [templateSenderFields, setTemplateSenderFields] = useState<TemplateFieldInfo[]>([]);
  const [senderFieldValues, setSenderFieldValues] = useState<Record<string, string>>({});
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchPlanLimits();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanLimits = async () => {
    try {
      const response = await fetch("/api/user/plan-limits");
      if (response.ok) {
        const data = await response.json();
        setPlanLimits(data);
      }
    } catch (error) {
      console.error("Error fetching plan limits:", error);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/templates/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== deleteId));
        toast({
          title: "Template deleted",
          description: "The template has been permanently deleted.",
        });
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to delete template",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleUseTemplate = async () => {
    if (!useTemplateId) return;

    if (!useTemplateData.title) {
      toast({
        title: "Title required",
        description: "Please enter a document title",
        variant: "destructive",
      });
      return;
    }

    const recipientEmails = useTemplateSlots
      .filter((s) => s.email.trim())
      .map((s) => ({ email: s.email.trim(), name: s.name.trim() || undefined }));

    if (recipientEmails.length === 0) {
      toast({
        title: "Recipients required",
        description: "Please enter at least one recipient email",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingDocument(true);
    try {
      const response = await fetch(`/api/templates/${useTemplateId}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: useTemplateData.title,
          recipientEmails,
          customMessage: useTemplateData.customMessage || undefined,
          senderFieldValues: Object.keys(senderFieldValues).length > 0 ? senderFieldValues : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Document created",
          description: "Redirecting to document editor...",
        });
        router.push(`/dashboard/documents/${data.document.id}/edit`);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create document from template",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Use template error:", error);
      toast({
        title: "Error",
        description: "Failed to create document from template",
        variant: "destructive",
      });
    } finally {
      setIsCreatingDocument(false);
      setUseTemplateId(null);
      setUseTemplateData({ title: "", customMessage: "" });
      setUseTemplateSlots([{ email: "", name: "" }]);
      setTemplateSenderFields([]);
      setSenderFieldValues({});
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canCreateMore = planLimits?.templates.canCreate ?? true;
  const templateLimit = planLimits?.templates.limit ?? -1;
  const templateUsed = planLimits?.templates.used ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">
            Create reusable templates for frequently used documents
          </p>
        </div>
        <div className="flex items-center gap-4">
          {templateLimit !== -1 && (
            <Badge variant="outline" className="text-sm">
              {templateUsed} / {templateLimit} templates
            </Badge>
          )}
          {canCreateMore ? (
            <Button asChild>
              <Link href="/dashboard/templates/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/dashboard/billing">
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade for More
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Limit Warning */}
      {!canCreateMore && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium">Template limit reached</p>
              <p className="text-sm text-muted-foreground">
                Your {planLimits?.planConfig.name} allows {templateLimit} template(s).
                Upgrade your plan for unlimited templates.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/billing">Upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Templates Grid */}
      {templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="group">
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {formatDistanceToNow(new Date(template.createdAt))} ago
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setUseTemplateId(template.id);
                        setUseTemplateData({ title: template.name, customMessage: "" });
                        // Compute slot count from fields and recipientSlots (exclude sender-fill fields)
                        const slots = template.recipientSlots || [];
                        const fields = template.fields || [];
                        const regularFields = fields.filter((f: TemplateFieldInfo) => (f.recipientIndex ?? 0) >= 0);
                        const maxFieldIndex = regularFields.reduce((max: number, f: TemplateFieldInfo) => Math.max(max, f.recipientIndex ?? 0), 0);
                        const numSlots = Math.max(1, slots.length, regularFields.length > 0 ? maxFieldIndex + 1 : 0);
                        setUseTemplateSlots(
                          Array.from({ length: numSlots }).map((_, i) => ({
                            email: slots[i]?.preAssignedEmail || "",
                            name: slots[i]?.preAssignedName || "",
                          }))
                        );
                        // Detect sender-fill fields
                        const senderFields = fields.filter((f: TemplateFieldInfo) => f.recipientIndex === -1);
                        setTemplateSenderFields(senderFields);
                        const initVals: Record<string, string> = {};
                        senderFields.forEach((f: TemplateFieldInfo) => { if (f.id) initVals[f.id] = ""; });
                        setSenderFieldValues(initVals);
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Use Template
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/templates/${template.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description || "No description provided"}
                </p>
                {template.fileUrl && (
                  <Badge variant="secondary" className="mt-2">
                    PDF attached
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              Create a template to save time on documents you send frequently
            </p>
            {canCreateMore && (
              <Button asChild>
                <Link href="/dashboard/templates/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Use Template Dialog */}
      <Dialog
        open={!!useTemplateId}
        onOpenChange={() => {
          setUseTemplateId(null);
          setUseTemplateData({ title: "", customMessage: "" });
          setUseTemplateSlots([{ email: "", name: "" }]);
          setTemplateSenderFields([]);
          setSenderFieldValues({});
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Document from Template</DialogTitle>
            <DialogDescription>
              Enter the details for your new document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                value={useTemplateData.title}
                onChange={(e) =>
                  setUseTemplateData({ ...useTemplateData, title: e.target.value })
                }
                placeholder="Enter document title"
              />
            </div>
            <div className="space-y-3">
              {useTemplateSlots.map((slot, index) => (
                <div key={index} className="space-y-1">
                  <Label>
                    {useTemplateSlots.length > 1 ? `Recipient ${index + 1}` : "Recipient"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={slot.email}
                      onChange={(e) => {
                        const updated = [...useTemplateSlots];
                        updated[index] = { ...updated[index], email: e.target.value };
                        setUseTemplateSlots(updated);
                      }}
                      placeholder="email@example.com"
                      className="flex-1"
                    />
                    <Input
                      value={slot.name}
                      onChange={(e) => {
                        const updated = [...useTemplateSlots];
                        updated[index] = { ...updated[index], name: e.target.value };
                        setUseTemplateSlots(updated);
                      }}
                      placeholder="Name (optional)"
                      className="w-36"
                    />
                  </div>
                </div>
              ))}
            </div>
            {templateSenderFields.length > 0 && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div>
                  <Label className="text-sm font-medium text-amber-900">Sender Fill Fields</Label>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Fill in these fields before sending — they will appear in the document for recipients to read.
                  </p>
                </div>
                {templateSenderFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs text-amber-800">{field.label || "Text Content"}</Label>
                    <Textarea
                      value={field.id ? (senderFieldValues[field.id] || "") : ""}
                      onChange={(e) => {
                        if (field.id) {
                          setSenderFieldValues(prev => ({ ...prev, [field.id!]: e.target.value }));
                        }
                      }}
                      placeholder={`Enter ${field.label || "content"}...`}
                      rows={3}
                      className="bg-white"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="message">Custom Message (optional)</Label>
              <Textarea
                id="message"
                value={useTemplateData.customMessage}
                onChange={(e) =>
                  setUseTemplateData({
                    ...useTemplateData,
                    customMessage: e.target.value,
                  })
                }
                placeholder="Add a personal message to recipients"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUseTemplateId(null)}
              disabled={isCreatingDocument}
            >
              Cancel
            </Button>
            <Button onClick={handleUseTemplate} disabled={isCreatingDocument}>
              {isCreatingDocument ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
