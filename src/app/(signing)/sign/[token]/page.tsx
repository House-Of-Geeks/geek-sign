"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Pen,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Download,
  Type,
  Calendar,
  Shield,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Upload,
  Lock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getFieldTypeInfo, getDropdownOptions } from "@/components/pdf/draggable-field";

// Dynamically import PDF components to avoid SSR issues
const PdfDocument = dynamic(
  () => import("@/components/pdf/pdf-document").then((mod) => mod.PdfDocument),
  { ssr: false }
);

interface SignPageProps {
  params: { token: string };
}

interface Field {
  id: string;
  type: string;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  page: number;
  value: string | null;
  required: boolean;
}

interface DocumentData {
  id: string;
  title: string;
  fileUrl: string | null;
  status: string;
  isFullySigned?: boolean;
  totalRecipients?: number;
  signedCount?: number;
}

interface RecipientData {
  id: string;
  name: string | null;
  email: string;
  status: string;
  consentGiven?: boolean;
}

export default function SignPage({ params }: SignPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [recipient, setRecipient] = useState<RecipientData | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureValue, setSignatureValue] = useState("");
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedInitials, setSavedInitials] = useState<string | null>(null);
  const [saveSignatureChecked, setSaveSignatureChecked] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESIGN consent state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [consentCheckbox, setConsentCheckbox] = useState(false);
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);

  // Text field modal state

  const [textFieldValue, setTextFieldValue] = useState("");

  // Postcodes modal state
  const [showPostcodesModal, setShowPostcodesModal] = useState(false);
  const [postcodesValue, setPostcodesValue] = useState("");

  // Dropdown modal state
  const [showDropdownModal, setShowDropdownModal] = useState(false);

  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const pdfScrollRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    const fetchSigningData = async () => {
      try {
        const response = await fetch(`/api/sign/${params.token}`);

        if (!response.ok) {
          setError("Invalid or expired signing link. Please contact the sender for a new link.");
          setIsLoading(false);
          return;
        }

        const data = await response.json();

        if (data.recipient.status === "signed") {
          setIsComplete(true);
          setDocument(data.document);
          setRecipient(data.recipient);
          setIsLoading(false);
          return;
        }

        setDocument(data.document);
        setRecipient(data.recipient);
        // Auto-fill date_auto fields with today's date
        const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

        // Restore any locally saved progress (fallback for quick refreshes)
        let localProgress: Record<string, string> = {};
        try {
          const saved = localStorage.getItem(`sign-progress-${params.token}`);
          if (saved) localProgress = JSON.parse(saved);
        } catch {}

        setFields((data.fields || []).map((f: { id: string; type: string; value?: string | null }) => {
          if (f.type === "date_auto") return { ...f, value: today };
          // Server value takes priority; fall back to localStorage
          return { ...f, value: f.value || localProgress[f.id] || null };
        }));
        setSavedSignature(data.savedSignature ?? null);
        setSavedInitials(data.savedInitials ?? null);

        // Check if consent was already given
        if (data.recipient.consentGiven) {
          setHasConsented(true);
        } else {
          // Show consent modal for new signers
          setShowConsentModal(true);
        }

        setIsLoading(false);
      } catch (err) {
        setError("An error occurred while loading the document.");
        setIsLoading(false);
      }
    };

    fetchSigningData();
  }, [params.token]);

  const handleConsentSubmit = async () => {
    if (!consentCheckbox) {
      toast({
        title: "Consent required",
        description: "Please check the box to confirm you agree to sign electronically.",
        variant: "destructive",
      });
      return;
    }

    setIsRecordingConsent(true);

    try {
      const response = await fetch(`/api/sign/${params.token}/consent`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to record consent");

      setHasConsented(true);
      setShowConsentModal(false);
      toast({
        title: "Consent recorded",
        description: "You can now proceed to sign the document.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to record consent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRecordingConsent(false);
    }
  };

  const handleFieldClick = (index: number) => {
    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    setCurrentFieldIndex(index);
    const field = fields[index];
    const { baseType } = getFieldTypeInfo(field.type);

    // Navigate to the page where this field lives
    if (field.page && field.page !== currentPage) {
      setCurrentPage(field.page);
    }

    // Sender-fill fields are read-only — recipients cannot edit them
    if (field.type.startsWith("sender_")) {
      return;
    }

    if (baseType === "signature" || baseType === "initials") {
      setShowSignatureModal(true);
    } else if (baseType === "checkbox") {
      // Toggle checkbox immediately — no modal needed
      const updatedFields = [...fields];
      updatedFields[index] = {
        ...updatedFields[index],
        value: updatedFields[index].value === "checked" ? "" : "checked",
      };
      setFields(updatedFields);
    } else if (baseType === "date_auto") {
      // Auto-filled — nothing for signer to do
      return;
    } else if (baseType === "date") {
      handleDateFieldClick(index);
    } else if (baseType === "postcodes") {
      setPostcodesValue(field.value || "");
      setShowPostcodesModal(true);
    } else if (baseType === "dropdown") {
      setShowDropdownModal(true);
    } else {
      // Show inline input bar — no modal, PDF stays visible
      setTextFieldValue(field.value || "");
    }
  };

  const clearField = (index: number) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], value: null };
    setFields(updatedFields);
  };

  // Fields the inline bar handles (everything except signature, checkbox, postcodes, dropdown, sender, date_auto)
  const isInlineTextField = (field: { type: string } | undefined) => {
    if (!field) return false;
    const { baseType } = getFieldTypeInfo(field.type);
    return !["signature", "initials", "checkbox", "date_auto", "postcodes", "dropdown"].includes(baseType)
      && !field.type.startsWith("sender_");
  };

  // All navigable (non-sender, non-date_auto) fields with their global indices
  const navigableFields = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !f.type.startsWith("sender_") && f.type !== "date_auto");

  const currentNavIdx = navigableFields.findIndex(({ i }) => i === currentFieldIndex);

  const applyInlineValue = (updatedFields: typeof fields) => {
    // After saving current text field, move to the next navigable field
    const nextItem = navigableFields[currentNavIdx + 1];
    if (!nextItem) {
      setCurrentFieldIndex(-1);
      setTextFieldValue("");
      return;
    }
    const { f: nextField, i: nextIndex } = nextItem;
    const { baseType: nextBaseType } = getFieldTypeInfo(nextField.type);
    if (nextField.page !== currentPage) setCurrentPage(nextField.page);
    setCurrentFieldIndex(nextIndex);
    if (nextBaseType === "signature" || nextBaseType === "initials") {
      setTextFieldValue("");
      setShowSignatureModal(true);
    } else if (nextBaseType === "checkbox") {
      setTextFieldValue("");
    } else if (nextBaseType === "postcodes") {
      setPostcodesValue(updatedFields[nextIndex]?.value || "");
      setTextFieldValue("");
      setShowPostcodesModal(true);
    } else if (nextBaseType === "dropdown") {
      setTextFieldValue("");
      setShowDropdownModal(true);
    } else if (nextBaseType === "date") {
      setTextFieldValue("");
      handleDateFieldClick(nextIndex);
    } else {
      setTextFieldValue(updatedFields[nextIndex]?.value || "");
    }
  };

  const handleInlineNext = () => {
    const currentField = fields[currentFieldIndex];
    if (!textFieldValue.trim() && currentField?.required !== false) {
      const { label: fieldLabel } = getFieldTypeInfo(currentField?.type || "");
      toast({
        title: "Value required",
        description: `Please enter your ${fieldLabel.toLowerCase()}.`,
        variant: "destructive",
      });
      return;
    }
    const updatedFields = [...fields];
    updatedFields[currentFieldIndex] = {
      ...updatedFields[currentFieldIndex],
      value: textFieldValue.trim() || null,
    };
    setFields(updatedFields);
    setTextFieldValue("");
    applyInlineValue(updatedFields);
  };

  const handleInlineSkip = () => {
    // Clear the optional field and advance
    const updatedFields = [...fields];
    updatedFields[currentFieldIndex] = {
      ...updatedFields[currentFieldIndex],
      value: null,
    };
    setFields(updatedFields);
    setTextFieldValue("");
    applyInlineValue(updatedFields);
  };

  const handleInlinePrev = () => {
    // Save current draft silently
    if (currentFieldIndex >= 0 && isInlineTextField(fields[currentFieldIndex])) {
      const updatedFields = [...fields];
      updatedFields[currentFieldIndex] = {
        ...updatedFields[currentFieldIndex],
        value: textFieldValue.trim() || null,
      };
      setFields(updatedFields);
    }
    const prevItem = navigableFields[currentNavIdx - 1];
    if (!prevItem) return;
    const { f: prevField, i: prevIndex } = prevItem;
    if (prevField.page !== currentPage) setCurrentPage(prevField.page);
    setCurrentFieldIndex(prevIndex);
    if (isInlineTextField(prevField)) {
      setTextFieldValue(prevField.value || "");
    } else {
      setTextFieldValue("");
    }
  };

  const handleSignatureSubmit = async () => {
    if (!signatureValue.trim()) {
      toast({
        title: "Signature required",
        description: "Please type your signature.",
        variant: "destructive",
      });
      return;
    }

    const isInitials = fields[currentFieldIndex]?.type === "initials";

    const updatedFields = [...fields];
    updatedFields[currentFieldIndex] = {
      ...updatedFields[currentFieldIndex],
      value: signatureValue,
    };
    setFields(updatedFields);
    setShowSignatureModal(false);

    // Save signature for next time if checked
    if (saveSignatureChecked) {
      const body = isInitials
        ? { initials: signatureValue }
        : { signature: signatureValue };
      await fetch(`/api/sign/${params.token}/save-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (isInitials) setSavedInitials(signatureValue);
      else setSavedSignature(signatureValue);
    }

    setSaveSignatureChecked(false);
    setSignatureValue("");

    applyInlineValue(updatedFields);
  };

  const handleDateFieldClick = (index: number) => {
    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], value: today };
    setFields(updatedFields);
  };

  const handlePostcodesSubmit = () => {
    if (!postcodesValue.trim()) {
      toast({ title: "Postcodes required", description: "Please enter or upload postcodes.", variant: "destructive" });
      return;
    }
    const updatedFields = [...fields];
    updatedFields[currentFieldIndex] = { ...updatedFields[currentFieldIndex], value: postcodesValue.trim() };
    setFields(updatedFields);
    setShowPostcodesModal(false);
    setPostcodesValue("");
    applyInlineValue(updatedFields);
  };

  const handlePostcodesFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Parse postcodes: split by comma, newline, semicolon, or tab
      const postcodes = text
        .split(/[\n,;\t]+/)
        .map(p => p.trim())
        .filter(Boolean)
        .join("\n");
      setPostcodesValue(postcodes);
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-uploaded
    e.target.value = "";
  };

  const handleDropdownSelect = (option: string) => {
    const updatedFields = [...fields];
    updatedFields[currentFieldIndex] = { ...updatedFields[currentFieldIndex], value: option };
    setFields(updatedFields);
    setShowDropdownModal(false);
    const nextUnsigned = updatedFields.findIndex((f, i) => i > currentFieldIndex && !f.value);
    if (nextUnsigned !== -1) setCurrentFieldIndex(nextUnsigned);
  };

  const allFieldsComplete = fields.every((f) => {
    if (!f.required) return true;
    const { baseType } = getFieldTypeInfo(f.type);
    if (baseType === "checkbox") return f.value === "checked";
    return f.value && f.value.trim() !== "";
  });

  const handleComplete = async () => {
    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    if (!allFieldsComplete) {
      toast({
        title: "Incomplete fields",
        description: "Please complete all required fields before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSigning(true);

    try {
      const response = await fetch(`/api/sign/${params.token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) throw new Error("Failed to submit signature");

      setIsComplete(true);
      toast({
        title: "Document signed!",
        description: "Thank you for signing. The sender will be notified.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to submit signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  };

  const onPageLoadSuccess = (page: { width: number; height: number }) => {
    setPageSize({ width: page.width, height: page.height });
  };

  // Auto-save progress whenever field values change
  useEffect(() => {
    const filledFields = fields.filter((f) => f.value && !f.type.startsWith("sender_"));
    if (filledFields.length === 0) return;

    // 1. Save immediately to localStorage (survives quick refreshes)
    const progress = filledFields.reduce<Record<string, string>>((acc, f) => {
      if (f.id && f.value) acc[f.id] = f.value;
      return acc;
    }, {});
    try {
      localStorage.setItem(`sign-progress-${params.token}`, JSON.stringify(progress));
    } catch {}

    // 2. Debounce server save (survives cross-device / incognito)
    const timer = setTimeout(() => {
      fetch(`/api/sign/${params.token}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: filledFields.map((f) => ({ id: f.id, value: f.value })),
        }),
      }).catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
  }, [fields]);

  // Scroll to field when currentFieldIndex changes (from sidebar click)
  useEffect(() => {
    if (currentFieldIndex < 0 || currentFieldIndex >= fields.length) return;
    const field = fields[currentFieldIndex];
    if (!field || !pdfScrollRef.current) return;
    const timer = setTimeout(() => {
      if (!pdfScrollRef.current) return;
      const containerHeight = pdfScrollRef.current.clientHeight;
      const fieldCenterY = field.yPosition * scale;
      const scrollTo = fieldCenterY - containerHeight / 2 + (field.height * scale) / 2;
      pdfScrollRef.current.scrollTo({ top: Math.max(0, scrollTo), behavior: "smooth" });
    }, 50);
    return () => clearTimeout(timer);
  }, [currentFieldIndex, currentPage]);

  // Focus inline input whenever the active field changes to a text-type field
  useEffect(() => {
    if (currentFieldIndex < 0 || !isInlineTextField(fields[currentFieldIndex])) return;
    const timer = setTimeout(() => inlineInputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [currentFieldIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get fields for current page
  const currentPageFields = fields.filter(f => f.page === currentPage);

  if (isLoading) {
    return (
      <div className="container py-16 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Document</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/sign/${params.token}/download`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document?.title || "document"}-signed.pdf`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

      toast({
        title: "Download started",
        description: "Your signed document is being downloaded.",
      });
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Failed to download document.",
        variant: "destructive",
      });
    }
  };

  if (isComplete) {
    const isFullySigned = document?.isFullySigned;
    const totalRecipients = document?.totalRecipients || 1;
    const signedCount = document?.signedCount || 1;
    const pendingCount = totalRecipients - signedCount;

    return (
      <div className="container py-16 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Document Signed!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for signing &ldquo;{document?.title}&rdquo;. The sender has been notified.
            </p>

            {isFullySigned ? (
              <>
                <p className="text-sm text-green-600 font-medium mb-6">
                  All parties have signed. Your document is complete!
                </p>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Signed Document
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
                <p className="text-sm text-amber-800">
                  <strong>Waiting for {pendingCount} more {pendingCount === 1 ? "party" : "parties"}</strong> to sign.
                  You will receive the completed document via email once all parties have signed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="grid gap-8 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* All fields complete — prominent CTA */}
          {allFieldsComplete && hasConsented && (
            <div className="rounded-xl border-2 border-green-400 bg-green-50 p-4 shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm font-semibold text-green-800">All required fields complete!</p>
              </div>
              <Button
                onClick={handleComplete}
                disabled={isSigning}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                {isSigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete Signing
                  </>
                )}
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Document</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{document?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Sent to {recipient?.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consent Status */}
          <Card className={hasConsented ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Shield className={cn("h-5 w-5", hasConsented ? "text-green-600" : "text-amber-600")} />
                <div>
                  <p className="text-sm font-medium">
                    {hasConsented ? "ESIGN Consent Given" : "Consent Required"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasConsented
                      ? "You agreed to sign electronically"
                      : "Please review and accept terms"}
                  </p>
                </div>
                {!hasConsented && (
                  <Button size="sm" variant="outline" onClick={() => setShowConsentModal(true)}>
                    Review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fields to Complete</CardTitle>
              <CardDescription>
                {fields.filter((f) => f.value && !f.type.startsWith("sender_")).length} of {fields.filter((f) => !f.type.startsWith("sender_")).length} completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const { baseType, label: fieldLabel } = getFieldTypeInfo(field.type);
                  const isSenderFill = field.type.startsWith("sender_");

                  if (isSenderFill) {
                    return (
                      <div
                        key={field.id}
                        className="w-full flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left"
                      >
                        <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-amber-800 truncate">{fieldLabel}</p>
                          <p className="text-xs text-amber-600">Pre-filled by sender</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      </div>
                    );
                  }

                  return (
                    <div key={field.id} className="relative">
                      <button
                        onClick={() => handleFieldClick(index)}
                        disabled={!hasConsented}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          !hasConsented && "opacity-50 cursor-not-allowed",
                          field.value
                            ? "border-green-200 bg-green-50"
                            : currentFieldIndex === index
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted",
                          !field.required && field.value && !field.type.startsWith("sender_") && "pr-9"
                        )}
                      >
                        {baseType === "signature" && <Pen className="h-4 w-4" />}
                        {baseType === "initials" && <Type className="h-4 w-4" />}
                        {(baseType === "date" || baseType === "date_auto") && <Calendar className="h-4 w-4" />}
                        {(baseType === "text" || baseType === "name" || baseType === "email" || baseType === "address" || baseType === "title" || baseType === "custom") && <Type className="h-4 w-4" />}
                        {baseType === "checkbox" && (
                          <div className={cn("h-4 w-4 rounded border-2 flex items-center justify-center shrink-0", field.value === "checked" ? "border-green-500 bg-green-100" : "border-muted-foreground")}>
                            {field.value === "checked" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{fieldLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {baseType === "checkbox"
                              ? field.value === "checked" ? "Checked" : !field.required ? "Optional — click to check" : "Click to check"
                              : baseType === "date_auto" ? "Auto-filled" : field.value ? "Completed" : !field.required ? "Optional" : "Click to fill"}
                          </p>
                        </div>
                        {field.value && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                      </button>
                      {!field.required && field.value && !field.type.startsWith("sender_") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); clearField(index); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Clear field"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleComplete}
            disabled={!hasConsented || !allFieldsComplete || isSigning}
            className="w-full"
            size="lg"
          >
            {isSigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete Signing
              </>
            )}
          </Button>
        </div>

        {/* Document Preview */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <Card>
            <CardContent className="p-4">
              {/* PDF Controls */}
              {document?.fileUrl && numPages > 1 && (
                <div className="flex items-center justify-between border-b pb-3 mb-4">
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
                      Page {currentPage} of {numPages}
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
              )}

              <div ref={pdfScrollRef} className="flex justify-center overflow-auto">
                {document?.fileUrl ? (
                  <div
                    ref={pageContainerRef}
                    className="relative shadow-lg bg-white"
                  >
                    {pdfLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white z-10 min-h-[600px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <PdfDocument
                      fileUrl={document.fileUrl}
                      currentPage={currentPage}
                      scale={scale}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onPageLoadSuccess={onPageLoadSuccess}
                    />

                    {/* Fields overlay */}
                    <div
                      className="absolute top-0 left-0"
                      style={{
                        width: pageSize.width * scale,
                        height: pageSize.height * scale,
                      }}
                    >
                      {currentPageFields.map((field, index) => {
                        const globalIndex = fields.findIndex(f => f.id === field.id);
                        const { baseType, label: fieldLabel } = getFieldTypeInfo(field.type);
                        const isSenderFill = field.type.startsWith("sender_");

                        if (isSenderFill) {
                          return (
                            <div
                              key={field.id}
                              className="absolute rounded overflow-hidden border border-amber-200 bg-transparent"
                              style={{
                                left: field.xPosition * scale,
                                top: field.yPosition * scale,
                                width: field.width * scale,
                                height: field.height * scale,
                              }}
                            >
                              <span
                                className="block w-full h-full text-gray-800 p-1 overflow-hidden leading-snug"
                                style={{ fontSize: `${Math.max(8, 11 * scale)}px` }}
                              >
                                {field.value || ""}
                              </span>
                            </div>
                          );
                        }

                        if (baseType === "checkbox") {
                          return (
                            <button
                              key={field.id}
                              onClick={() => handleFieldClick(globalIndex)}
                              disabled={!hasConsented}
                              className={cn(
                                "absolute rounded transition-all flex items-center justify-center border-2",
                                !hasConsented && "opacity-50 cursor-not-allowed",
                                hasConsented && "cursor-pointer",
                                globalIndex === currentFieldIndex && "border-orange-500 ring-2 ring-orange-400 ring-offset-1 shadow-lg animate-pulse",
                                field.value === "checked"
                                  ? "border-green-500 bg-green-100"
                                  : "border-primary bg-white hover:bg-primary/10"
                              )}
                              style={{
                                left: field.xPosition * scale,
                                top: field.yPosition * scale,
                                width: field.width * scale,
                                height: field.height * scale,
                              }}
                            >
                              {field.value === "checked" && (
                                <CheckCircle2
                                  className="text-green-600"
                                  style={{ width: field.width * scale * 0.7, height: field.height * scale * 0.7 }}
                                />
                              )}
                            </button>
                          );
                        }

                        const isActive = globalIndex === currentFieldIndex;
                        return (
                          <button
                            key={field.id}
                            onClick={() => handleFieldClick(globalIndex)}
                            disabled={!hasConsented}
                            className={cn(
                              "absolute border-2 rounded transition-all flex items-center justify-center",
                              !hasConsented && "opacity-50 cursor-not-allowed",
                              hasConsented && "cursor-pointer",
                              isActive
                                ? "border-orange-500 bg-orange-100 ring-2 ring-orange-400 ring-offset-1 shadow-lg animate-pulse"
                                : field.value
                                ? "border-green-500 bg-green-50/90"
                                : "border-primary bg-primary/10 hover:bg-primary/20"
                            )}
                            style={{
                              left: field.xPosition * scale,
                              top: field.yPosition * scale,
                              width: field.width * scale,
                              height: field.height * scale,
                            }}
                          >
                            {field.value ? (
                              <span
                                className="text-sm font-medium text-gray-800 p-1 truncate w-full text-center"
                                style={{ fontFamily: baseType === "signature" || baseType === "initials" ? "cursive" : "inherit" }}
                              >
                                {field.value}
                              </span>
                            ) : (
                              <span className="text-xs text-primary">
                                Click to add {fieldLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[8.5/11] w-full max-w-2xl rounded-lg border bg-white flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <FileText className="h-16 w-16 mx-auto mb-4" />
                      <p>No document available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inline Field Input Bar */}
          {currentFieldIndex >= 0 && isInlineTextField(fields[currentFieldIndex]) && (() => {
            const currentField = fields[currentFieldIndex];
            const { label: fieldLabel } = getFieldTypeInfo(currentField.type);
            const isLast = currentNavIdx === navigableFields.length - 1;
            const isFirst = currentNavIdx === 0;
            return (
              <Card className="border-primary/40 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-end gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleInlinePrev}
                      disabled={isFirst}
                      title="Previous field"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{fieldLabel}</span>
                        {currentField.required === false && (
                          <span className="text-xs border rounded px-1.5 py-0.5 text-muted-foreground">Optional</span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {currentNavIdx + 1} of {navigableFields.length}
                        </span>
                      </div>
                      {currentField.type === "paragraph" ? (
                        <Textarea
                          ref={inlineInputRef}
                          placeholder={`Enter ${fieldLabel.toLowerCase()}...`}
                          value={textFieldValue}
                          onChange={(e) => setTextFieldValue(e.target.value)}
                          className="min-h-[80px]"
                        />
                      ) : (
                        <Input
                          ref={inlineInputRef}
                          type={currentField.type === "number" ? "number" : "text"}
                          placeholder={`Enter your ${fieldLabel.toLowerCase()}`}
                          value={textFieldValue}
                          onChange={(e) => setTextFieldValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleInlineNext(); }}
                          className="text-base"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {currentField.required === false && currentField.value && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { clearField(currentFieldIndex); setTextFieldValue(""); }}
                          className="text-muted-foreground hover:text-destructive"
                          title="Clear field"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {currentField.required === false && !isLast && (
                        <Button variant="outline" onClick={handleInlineSkip} className="whitespace-nowrap">
                          Skip
                        </Button>
                      )}
                      <Button onClick={handleInlineNext} className="whitespace-nowrap">
                        {isLast ? "Done" : "Next →"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>

      {/* ESIGN Consent Modal */}
      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Electronic Signature Consent
            </DialogTitle>
            <DialogDescription>
              Please review and accept the following disclosures before signing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* ESIGN Act Disclosure */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                ESIGN Act Disclosure
              </h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  In accordance with the Electronic Signatures in Global and National
                  Commerce Act (ESIGN Act, 15 U.S.C. 7001 et seq.) and the Uniform
                  Electronic Transactions Act (UETA), you are being asked to consent
                  to the use of electronic signatures and electronic records.
                </p>
                <p><strong>By providing your electronic signature, you acknowledge and agree that:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your electronic signature has the same legal effect as a handwritten signature.</li>
                  <li>You intend to sign this document electronically.</li>
                  <li>You consent to receive documents and notices electronically.</li>
                  <li>You have the ability to access and retain electronic records.</li>
                </ul>
              </div>
            </div>

            {/* Your Rights */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold">Your Rights</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Right to Paper Copy:</strong> You have the right to request a
                    paper copy of any document. Contact the sender to request one.
                  </li>
                  <li>
                    <strong>Right to Withdraw Consent:</strong> You may withdraw your consent
                    at any time by declining to sign. Simply close this window without signing.
                  </li>
                  <li>
                    <strong>No Penalty:</strong> There is no penalty for declining to sign
                    electronically. You may request to sign via paper instead.
                  </li>
                </ul>
              </div>
            </div>

            {/* Technical Requirements */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="font-semibold">Technical Requirements</h3>
              <div className="text-sm text-muted-foreground">
                <p>To access and retain electronic records, you need:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>A web browser (Chrome, Firefox, Safari, Edge)</li>
                  <li>A valid email address to receive documents</li>
                  <li>Sufficient storage to save/print documents</li>
                </ul>
              </div>
            </div>

            {/* Legal Notice */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Legal Notice:</strong> By checking the box below and clicking
                &ldquo;I Agree & Continue&rdquo;, you are signing this disclosure electronically.
                You agree that your electronic signature is the legal equivalent of your
                manual signature.
              </p>
            </div>

            {/* Consent Checkbox */}
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox
                id="consent"
                checked={consentCheckbox}
                onCheckedChange={(checked) => setConsentCheckbox(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="consent" className="font-medium cursor-pointer">
                  I have read and agree to the above disclosures
                </Label>
                <p className="text-sm text-muted-foreground">
                  I consent to sign &ldquo;{document?.title}&rdquo; electronically and
                  acknowledge that my electronic signature is legally binding. I also
                  agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConsentModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConsentSubmit}
              disabled={!consentCheckbox || isRecordingConsent}
              className="flex-1"
            >
              {isRecordingConsent ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  I Agree & Continue
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signature Modal */}
      <Dialog open={showSignatureModal} onOpenChange={(open) => { setShowSignatureModal(open); if (!open) { setSignatureValue(""); setSaveSignatureChecked(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fields[currentFieldIndex]?.type === "signature"
                ? "Add Your Signature"
                : "Add Your Initials"}
            </DialogTitle>
            <DialogDescription>
              Type your {fields[currentFieldIndex]?.type} below. This will be legally binding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Use saved signature button */}
            {(fields[currentFieldIndex]?.type === "signature" ? savedSignature : savedInitials) && !signatureValue && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSignatureValue(
                  fields[currentFieldIndex]?.type === "signature" ? savedSignature! : savedInitials!
                )}
              >
                Use saved {fields[currentFieldIndex]?.type === "signature" ? "signature" : "initials"}: <span className="ml-2 font-cursive italic">{fields[currentFieldIndex]?.type === "signature" ? savedSignature : savedInitials}</span>
              </Button>
            )}
            <div className="space-y-2">
              <Label htmlFor="signature">
                {fields[currentFieldIndex]?.type === "signature"
                  ? "Full Name"
                  : "Initials"}
              </Label>
              <Input
                id="signature"
                placeholder={
                  fields[currentFieldIndex]?.type === "signature"
                    ? "Type your full name"
                    : "Type your initials"
                }
                value={signatureValue}
                onChange={(e) => setSignatureValue(e.target.value)}
                className="text-lg"
              />
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground mb-2">Preview:</p>
              <p
                className="text-2xl text-center py-4"
                style={{ fontFamily: "cursive" }}
              >
                {signatureValue || "Your signature will appear here"}
              </p>
            </div>
            {/* Save for next time */}
            {signatureValue && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-signature"
                  checked={saveSignatureChecked}
                  onCheckedChange={(v) => setSaveSignatureChecked(!!v)}
                />
                <Label htmlFor="save-signature" className="text-sm cursor-pointer">
                  Save for next time
                </Label>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => { setShowSignatureModal(false); setSignatureValue(""); setSaveSignatureChecked(false); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleSignatureSubmit} className="flex-1">
              Apply {fields[currentFieldIndex]?.type === "signature" ? "Signature" : "Initials"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Postcodes Modal */}
      <Dialog open={showPostcodesModal} onOpenChange={(open) => { setShowPostcodesModal(open); if (!open) setPostcodesValue(""); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enter Postcodes</DialogTitle>
            <DialogDescription>
              Paste your postcodes below (one per line or comma-separated), or upload a CSV/text file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder={"3000\n3001\n3002\nor: 3000, 3001, 3002"}
              value={postcodesValue}
              onChange={(e) => setPostcodesValue(e.target.value)}
              className="min-h-[160px] font-mono text-sm"
            />
            <div>
              <Label htmlFor="postcode-file" className="text-sm text-muted-foreground mb-2 block">
                Or upload a CSV / text file:
              </Label>
              <label
                htmlFor="postcode-file"
                className="flex items-center gap-2 cursor-pointer w-fit rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Upload className="h-4 w-4" />
                Choose file
              </label>
              <input
                id="postcode-file"
                type="file"
                accept=".csv,.txt,.tsv"
                className="sr-only"
                onChange={handlePostcodesFileUpload}
              />
            </div>
            {postcodesValue && (
              <p className="text-xs text-muted-foreground">
                {postcodesValue.split(/[\n,]+/).filter(p => p.trim()).length} postcode(s) entered
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {fields[currentFieldIndex]?.required === false && fields[currentFieldIndex]?.value && (
              <Button
                variant="ghost"
                onClick={() => { clearField(currentFieldIndex); setShowPostcodesModal(false); setPostcodesValue(""); }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button variant="outline" onClick={() => { setShowPostcodesModal(false); setPostcodesValue(""); }} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handlePostcodesSubmit} className="flex-1">
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dropdown Modal */}
      <Dialog open={showDropdownModal} onOpenChange={setShowDropdownModal}>
        <DialogContent className="sm:max-w-sm">
          {(() => {
            const currentField = fields[currentFieldIndex];
            const { label: fieldLabel } = currentField ? getFieldTypeInfo(currentField.type) : { label: "Option" };
            const options = currentField ? getDropdownOptions(currentField.type) : [];
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{fieldLabel}</DialogTitle>
                  <DialogDescription>Select an option below.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  {options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleDropdownSelect(option)}
                      className={cn(
                        "w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-primary/10 hover:border-primary",
                        currentField?.value === option && "bg-primary/10 border-primary font-medium"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => setShowDropdownModal(false)} className="w-full">
                  Cancel
                </Button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
