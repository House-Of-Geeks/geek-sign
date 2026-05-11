"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  PenLine,
  FileSignature,
} from "lucide-react";
import { SigningFieldSignerNode } from "./nodes/signing-field-signer-node";
import { VariableNode } from "./nodes/variable-node";
import { SignerProvider, type SignerFieldState } from "./signer-context";
import { jurisdictionConfig, type Jurisdiction } from "@/config/jurisdiction";

interface ServerField {
  id: string;
  type: string;
  fieldKey: string | null;
  page: number;
  value: string | null;
  required: boolean;
}

interface RichTextSignerProps {
  token: string;
  documentId: string;
  documentTitle: string;
  content: unknown;
  rolesById: Record<string, { label: string; color: string }>;
  recipient: {
    id: string;
    name: string | null;
    email: string;
    consentGiven: boolean;
  };
  fields: ServerField[];
  otherSignedFields: Array<{ fieldKey: string | null; value: string | null }>;
  savedSignature: string | null;
  savedInitials: string | null;
  jurisdiction: Jurisdiction;
  isFullySigned: boolean;
}

type InputModalMode = "signature" | "initials" | "date" | "text";

export function RichTextSigner({
  token,
  documentTitle,
  content,
  rolesById,
  recipient,
  fields: initialFields,
  otherSignedFields,
  savedSignature: initialSavedSignature,
  savedInitials: initialSavedInitials,
  jurisdiction,
  isFullySigned,
}: RichTextSignerProps) {
  const { toast } = useToast();

  const [fields, setFields] = useState<ServerField[]>(initialFields);
  const [hasConsented, setHasConsented] = useState(recipient.consentGiven);
  const [showConsentModal, setShowConsentModal] = useState(!recipient.consentGiven);
  const [consentCheckbox, setConsentCheckbox] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);

  const [savedSignature, setSavedSignature] = useState(initialSavedSignature);
  const [savedInitials, setSavedInitials] = useState(initialSavedInitials);

  // Input modal (signature/initials/date/text share one dialog)
  const [inputOpen, setInputOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputModalMode>("signature");
  const [inputFieldKey, setInputFieldKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saveSignatureChecked, setSaveSignatureChecked] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(isFullySigned || recipient.consentGiven === undefined);

  // Build helper maps for the signer context
  const fieldsByKey = useMemo(() => {
    const map: Record<string, SignerFieldState> = {};
    // Own fields (mutable)
    for (const f of fields) {
      if (!f.fieldKey) continue;
      map[f.fieldKey] = {
        id: f.id,
        fieldKey: f.fieldKey,
        type: f.type,
        recipientId: recipient.id,
        value: f.value,
        required: f.required,
      };
    }
    // Other recipients' fields (read-only — keyed by fieldKey but with a synthetic id)
    for (const o of otherSignedFields) {
      if (!o.fieldKey || map[o.fieldKey]) continue;
      map[o.fieldKey] = {
        id: `other-${o.fieldKey}`,
        fieldKey: o.fieldKey,
        type: "text",
        recipientId: "__other__",
        value: o.value,
        required: false,
      };
    }
    return map;
  }, [fields, otherSignedFields, recipient.id]);

  // Save progress to server every 4s when dirty
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      void fetch(`/api/sign/${token}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.map((f) => ({ id: f.id, value: f.value })),
        }),
      }).catch(() => {});
      dirtyRef.current = false;
    }, 1500);
    return () => clearTimeout(t);
  }, [fields, token]);

  const setFieldValue = (fieldKey: string, value: string | null) => {
    setFields((prev) => {
      const next = prev.map((f) =>
        f.fieldKey === fieldKey ? { ...f, value } : f
      );
      dirtyRef.current = true;
      return next;
    });
  };

  const openInput = (
    fieldKey: string,
    mode: InputModalMode,
    initial: string
  ) => {
    setInputFieldKey(fieldKey);
    setInputMode(mode);
    setInputValue(initial);
    setSaveSignatureChecked(false);
    setInputOpen(true);
  };

  const requestSignature = (fieldKey: string, kind: "signature" | "initials") => {
    const current = fields.find((f) => f.fieldKey === fieldKey)?.value ?? "";
    openInput(fieldKey, kind, current);
  };

  const requestDate = (fieldKey: string) => {
    const existing = fields.find((f) => f.fieldKey === fieldKey)?.value ?? "";
    const todayISO = new Date().toISOString().slice(0, 10);
    let iso = todayISO;
    if (existing) {
      const parsed = new Date(existing);
      if (!isNaN(parsed.getTime())) iso = parsed.toISOString().slice(0, 10);
    }
    openInput(fieldKey, "date", iso);
  };

  const applyInputValue = async () => {
    if (!inputFieldKey) return;
    const trimmed = inputValue.trim();
    if (!trimmed) {
      toast({
        title: "Please enter a value",
        variant: "destructive",
      });
      return;
    }
    let stored = trimmed;
    if (inputMode === "date") {
      const d = new Date(trimmed);
      stored = isNaN(d.getTime())
        ? trimmed
        : d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
    }
    setFieldValue(inputFieldKey, stored);

    if ((inputMode === "signature" || inputMode === "initials") && saveSignatureChecked) {
      try {
        await fetch(`/api/sign/${token}/save-signature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            inputMode === "signature"
              ? { signature: trimmed }
              : { initials: trimmed }
          ),
        });
        if (inputMode === "signature") setSavedSignature(trimmed);
        else setSavedInitials(trimmed);
      } catch {
        /* non-fatal */
      }
    }

    setInputOpen(false);
    setInputValue("");
    setInputFieldKey(null);
  };

  const handleConsentSubmit = async () => {
    if (!consentCheckbox) {
      toast({
        title: "Consent required",
        description: "Please check the box to confirm.",
        variant: "destructive",
      });
      return;
    }
    setRecordingConsent(true);
    try {
      const res = await fetch(`/api/sign/${token}/consent`, { method: "POST" });
      if (!res.ok) throw new Error();
      setHasConsented(true);
      setShowConsentModal(false);
    } catch {
      toast({
        title: "Couldn't record consent",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRecordingConsent(false);
    }
  };

  const handleSubmit = async () => {
    const missing = fields.filter((f) => f.required && !(f.value && f.value.trim()));
    if (missing.length > 0) {
      toast({
        title: "Required fields incomplete",
        description: `${missing.length} field${missing.length === 1 ? "" : "s"} still need filling.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: fields.map((f) => ({ id: f.id, value: f.value })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }
      setCompleted(true);
      toast({
        title: "Signed!",
        description: data.documentCompleted
          ? "All parties have signed — you'll receive the final copy shortly."
          : "Your signature has been recorded.",
      });
    } catch (e) {
      toast({
        title: "Couldn't submit",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      SigningFieldSignerNode,
      VariableNode,
    ],
    content: (content as object | undefined) ?? { type: "doc", content: [] },
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-12 py-10 focus:outline-none",
      },
    },
  });

  const totalRequired = fields.filter((f) => f.required).length;
  const filledRequired = fields.filter((f) => f.required && f.value && f.value.trim()).length;

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
        <h1 className="mt-4 text-2xl font-bold">Document signed</h1>
        <p className="mt-2 text-muted-foreground">
          Your signature has been recorded for &ldquo;{documentTitle}&rdquo;.
          You&apos;ll get a copy by email when all parties have signed.
        </p>
      </div>
    );
  }

  const jurisdictionLabel = jurisdictionConfig[jurisdiction]?.consentTitle ?? "";
  const jurisdictionDesc = jurisdictionConfig[jurisdiction]?.consentIntro ?? "";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <FileSignature className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-semibold leading-tight">{documentTitle}</h1>
              <p className="text-xs text-muted-foreground">
                Signing as {recipient.name || recipient.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">
              {filledRequired} / {totalRequired} required
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !hasConsented}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <PenLine className="mr-2 h-4 w-4" /> Sign &amp; submit
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-lg border bg-white shadow-sm">
          <SignerProvider
            value={{
              currentRecipientId: recipient.id,
              fieldsByKey,
              rolesById,
              onRequestSignature: requestSignature,
              onRequestDate: requestDate,
              onChangeValue: setFieldValue,
              hasConsented,
              onConsentRequired: () => setShowConsentModal(true),
            }}
          >
            <EditorContent editor={editor} />
          </SignerProvider>
        </div>
      </main>

      {/* Consent dialog */}
      <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {jurisdictionLabel || "Consent to sign electronically"}
            </DialogTitle>
            <DialogDescription>
              {jurisdictionDesc ||
                "By signing this document electronically, you agree to be legally bound by your signature."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 py-2">
            <Checkbox
              id="consent"
              checked={consentCheckbox}
              onCheckedChange={(v) => setConsentCheckbox(!!v)}
              className="mt-0.5"
            />
            <Label htmlFor="consent" className="cursor-pointer text-sm leading-relaxed">
              I agree to sign this document electronically and confirm my
              identity and intent to be bound.
            </Label>
          </div>
          <Button onClick={handleConsentSubmit} disabled={recordingConsent}>
            {recordingConsent ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" /> I agree &amp; continue
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Input dialog (signature/initials/date/text) */}
      <Dialog
        open={inputOpen}
        onOpenChange={(open) => {
          setInputOpen(open);
          if (!open) {
            setInputValue("");
            setInputFieldKey(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {inputMode === "signature" && "Add your signature"}
              {inputMode === "initials" && "Add your initials"}
              {inputMode === "date" && "Pick a date"}
              {inputMode === "text" && "Enter text"}
            </DialogTitle>
            {(inputMode === "signature" || inputMode === "initials") && (
              <DialogDescription>
                Type your {inputMode === "signature" ? "full name" : "initials"}{" "}
                below. This will be legally binding.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(inputMode === "signature" || inputMode === "initials") && (
              <>
                {(inputMode === "signature" ? savedSignature : savedInitials) &&
                  !inputValue && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setInputValue(
                          (inputMode === "signature"
                            ? savedSignature
                            : savedInitials) ?? ""
                        )
                      }
                    >
                      Use saved {inputMode}:{" "}
                      <span className="ml-2 italic" style={{ fontFamily: "cursive" }}>
                        {inputMode === "signature" ? savedSignature : savedInitials}
                      </span>
                    </Button>
                  )}
                <Input
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    inputMode === "signature"
                      ? "Type your full name"
                      : "Type your initials"
                  }
                  className="text-lg"
                />
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="mb-2 text-sm text-muted-foreground">Preview:</p>
                  <p
                    className="py-2 text-center text-2xl"
                    style={{ fontFamily: "cursive" }}
                  >
                    {inputValue || "Your signature will appear here"}
                  </p>
                </div>
                {inputValue && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="save-sig"
                      checked={saveSignatureChecked}
                      onCheckedChange={(v) => setSaveSignatureChecked(!!v)}
                    />
                    <Label htmlFor="save-sig" className="cursor-pointer text-sm">
                      Save for next time
                    </Label>
                  </div>
                )}
              </>
            )}

            {inputMode === "date" && (
              <Input
                type="date"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            )}

            {inputMode === "text" && (
              <Input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter value"
              />
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setInputOpen(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={applyInputValue}>
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
