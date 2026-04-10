"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Loader2,
  Pen,
  Calendar,
  Type,
  CheckSquare,
  User,
  Mail,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Settings2,
  Building2,
  Phone,
  Hash,
  Globe,
  Map,
  AlignLeft,
  Upload,
  ChevronDown,
  X,
} from "lucide-react";
import Link from "next/link";
import { DraggableField, recipientColors, getFieldTypeInfo, type FieldData } from "@/components/pdf/draggable-field";

// Dynamically import PDF components to avoid SSR issues with DOMMatrix
const PdfDocument = dynamic(
  () => import("@/components/pdf/pdf-document").then((mod) => mod.PdfDocument),
  { ssr: false }
);

interface EditorPageProps {
  params: { id: string };
}

interface DocumentData {
  id: string;
  title: string;
  fileName: string | null;
  fileUrl: string | null;
  status: string;
  pageCount: number | null;
}

interface Recipient {
  id: string;
  documentId: string;
  email: string;
  name: string | null;
  status: string;
  orderIndex: number;
}

interface DocumentField {
  id: string;
  documentId: string;
  recipientId: string;
  type: string;
  page: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
}

const fieldTypes = [
  { type: "signature", label: "Signature", icon: Pen, width: 200, height: 60 },
  { type: "initials", label: "Initials", icon: Type, width: 80, height: 40 },
  { type: "date", label: "Date", icon: Calendar, width: 120, height: 30 },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, width: 24, height: 24 },
  { type: "text", label: "Text", icon: Type, width: 200, height: 30 },
  { type: "name", label: "Name", icon: User, width: 150, height: 30 },
  { type: "email", label: "Email", icon: Mail, width: 180, height: 30 },
  { type: "title", label: "Title", icon: User, width: 150, height: 30 },
  { type: "company", label: "Company", icon: Building2, width: 180, height: 30 },
  { type: "firstname", label: "First Name", icon: User, width: 150, height: 30 },
  { type: "lastname", label: "Last Name", icon: User, width: 150, height: 30 },
  { type: "phone", label: "Phone", icon: Phone, width: 150, height: 30 },

  { type: "address", label: "Street Address", icon: MapPin, width: 200, height: 30 },
  { type: "suburb", label: "Suburb / City", icon: MapPin, width: 150, height: 30 },
  { type: "state", label: "State", icon: Map, width: 100, height: 30 },
  { type: "postcode", label: "Postcode", icon: Hash, width: 100, height: 30 },
  { type: "country", label: "Country", icon: Globe, width: 150, height: 30 },

  { type: "paragraph", label: "Paragraph", icon: AlignLeft, width: 300, height: 80 },
  { type: "number", label: "Number", icon: Hash, width: 100, height: 30 },
  { type: "postcodes", label: "Postcodes", icon: Upload, width: 220, height: 50 },
];

export default function DocumentEditorPage({ params }: EditorPageProps) {
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendFromName, setSendFromName] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [selectedFieldType, setSelectedFieldType] = useState<string>("signature");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [autoRelease, setAutoRelease] = useState(true);
  const [canResizeFields, setCanResizeFields] = useState(false);

  // Custom field state
  const [prefillEditValue, setPrefillEditValue] = useState<string>("");
  // Sync prefill edit value when selected field changes
  useEffect(() => {
    if (selectedFieldId) {
      const f = fields.find(x => x.id === selectedFieldId);
      setPrefillEditValue(f?.value || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFieldId]);

  const [customFields, setCustomFields] = useState<Array<{ type: string; label: string }>>([]);
  const [showCustomFieldDialog, setShowCustomFieldDialog] = useState(false);
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState("");

  // Dropdown field state
  const [dropdownFields, setDropdownFields] = useState<Array<{ type: string; label: string }>>([]);
  const [showDropdownDialog, setShowDropdownDialog] = useState(false);
  const [newDropdownLabel, setNewDropdownLabel] = useState("");
  const [newDropdownOptions, setNewDropdownOptions] = useState<string[]>(["", ""]);


  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 }); // Default letter size
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  // Fetch plan limits for feature gating
  useEffect(() => {
    const fetchPlanLimits = async () => {
      try {
        const response = await fetch("/api/user/plan-limits");
        if (response.ok) {
          const data = await response.json();
          setCanResizeFields(data.features?.resizeFields || data.isSuperAdmin || false);
        }
      } catch (error) {
        console.error("Error fetching plan limits:", error);
      }
    };

    if (session?.user) {
      fetchPlanLimits();
    }
  }, [session]);

  useEffect(() => {
    const fetchDocument = async () => {
      if (status === "loading") return;

      if (!session?.user) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch(`/api/documents/${params.id}`);
        if (!response.ok) {
          router.push("/dashboard/documents");
          return;
        }

        const data = await response.json();
        setDocument(data.document);
        setRecipients(data.recipients || []);
        setFields(data.fields || []);

        // Extract custom fields from existing placed fields
        const existingCustomFields = (data.fields || [])
          .filter((f: DocumentField) => f.type.startsWith("custom:"))
          .map((f: DocumentField) => ({
            type: f.type,
            label: f.type.substring(7), // Remove "custom:" prefix
          }))
          .filter((f: { type: string; label: string }, index: number, self: Array<{ type: string; label: string }>) =>
            self.findIndex(t => t.type === f.type) === index // Remove duplicates
          );
        setCustomFields(existingCustomFields);

        // Auto-select first recipient if available
        if (data.recipients?.length > 0) {
          setSelectedRecipientId(data.recipients[0].id);
        }
      } catch (error) {
        router.push("/dashboard/documents");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [params.id, router, session, status]);

  const addRecipient = async () => {
    if (!newRecipientEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newRecipient: Recipient = {
      id: tempId,
      documentId: params.id,
      email: newRecipientEmail.trim(),
      name: newRecipientName.trim() || null,
      status: "pending",
      orderIndex: recipients.length,
    };

    setRecipients([...recipients, newRecipient]);
    setNewRecipientEmail("");
    setNewRecipientName("");

    // Auto-select newly added recipient
    setSelectedRecipientId(tempId);

    try {
      const response = await fetch(`/api/documents/${params.id}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newRecipient.email,
          name: newRecipient.name,
          orderIndex: newRecipient.orderIndex,
        }),
      });

      if (!response.ok) throw new Error("Failed to add recipient");

      const data = await response.json();
      // Replace temp recipient with real one
      setRecipients(prev => prev.map(r => r.id === tempId ? data.recipient : r));
      setSelectedRecipientId(data.recipient.id);

      toast({
        title: "Recipient added",
        description: `${newRecipient.email} has been added.`,
      });
    } catch (error) {
      // Rollback optimistic update
      setRecipients(prev => prev.filter(r => r.id !== tempId));
      toast({
        title: "Error",
        description: "Failed to add recipient.",
        variant: "destructive",
      });
    }
  };

  const removeRecipient = async (id: string) => {
    const recipientToRemove = recipients.find(r => r.id === id);

    // Remove recipient and their fields optimistically
    setRecipients(prev => prev.filter(r => r.id !== id));
    setFields(prev => prev.filter(f => f.recipientId !== id));

    if (selectedRecipientId === id) {
      const remaining = recipients.filter(r => r.id !== id);
      setSelectedRecipientId(remaining.length > 0 ? remaining[0].id : null);
    }

    try {
      const response = await fetch(`/api/documents/${params.id}/recipients/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove recipient");

      toast({
        title: "Recipient removed",
        description: "The recipient has been removed.",
      });
    } catch (error) {
      // Rollback
      if (recipientToRemove) {
        setRecipients(prev => [...prev, recipientToRemove]);
      }
      toast({
        title: "Error",
        description: "Failed to remove recipient.",
        variant: "destructive",
      });
    }
  };

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only create field if clicking directly on the PDF container, not on existing fields
      const target = e.target as HTMLElement;
      if (target.closest('[data-field-id]')) {
        return; // Clicked on a field, don't create new one
      }

      if (!selectedRecipientId || !pageContainerRef.current) return;

      const rect = pageContainerRef.current.getBoundingClientRect();

      // Check standard field types, custom fields, or dropdown fields
      const standardFieldType = fieldTypes.find(f => f.type === selectedFieldType);
      const customField = customFields.find(f => f.type === selectedFieldType);
      const dropdownField = dropdownFields.find(f => f.type === selectedFieldType);

      // Default dimensions for custom/dropdown fields
      const width = standardFieldType?.width || 180;
      const height = standardFieldType?.height || 36;

      if (!standardFieldType && !customField && !dropdownField) return;

      // Calculate click position relative to the unscaled PDF
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      // Center the field on click position
      const xPosition = Math.max(0, x - width / 2);
      const yPosition = Math.max(0, y - height / 2);

      addField(selectedRecipientId, xPosition, yPosition);
    },
    [selectedRecipientId, selectedFieldType, scale, currentPage, customFields, dropdownFields]
  );

  const addField = async (recipientId: string, x: number, y: number) => {
    // Check if it's a standard field type, custom field, or dropdown field
    const standardFieldType = fieldTypes.find(f => f.type === selectedFieldType);
    const customField = customFields.find(f => f.type === selectedFieldType);
    const dropdownField = dropdownFields.find(f => f.type === selectedFieldType);

    // Get dimensions - custom/dropdown fields default to text field size
    const width = standardFieldType?.width || 180;
    const height = standardFieldType?.height || 36;

    if (!standardFieldType && !customField && !dropdownField) return;

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const newField: DocumentField = {
      id: tempId,
      documentId: params.id,
      recipientId,
      type: selectedFieldType,
      page: currentPage,
      xPosition: Math.round(x),
      yPosition: Math.round(y),
      width,
      height,
      required: true,
      value: null,
    };

    setFields(prev => [...prev, newField]);
    setSelectedFieldId(tempId);

    try {
      const response = await fetch(`/api/documents/${params.id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          type: selectedFieldType,
          page: currentPage,
          xPosition: newField.xPosition,
          yPosition: newField.yPosition,
          width: newField.width,
          height: newField.height,
        }),
      });

      if (!response.ok) throw new Error("Failed to add field");

      const data = await response.json();
      setFields(prev => prev.map(f => f.id === tempId ? data.field : f));
      setSelectedFieldId(data.field.id);
    } catch (error) {
      setFields(prev => prev.filter(f => f.id !== tempId));
      toast({
        title: "Error",
        description: "Failed to add field.",
        variant: "destructive",
      });
    }
  };

  const updateFieldPosition = useCallback(async (id: string, x: number, y: number) => {
    // Optimistic update
    setFields(prev => prev.map(f =>
      f.id === id ? { ...f, xPosition: Math.round(x), yPosition: Math.round(y) } : f
    ));

    // Don't make API call for temp fields
    if (id.startsWith("temp-")) return;

    try {
      await fetch(`/api/documents/${params.id}/fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xPosition: Math.round(x),
          yPosition: Math.round(y),
        }),
      });
    } catch (error) {
      console.error("Failed to update field position:", error);
    }
  }, [params.id]);

  const updateFieldSize = useCallback(async (id: string, width: number, height: number) => {
    // Optimistic update
    setFields(prev => prev.map(f =>
      f.id === id ? { ...f, width: Math.round(width), height: Math.round(height) } : f
    ));

    // Don't make API call for temp fields
    if (id.startsWith("temp-")) return;

    try {
      await fetch(`/api/documents/${params.id}/fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width: Math.round(width),
          height: Math.round(height),
        }),
      });
    } catch (error) {
      console.error("Failed to update field size:", error);
    }
  }, [params.id]);

  const removeField = async (id: string) => {
    const fieldToRemove = fields.find(f => f.id === id);
    setFields(prev => prev.filter(f => f.id !== id));

    if (id.startsWith("temp-")) return;

    try {
      const response = await fetch(`/api/documents/${params.id}/fields/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove field");
    } catch (error) {
      if (fieldToRemove) {
        setFields(prev => [...prev, fieldToRemove]);
      }
      toast({
        title: "Error",
        description: "Failed to remove field.",
        variant: "destructive",
      });
    }
  };

  const sendForSigning = async (fromName?: string) => {
    if (recipients.length === 0) {
      toast({
        title: "No recipients",
        description: "Please add at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    if (fields.length === 0) {
      toast({
        title: "No fields",
        description: "Please add at least one signature field.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setShowSendDialog(false);

    try {
      const response = await fetch(`/api/documents/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName: fromName?.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send document");
      }

      toast({
        title: "Document sent!",
        description: `${data.emailsSent || recipients.length} invitation email(s) sent successfully.`,
      });

      router.push(`/dashboard/documents/${params.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send document.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  };

  const onPageLoadSuccess = (page: { width: number; height: number }) => {
    setPageSize({ width: page.width, height: page.height });
  };

  // Add custom field handler
  const addCustomField = () => {
    const label = newCustomFieldLabel.trim();
    if (!label) {
      toast({
        title: "Label required",
        description: "Please enter a label for your custom field.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate labels
    const existingCustom = customFields.find(f => f.label.toLowerCase() === label.toLowerCase());
    if (existingCustom) {
      toast({
        title: "Field already exists",
        description: `A custom field with the label "${label}" already exists.`,
        variant: "destructive",
      });
      return;
    }

    const newCustomField = {
      type: `custom:${label}`,
      label: label,
    };

    setCustomFields(prev => [...prev, newCustomField]);
    setSelectedFieldType(newCustomField.type);
    setNewCustomFieldLabel("");
    setShowCustomFieldDialog(false);

    toast({
      title: "Custom field added",
      description: `"${label}" has been added to your field types.`,
    });
  };

  // Remove custom field handler
  const removeCustomField = (fieldType: string) => {
    setCustomFields(prev => prev.filter(f => f.type !== fieldType));
    // If the removed field was selected, switch to signature
    if (selectedFieldType === fieldType) {
      setSelectedFieldType("signature");
    }
  };

  // Dropdown field handlers
  const addDropdownField = () => {
    const label = newDropdownLabel.trim();
    const options = newDropdownOptions.map(o => o.trim()).filter(Boolean);

    if (!label) {
      toast({ title: "Label required", description: "Please enter a label for your dropdown field.", variant: "destructive" });
      return;
    }
    if (options.length < 2) {
      toast({ title: "Options required", description: "Please add at least 2 options.", variant: "destructive" });
      return;
    }

    const type = `dropdown:${label}:${options.join("|")}`;
    const existing = dropdownFields.find(f => f.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      toast({ title: "Field already exists", description: `A dropdown field named "${label}" already exists.`, variant: "destructive" });
      return;
    }

    setDropdownFields(prev => [...prev, { type, label }]);
    setSelectedFieldType(type);
    setNewDropdownLabel("");
    setNewDropdownOptions(["", ""]);
    setShowDropdownDialog(false);
    toast({ title: "Dropdown field added", description: `"${label}" has been added to your field types.` });
  };

  const removeDropdownField = (fieldType: string) => {
    setDropdownFields(prev => prev.filter(f => f.type !== fieldType));
    if (selectedFieldType === fieldType) setSelectedFieldType("signature");
  };

  // Get fields for current page
  const currentPageFields = fields.filter(f => f.page === currentPage);

  // Get recipient index for coloring
  const getRecipientIndex = (recipientId: string) => {
    return recipients.findIndex(r => r.id === recipientId);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/documents/${params.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{document.title}</h1>
            <p className="text-sm text-muted-foreground">
              Add recipients and place signature fields
            </p>
          </div>
        </div>

        <Button onClick={() => setShowSendDialog(true)} disabled={isSending || recipients.length === 0 || fields.length === 0}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send for Signing
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* PDF Preview */}
        <div className="flex-1 flex flex-col bg-gray-100">
          {/* PDF Controls */}
          <div className="flex items-center justify-between border-b bg-background px-4 py-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[100px] text-center">
                Page {currentPage} of {numPages || "..."}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                disabled={scale <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(s => Math.min(2, s + 0.1))}
                disabled={scale >= 2}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* PDF Document */}
          <div className="flex-1 overflow-auto p-4">
            <div className="flex justify-center">
              {document.fileUrl ? (
                <div
                  ref={pageContainerRef}
                  className="relative shadow-lg bg-white"
                  onClick={handlePageClick}
                  style={{ cursor: selectedRecipientId ? "crosshair" : "default" }}
                >
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <PdfDocument
                      fileUrl={document.fileUrl}
                      currentPage={currentPage}
                      scale={scale}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onPageLoadSuccess={onPageLoadSuccess}
                    />
                  </div>

                  {/* Fields overlay - no CSS transform, positions are scaled directly */}
                  <div
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{
                      width: pageSize.width * scale,
                      height: pageSize.height * scale,
                    }}
                  >
                    {currentPageFields.map((field) => {
                      const recipient = recipients.find(r => r.id === field.recipientId);
                      const recipientIndex = getRecipientIndex(field.recipientId);
                      // Apply scale to field position and size for display
                      const scaledField = {
                        ...field,
                        xPosition: field.xPosition * scale,
                        yPosition: field.yPosition * scale,
                        width: field.width * scale,
                        height: field.height * scale,
                      };
                      return (
                        <DraggableField
                          key={field.id}
                          field={scaledField}
                          recipientName={recipient?.name || recipient?.email}
                          recipientColor={String(recipientIndex)}
                          isSelected={selectedFieldId === field.id}
                          onSelect={() => setSelectedFieldId(field.id)}
                          onPositionChange={(id, x, y) => {
                            // Convert back from scaled to unscaled coordinates
                            updateFieldPosition(id, x / scale, y / scale);
                          }}
                          onResize={canResizeFields ? (id, w, h) => {
                            // Convert back from scaled to unscaled size
                            updateFieldSize(id, w / scale, h / scale);
                          } : undefined}
                          onDelete={removeField}
                          scale={1} // Scale is now applied to the field data directly
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="aspect-[8.5/11] w-full max-w-2xl bg-white rounded-lg shadow-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4" />
                    <p>No PDF uploaded</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l bg-background overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Field Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Field Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Recipient Button */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Name"
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={newRecipientEmail}
                      onChange={(e) => setNewRecipientEmail(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <Button variant="outline" className="w-full" onClick={addRecipient}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add new recipient
                  </Button>
                </div>

                {/* Auto-release checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-release"
                    checked={autoRelease}
                    onCheckedChange={(checked) => setAutoRelease(!!checked)}
                  />
                  <label
                    htmlFor="auto-release"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Auto-release signatures when complete
                  </label>
                </div>

                {/* Select Recipient */}
                {recipients.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Select Recipient:</Label>
                    <select
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={selectedRecipientId || ""}
                      onChange={(e) => setSelectedRecipientId(e.target.value || null)}
                    >
                      <option value="">None</option>
                      {recipients.map((recipient, index) => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.name || recipient.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Add Custom Field Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCustomFieldDialog(true)}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Add Custom Field
                </Button>

                {/* Add Dropdown Field Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowDropdownDialog(true)}
                >
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Add Dropdown Field
                </Button>

                {/* Field Type Buttons */}
                <div className="space-y-2">
                  {fieldTypes.map((field) => (
                    <Button
                      key={field.type}
                      variant={selectedFieldType === field.type ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setSelectedFieldType(field.type)}
                      disabled={!selectedRecipientId}
                    >
                      <field.icon className="mr-2 h-4 w-4" />
                      {field.label}
                    </Button>
                  ))}

                  {/* Custom Field Buttons */}
                  {customFields.map((field) => (
                    <div key={field.type} className="flex gap-1">
                      <Button
                        variant={selectedFieldType === field.type ? "default" : "outline"}
                        className="flex-1 justify-start"
                        onClick={() => setSelectedFieldType(field.type)}
                        disabled={!selectedRecipientId}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        {field.label}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeCustomField(field.type)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {/* Dropdown Field Buttons */}
                  {dropdownFields.map((field) => (
                    <div key={field.type} className="flex gap-1">
                      <Button
                        variant={selectedFieldType === field.type ? "default" : "outline"}
                        className="flex-1 justify-start"
                        onClick={() => setSelectedFieldType(field.type)}
                        disabled={!selectedRecipientId}
                      >
                        <ChevronDown className="mr-2 h-4 w-4" />
                        {field.label}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => removeDropdownField(field.type)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                {!selectedRecipientId && recipients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Add a recipient to start placing fields
                  </p>
                )}

                {!selectedRecipientId && recipients.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Select a recipient to place fields
                  </p>
                )}

                {selectedRecipientId && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Click on the PDF to place a {getFieldTypeInfo(selectedFieldType).label} field
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recipients List */}
            {recipients.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recipients ({recipients.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recipients.map((recipient, index) => {
                    const colors = recipientColors[index % recipientColors.length];
                    const recipientFields = fields.filter(f => f.recipientId === recipient.id);
                    return (
                      <div
                        key={recipient.id}
                        className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedRecipientId === recipient.id ? colors.bg + " " + colors.border : ""
                        }`}
                        onClick={() => setSelectedRecipientId(recipient.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-sm font-medium ${
                              colors.border.replace("border-", "bg-")
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {recipient.name || recipient.email}
                            </p>
                            {recipient.name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {recipient.email}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {recipientFields.length} field(s)
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecipient(recipient.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Fields Summary */}
            {fields.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Placed Fields ({fields.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fields.map((field) => {
                      const recipient = recipients.find(r => r.id === field.recipientId);
                      const recipientIndex = getRecipientIndex(field.recipientId);
                      const colors = recipientColors[recipientIndex % recipientColors.length];
                      const { baseType, label: fieldLabel } = getFieldTypeInfo(field.type);
                      const FieldIcon = fieldTypes.find(f => f.type === baseType)?.icon || (baseType === "custom" ? FileText : Type);
                      return (
                        <div key={field.id} className="space-y-1">
                          <div
                            className={`flex items-center justify-between rounded-lg border p-2 cursor-pointer ${
                              selectedFieldId === field.id ? "ring-2 ring-primary" : ""
                            }`}
                            onClick={() => {
                              setSelectedFieldId(field.id);
                              setCurrentPage(field.page);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${colors.bg}`}>
                                <FieldIcon className={`h-4 w-4 ${colors.text}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {field.type === "date" || field.type === "date_auto" ? "Date" : fieldLabel}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Page {field.page} • {recipient?.name || recipient?.email || "Unassigned"}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(field.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                          {selectedFieldId === field.id && field.type === "postcodes" && (
                            <div className="mx-1 mb-2">
                              <p className="text-xs text-muted-foreground font-medium mb-1">Field type</p>
                              <div className="text-xs border rounded px-2 py-1.5 bg-muted text-muted-foreground">Postcodes (upload field)</div>
                            </div>
                          )}
                          {selectedFieldId === field.id && !["signature", "initials", "date", "date_auto", "checkbox", "postcodes"].includes(field.type) && !field.type.startsWith("dropdown:") && !field.type.startsWith("custom:") && (
                            <div className="mx-1">
                              <p className="text-xs text-muted-foreground font-medium mb-1">Field type</p>
                              <select
                                className="w-full text-xs border rounded px-2 py-1.5 bg-background mb-2"
                                value={field.type}
                                onChange={(e) => {
                                  const newType = e.target.value;
                                  setFields(prev => prev.map(f => f.id === field.id ? { ...f, type: newType } : f));
                                  if (!field.id.startsWith("temp-")) {
                                    fetch(`/api/documents/${params.id}/fields/${field.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ type: newType }),
                                    }).catch(console.error);
                                  }
                                }}
                              >
                                <option value="text">Text (generic)</option>
                                <option value="paragraph">Paragraph</option>
                                <option value="number">Number</option>
                                <option value="name">Name</option>
                                <option value="firstname">First Name</option>
                                <option value="lastname">Last Name</option>
                                <option value="email">Email</option>
                                <option value="phone">Phone</option>
                                <option value="company">Company</option>
                                <option value="title">Title</option>
                                <option value="address">Street Address</option>
                                <option value="suburb">Suburb / City</option>
                                <option value="state">State</option>
                                <option value="postcode">Postcode</option>
                                <option value="country">Country</option>
                              </select>
                            </div>
                          )}
                          {selectedFieldId === field.id && !["signature", "initials", "date", "date_auto", "checkbox", "postcodes"].includes(field.type) && !field.type.startsWith("dropdown:") && !field.type.startsWith("custom:") && (
                            <div className="space-y-1 mx-1 pb-1">
                              <p className="text-xs text-muted-foreground font-medium">Pre-fill text (optional)</p>
                              <Textarea
                                value={prefillEditValue}
                                onChange={(e) => setPrefillEditValue(e.target.value)}
                                onBlur={() => {
                                  // Save value on blur
                                  setFields(prev => prev.map(f => f.id === field.id ? { ...f, value: prefillEditValue || null } : f));
                                  if (!field.id.startsWith("temp-")) {
                                    fetch(`/api/documents/${params.id}/fields/${field.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ value: prefillEditValue || null }),
                                    }).catch(console.error);
                                  }
                                }}
                                placeholder="Leave blank for signer to fill..."
                                className="text-xs min-h-[60px] resize-none"
                                rows={3}
                              />
                              <p className="text-[10px] text-muted-foreground">Recipient can still edit this before signing</p>
                            </div>
                          )}
                          {selectedFieldId === field.id && (
                            <div className="flex rounded-md overflow-hidden border text-xs mx-1">
                              <button
                                className={`flex-1 px-2 py-1.5 transition-colors ${field.required ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                  setFields(prev => prev.map(f => f.id === field.id ? { ...f, required: true } : f));
                                  if (!field.id.startsWith("temp-")) {
                                    fetch(`/api/documents/${params.id}/fields/${field.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ required: true }),
                                    }).catch(console.error);
                                  }
                                }}
                              >
                                Required
                              </button>
                              <button
                                className={`flex-1 px-2 py-1.5 transition-colors border-l ${!field.required ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                  setFields(prev => prev.map(f => f.id === field.id ? { ...f, required: false } : f));
                                  if (!field.id.startsWith("temp-")) {
                                    fetch(`/api/documents/${params.id}/fields/${field.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ required: false }),
                                    }).catch(console.error);
                                  }
                                }}
                              >
                                Optional
                              </button>
                            </div>
                          )}
                          {selectedFieldId === field.id && (field.type === "date" || field.type === "date_auto") && (
                            <div className="flex rounded-md overflow-hidden border text-xs mx-1">
                              <button
                                className={`flex-1 px-2 py-1.5 transition-colors ${field.type === "date" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                  setFields(prev => prev.map(f => f.id === field.id ? { ...f, type: "date" } : f));
                                  if (!field.id.startsWith("temp-")) {
                                    fetch(`/api/documents/${params.id}/fields/${field.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ type: "date" }),
                                    }).catch(console.error);
                                  }
                                }}
                              >
                                Signer enters
                              </button>
                              <button
                                className={`flex-1 px-2 py-1.5 transition-colors border-l ${field.type === "date_auto" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                onClick={() => {
                                  setFields(prev => prev.map(f => f.id === field.id ? { ...f, type: "date_auto" } : f));
                                  if (!field.id.startsWith("temp-")) {
                                    fetch(`/api/documents/${params.id}/fields/${field.id}`, {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ type: "date_auto" }),
                                    }).catch(console.error);
                                  }
                                }}
                              >
                                Auto signing date
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Send for Signing Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send for Signing</DialogTitle>
            <DialogDescription>
              Review who this request will appear to come from before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="send-from-name">From name</Label>
              <Input
                id="send-from-name"
                placeholder={session?.user?.name || "e.g. Why Solar"}
                value={sendFromName}
                onChange={(e) => setSendFromName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendForSigning(sendFromName); }}
              />
              <p className="text-xs text-muted-foreground">
                Signers will see &ldquo;<strong>{sendFromName || session?.user?.name || "Your Name"}</strong> requested your signature on &hellip;&rdquo;
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
            <Button onClick={() => sendForSigning(sendFromName)} disabled={isSending}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Field Dialog */}
      <Dialog open={showCustomFieldDialog} onOpenChange={setShowCustomFieldDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Create a custom text field with your own label. This field will appear as an open text input for signers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-field-label">Field Label</Label>
              <Input
                id="custom-field-label"
                placeholder="e.g. Company Name, Job Title, Phone Number"
                value={newCustomFieldLabel}
                onChange={(e) => setNewCustomFieldLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomField();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCustomFieldDialog(false);
              setNewCustomFieldLabel("");
            }}>
              Cancel
            </Button>
            <Button onClick={addCustomField}>
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dropdown Field Dialog */}
      <Dialog open={showDropdownDialog} onOpenChange={setShowDropdownDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Dropdown Field</DialogTitle>
            <DialogDescription>
              Create a dropdown field with predefined options. Signers will select one option.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dropdown-label">Field Label</Label>
              <Input
                id="dropdown-label"
                placeholder="e.g. Lead Type, Property Type"
                value={newDropdownLabel}
                onChange={(e) => setNewDropdownLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {newDropdownOptions.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...newDropdownOptions];
                        updated[i] = e.target.value;
                        setNewDropdownOptions(updated);
                      }}
                    />
                    {newDropdownOptions.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setNewDropdownOptions(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setNewDropdownOptions(prev => [...prev, ""])}
              >
                <Plus className="mr-2 h-3 w-3" />
                Add Option
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDropdownDialog(false);
              setNewDropdownLabel("");
              setNewDropdownOptions(["", ""]);
            }}>
              Cancel
            </Button>
            <Button onClick={addDropdownField}>
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
