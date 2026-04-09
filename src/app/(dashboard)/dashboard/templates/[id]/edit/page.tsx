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
  { type: "abn", label: "ABN", icon: Hash, width: 150, height: 30 },
  { type: "address", label: "Street Address", icon: MapPin, width: 200, height: 30 },
  { type: "suburb", label: "Suburb / City", icon: MapPin, width: 150, height: 30 },
  { type: "state", label: "State", icon: Map, width: 100, height: 30 },
  { type: "postcode", label: "Postcode", icon: Hash, width: 100, height: 30 },
  { type: "country", label: "Country", icon: Globe, width: 150, height: 30 },
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
        setNumRecipientSlots(Math.max(1, maxRecipientIndex + 1));
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
      const fieldType = fieldTypes.find(f => f.type === selectedFieldType);
      if (!fieldType) return;

      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const xPosition = Math.max(0, x - fieldType.width / 2);
      const yPosition = Math.max(0, y - fieldType.height / 2);

      addField(xPosition, yPosition);
    },
    [selectedFieldType, scale, currentPage, selectedRecipientIndex]
  );

  const addField = (x: number, y: number) => {
    const fieldType = fieldTypes.find(f => f.type === selectedFieldType);
    if (!fieldType) return;

    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      type: selectedFieldType,
      page: currentPage,
      xPosition: Math.round(x),
      yPosition: Math.round(y),
      width: fieldType.width,
      height: fieldType.height,
      required: true,
      recipientIndex: selectedRecipientIndex,
    };

    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setHasChanges(true);
  };

  const updateFieldPosition = useCallback((id: string, x: number, y: number) => {
    setFields(prev => prev.map(f =>
      f.id === id ? { ...f, xPosition: Math.round(x), yPosition: Math.round(y) } : f
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
    setSelectedFieldId(fieldId);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedField || !pageContainerRef.current) return;

    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - dragOffset.x) / scale;
    const y = (e.clientY - rect.top - dragOffset.y) / scale;

    updateFieldPosition(draggedField, Math.max(0, x), Math.max(0, y));
  }, [draggedField, dragOffset, scale, updateFieldPosition]);

  const handleMouseUp = useCallback(() => {
    setDraggedField(null);
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
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            style={{ opacity: selectedFieldId === field.id ? 1 : 0 }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
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

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setNumRecipientSlots(prev => prev + 1)}
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
                          <span>{fieldType?.label} - Recipient {field.recipientIndex + 1}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Page {field.page}, Position: ({Math.round(field.xPosition)}, {Math.round(field.yPosition)})
                        </div>
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
    </div>
  );
}
