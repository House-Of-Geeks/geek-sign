"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Save,
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
  Building2,
  Phone,
  Hash,
  Globe,
  Map,
  Settings2,
  AlignLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Dynamically import PDF components to avoid SSR issues
const PdfDocument = dynamic(
  () => import("@/components/pdf/pdf-document").then((mod) => mod.PdfDocument),
  { ssr: false }
);

interface Template {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string | null;
  fields: TemplateField[] | null;
}

interface TemplateField {
  id: string;
  type: string;
  page: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  required: boolean;
  recipientIndex: number;
}

const fieldTypes = [
  { type: "signature", label: "Signature", icon: Pen, width: 200, height: 60 },
  { type: "initials", label: "Initials", icon: Type, width: 80, height: 40 },
  { type: "date", label: "Date", icon: Calendar, width: 120, height: 30 },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, width: 24, height: 24 },
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
  { type: "postcode", label: "Postcode", icon: Type, width: 100, height: 30 },
  { type: "country", label: "Country", icon: Globe, width: 150, height: 30 },

  { type: "paragraph", label: "Paragraph", icon: AlignLeft, width: 300, height: 80 },
  { type: "number", label: "Number", icon: Hash, width: 100, height: 30 },
];

const recipientColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
];

export default function TemplateEditorPage() {
  const params = useParams();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Field editing state
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState(0);
  const [selectedFieldType, setSelectedFieldType] = useState("signature");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [numRecipientSlots, setNumRecipientSlots] = useState(1);
  const [slotAssignments, setSlotAssignments] = useState<Array<{ email: string; name: string }>>([]);
  const [teamMembersList, setTeamMembersList] = useState<Array<{ userId: string; user: { name: string | null; email: string } }>>([]);

  // Custom field state
  const [customFields, setCustomFields] = useState<Array<{ type: string; label: string }>>([]);
  const [showCustomFieldDialog, setShowCustomFieldDialog] = useState(false);
  const [newCustomFieldLabel, setNewCustomFieldLabel] = useState("");

  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizeMode, setResizeMode] = useState<"none" | "se" | "e" | "s">("none");
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, width: 0, height: 0 });

  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/login");
      return;
    }
    fetchTemplate();
    // Fetch team members for pre-assignment dropdowns
    fetch("/api/team/members")
      .then((r) => r.ok ? r.json() : { members: [] })
      .then((data) => setTeamMembersList(data.members || []))
      .catch(() => {});
  }, [templateId, session, status]);

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
        const templateFields = (data.fields || []) as TemplateField[];
        setFields(templateFields);
        // Calculate number of recipient slots based on existing fields
        const maxRecipientIndex = templateFields.reduce((max, f) => Math.max(max, f.recipientIndex || 0), 0);
        const numSlots = Math.max(1, maxRecipientIndex + 1);
        setNumRecipientSlots(numSlots);
        // Load pre-assigned recipients
        if (data.recipientSlots && Array.isArray(data.recipientSlots)) {
          setSlotAssignments(
            (data.recipientSlots as Array<{ preAssignedEmail: string | null; preAssignedName: string | null }>).map((s) => ({
              email: s.preAssignedEmail || "",
              name: s.preAssignedName || "",
            }))
          );
        } else {
          setSlotAssignments(Array.from({ length: numSlots }).map(() => ({ email: "", name: "" })));
        }
      } else if (response.status === 404) {
        toast({
          title: "Template not found",
          description: "The template you're looking for doesn't exist.",
          variant: "destructive",
        });
        router.push("/dashboard/templates");
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      toast({
        title: "Error",
        description: "Failed to load template.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-field-id]')) {
        return;
      }

      if (!pageContainerRef.current) return;

      const rect = pageContainerRef.current.getBoundingClientRect();
      const standardFieldType = fieldTypes.find(f => f.type === selectedFieldType);
      const customField = customFields.find(f => f.type === selectedFieldType);
      if (!standardFieldType && !customField) return;

      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const width = standardFieldType?.width ?? 180;
      const height = standardFieldType?.height ?? 30;

      const xPosition = Math.max(0, x - width / 2);
      const yPosition = Math.max(0, y - height / 2);

      addField(xPosition, yPosition);
    },
    [selectedFieldType, scale, currentPage, selectedRecipientIndex, customFields]
  );

  const addField = (x: number, y: number) => {
    const standardFieldType = fieldTypes.find(f => f.type === selectedFieldType);
    const customField = customFields.find(f => f.type === selectedFieldType);
    if (!standardFieldType && !customField) return;

    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      type: selectedFieldType,
      page: currentPage,
      xPosition: Math.round(x),
      yPosition: Math.round(y),
      width: standardFieldType?.width ?? 180,
      height: standardFieldType?.height ?? 30,
      required: true,
      recipientIndex: selectedRecipientIndex,
    };

    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setHasChanges(true);
  };

  const addCustomField = () => {
    const label = newCustomFieldLabel.trim();
    if (!label) {
      toast({ title: "Label required", description: "Please enter a label for your custom field.", variant: "destructive" });
      return;
    }
    const existing = customFields.find(f => f.label.toLowerCase() === label.toLowerCase());
    if (existing) {
      toast({ title: "Field already exists", description: `A custom field named "${label}" already exists.`, variant: "destructive" });
      return;
    }
    const newCustomField = { type: `custom:${label}`, label };
    setCustomFields(prev => [...prev, newCustomField]);
    setSelectedFieldType(newCustomField.type);
    setNewCustomFieldLabel("");
    setShowCustomFieldDialog(false);
    toast({ title: "Custom field added", description: `"${label}" has been added.` });
  };

  const removeCustomField = (fieldType: string) => {
    setCustomFields(prev => prev.filter(f => f.type !== fieldType));
    if (selectedFieldType === fieldType) setSelectedFieldType("signature");
  };

  const updateFieldPosition = useCallback((id: string, x: number, y: number) => {
    setFields(prev => prev.map(f =>
      f.id === id ? { ...f, xPosition: Math.round(x), yPosition: Math.round(y) } : f
    ));
    setHasChanges(true);
  }, []);

  const updateFieldSize = useCallback((id: string, width: number, height: number) => {
    setFields(prev => prev.map(f =>
      f.id === id ? { ...f, width: Math.round(Math.max(40, width)), height: Math.round(Math.max(20, height)) } : f
    ));
    setHasChanges(true);
  }, []);

  const removeField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!template) return;

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("name", template.name);
      formData.append("description", template.description || "");
      formData.append("fields", JSON.stringify(fields));
      const recipientSlotsData = Array.from({ length: numRecipientSlots }).map((_, index) => ({
        index,
        preAssignedEmail: slotAssignments[index]?.email || null,
        preAssignedName: slotAssignments[index]?.name || null,
      }));
      formData.append("recipientSlots", JSON.stringify(recipientSlotsData));

      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save template");
      }

      setHasChanges(false);
      toast({
        title: "Template saved",
        description: "Your template fields have been saved.",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save template.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  };

  const onPageLoadSuccess = (page: { width: number; height: number }) => {
    setPageSize({ width: page.width, height: page.height });
  };

  // Handle field dragging
  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    setDraggedField(fieldId);
    setResizeMode("none");
    setSelectedFieldId(fieldId);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string, mode: "se" | "e" | "s") => {
    e.stopPropagation();
    e.preventDefault();
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    setDraggedField(fieldId);
    setResizeMode(mode);
    setSelectedFieldId(fieldId);
    setResizeStart({ mouseX: e.clientX, mouseY: e.clientY, width: field.width, height: field.height });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedField || !pageContainerRef.current) return;

    if (resizeMode !== "none") {
      const dx = (e.clientX - resizeStart.mouseX) / scale;
      const dy = (e.clientY - resizeStart.mouseY) / scale;
      const newWidth = resizeMode !== "s" ? resizeStart.width + dx : resizeStart.width;
      const newHeight = resizeMode !== "e" ? resizeStart.height + dy : resizeStart.height;
      updateFieldSize(draggedField, newWidth, newHeight);
      return;
    }

    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - dragOffset.x) / scale;
    const y = (e.clientY - rect.top - dragOffset.y) / scale;

    updateFieldPosition(draggedField, Math.max(0, x), Math.max(0, y));
  }, [draggedField, dragOffset, scale, updateFieldPosition, resizeMode, resizeStart, updateFieldSize]);

  const handleMouseUp = useCallback(() => {
    setDraggedField(null);
    setResizeMode("none");
  }, []);

  // Get fields for current page
  const currentPageFields = fields.filter(f => f.page === currentPage);

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/templates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{template.name}</h1>
            <p className="text-sm text-muted-foreground">
              Place signature fields on your template
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* PDF Preview */}
        <div
          className="flex-1 flex flex-col bg-gray-100"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
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
              {template.fileUrl ? (
                <div
                  ref={pageContainerRef}
                  className="relative shadow-lg bg-white"
                  onClick={handlePageClick}
                  style={{ cursor: "crosshair" }}
                >
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <PdfDocument
                      fileUrl={template.fileUrl}
                      currentPage={currentPage}
                      scale={scale}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onPageLoadSuccess={onPageLoadSuccess}
                    />
                  </div>

                  {/* Fields overlay */}
                  <div
                    className="absolute top-0 left-0"
                    style={{
                      width: pageSize.width * scale,
                      height: pageSize.height * scale,
                    }}
                  >
                    {currentPageFields.map((field) => {
                      const fieldType = fieldTypes.find(f => f.type === field.type);
                      const Icon = fieldType?.icon || Pen;
                      const colorClass = recipientColors[field.recipientIndex % recipientColors.length];

                      return (
                        <div
                          key={field.id}
                          data-field-id={field.id}
                          className={cn(
                            "absolute border-2 rounded cursor-move flex items-center justify-center gap-1 text-white text-xs font-medium transition-shadow",
                            selectedFieldId === field.id ? "shadow-lg ring-2 ring-offset-2 ring-primary" : "shadow",
                            colorClass,
                            draggedField === field.id && "opacity-75"
                          )}
                          style={{
                            left: field.xPosition * scale,
                            top: field.yPosition * scale,
                            width: field.width * scale,
                            height: field.height * scale,
                          }}
                          onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFieldId(field.id);
                          }}
                        >
                          <Icon className="h-3 w-3" />
                          <span className="truncate">
                            {fieldType?.label} (R{field.recipientIndex + 1})
                          </span>
                          <button
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-0.5 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            style={{ opacity: selectedFieldId === field.id ? 1 : 0 }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {/* Resize handles */}
                          {selectedFieldId === field.id && (
                            <>
                              <div
                                className="absolute top-1/2 -right-1.5 w-3 h-6 -translate-y-1/2 cursor-ew-resize bg-white border-2 border-gray-400 rounded-sm z-20"
                                onMouseDown={(e) => handleResizeMouseDown(e, field.id, "e")}
                              />
                              <div
                                className="absolute -bottom-1.5 left-1/2 h-3 w-6 -translate-x-1/2 cursor-ns-resize bg-white border-2 border-gray-400 rounded-sm z-20"
                                onMouseDown={(e) => handleResizeMouseDown(e, field.id, "s")}
                              />
                              <div
                                className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize bg-white border-2 border-gray-400 rounded-sm z-20"
                                onMouseDown={(e) => handleResizeMouseDown(e, field.id, "se")}
                              />
                            </>
                          )}
                        </div>
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
            {/* Recipient Slots */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recipient Slots</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Define field positions for each recipient. When using this template, you will assign actual recipients to each slot.
                </p>

                <div className="space-y-2">
                  {Array.from({ length: numRecipientSlots }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedRecipientIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        selectedRecipientIndex === index
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      <div className={cn("w-3 h-3 rounded-full", recipientColors[index % recipientColors.length])} />
                      <span>Recipient {index + 1}</span>
                      <span className="ml-auto text-xs opacity-70">
                        {fields.filter(f => f.recipientIndex === index).length} fields
                      </span>
                    </button>
                  ))}
                </div>

                {/* Pre-assign to team members */}
                {teamMembersList.length > 0 && (
                  <div className="space-y-2 border-t pt-2 mt-1">
                    <p className="text-xs text-muted-foreground font-medium">Pre-assign recipients</p>
                    {Array.from({ length: numRecipientSlots }).map((_, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", recipientColors[index % recipientColors.length])} />
                          <span className="text-xs text-muted-foreground">Slot {index + 1}</span>
                        </div>
                        <select
                          className="w-full text-xs border rounded px-2 py-1 bg-background"
                          value={slotAssignments[index]?.email || ""}
                          onChange={(e) => {
                            const selectedEmail = e.target.value;
                            const member = teamMembersList.find((m) => m.user.email === selectedEmail);
                            const updated = [...slotAssignments];
                            while (updated.length <= index) updated.push({ email: "", name: "" });
                            updated[index] = {
                              email: selectedEmail,
                              name: member?.user.name || "",
                            };
                            setSlotAssignments(updated);
                            setHasChanges(true);
                          }}
                        >
                          <option value="">— Not pre-assigned —</option>
                          {teamMembersList.map((m) => (
                            <option key={m.userId} value={m.user.email}>
                              {m.user.name ? `${m.user.name} (${m.user.email})` : m.user.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setNumRecipientSlots(prev => prev + 1);
                    setSlotAssignments(prev => [...prev, { email: "", name: "" }]);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient Slot
                </Button>

                {numRecipientSlots > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      // Remove last recipient slot and its fields
                      const lastIndex = numRecipientSlots - 1;
                      setFields(prev => prev.filter(f => f.recipientIndex !== lastIndex));
                      setNumRecipientSlots(prev => prev - 1);
                      setSlotAssignments(prev => prev.slice(0, lastIndex));
                      if (selectedRecipientIndex >= lastIndex) {
                        setSelectedRecipientIndex(lastIndex - 1);
                      }
                      setHasChanges(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Last Slot
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Field Types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Select a field type and click on the PDF to place it.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {fieldTypes.map((field) => {
                    const Icon = field.icon;
                    return (
                      <button
                        key={field.type}
                        onClick={() => setSelectedFieldType(field.type)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors",
                          selectedFieldType === field.type
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted hover:border-primary/50"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs">{field.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {customFields.map((field) => (
                      <div key={field.type} className="flex gap-1">
                        <button
                          onClick={() => setSelectedFieldType(field.type)}
                          className={cn(
                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                            selectedFieldType === field.type
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-muted hover:border-primary/50"
                          )}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{field.label}</span>
                        </button>
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
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => setShowCustomFieldDialog(true)}
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Add Custom Field
                </Button>
              </CardContent>
            </Card>

            {/* Selected Field Info */}
            {selectedFieldId && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Selected Field</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(() => {
                    const field = fields.find(f => f.id === selectedFieldId);
                    if (!field) return null;

                    const fieldType = fieldTypes.find(f => f.type === field.type);

                    return (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <div className={cn("w-3 h-3 rounded-full", recipientColors[field.recipientIndex % recipientColors.length])} />
                          <span>{(field.type === "date" || field.type === "date_auto") ? "Date" : fieldType?.label} - Recipient {field.recipientIndex + 1}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Page {field.page}, Position: ({Math.round(field.xPosition)}, {Math.round(field.yPosition)})
                        </div>
                        {(field.type === "date" || field.type === "date_auto") && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Date mode</p>
                            <div className="flex rounded-md overflow-hidden border text-xs">
                              <button
                                className={cn("flex-1 px-2 py-1.5 transition-colors", field.type === "date" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                                onClick={() => {
                                  setFields(prev => prev.map(f => f.id === selectedFieldId ? { ...f, type: "date" } : f));
                                  setHasChanges(true);
                                }}
                              >
                                Signer enters
                              </button>
                              <button
                                className={cn("flex-1 px-2 py-1.5 transition-colors border-l", field.type === "date_auto" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                                onClick={() => {
                                  setFields(prev => prev.map(f => f.id === selectedFieldId ? { ...f, type: "date_auto" } : f));
                                  setHasChanges(true);
                                }}
                              >
                                Auto signing date
                              </button>
                            </div>
                          </div>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => removeField(selectedFieldId)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Field
                        </Button>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Instructions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li>1. Select a recipient slot</li>
                  <li>2. Choose a field type</li>
                  <li>3. Click on the PDF to place the field</li>
                  <li>4. Drag fields to reposition them</li>
                  <li>5. Click Save when done</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Custom Field Dialog */}
      <Dialog open={showCustomFieldDialog} onOpenChange={setShowCustomFieldDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Create a custom text field with your own label. Signers will see this as a text input.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-field-label">Field Label</Label>
              <Input
                id="custom-field-label"
                placeholder="e.g. ABN, Tax File Number, Reference No."
                value={newCustomFieldLabel}
                onChange={(e) => setNewCustomFieldLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCustomField(); }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCustomFieldDialog(false); setNewCustomFieldLabel(""); }}>
              Cancel
            </Button>
            <Button onClick={addCustomField}>Add Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
