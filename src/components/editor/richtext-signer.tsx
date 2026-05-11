"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  fieldTypeLabel,
  inputFlavourFor,
  type SigningFieldType,
} from "./types";

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

interface ContentFieldMeta {
  fieldKey: string;
  fieldType: SigningFieldType;
  label: string;
  options?: string[];
  placeholder?: string;
}

function collectContentMeta(content: unknown): Record<string, ContentFieldMeta> {
  const out: Record<string, ContentFieldMeta> = {};
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      type?: string;
      attrs?: Record<string, unknown>;
      content?: unknown[];
    };
    if (n.type === "signingField" && n.attrs) {
      const fieldKey = n.attrs.fieldKey as string | undefined;
      if (fieldKey) {
        out[fieldKey] = {
          fieldKey,
          fieldType: (n.attrs.fieldType as SigningFieldType) ?? "text",
          label:
            (n.attrs.label as string | undefined) ||
            fieldTypeLabel((n.attrs.fieldType as SigningFieldType) ?? "text"),
          options: n.attrs.options as string[] | undefined,
          placeholder: n.attrs.placeholder as string | undefined,
        };
      }
    }
    if (Array.isArray(n.content)) for (const c of n.content) walk(c);
  };
  walk(content);
  return out;
}

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

  const contentMeta = useMemo(() => collectContentMeta(content), [content]);

  const [fields, setFields] = useState<ServerField[]>(initialFields);
  const [hasConsented, setHasConsented] = useState(recipient.consentGiven);
  const [showConsentModal, setShowConsentModal] = useState(!recipient.consentGiven);
  const [consentCheckbox, setConsentCheckbox] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);

  const [savedSignature, setSavedSignature] = useState(initialSavedSignature);
  const [savedInitials, setSavedInitials] = useState(initialSavedInitials);

  // Input dialog state
  const [inputOpen, setInputOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saveSignatureChecked, setSaveSignatureChecked] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(isFullySigned && recipient.consentGiven);

  const fieldsByKey = useMemo(() => {
    const map: Record<string, SignerFieldState> = {};
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

  // Auto-fill date_auto fields with today's date on first mount
  const autoFillRan = useRef(false);
  useEffect(() => {
    if (autoFillRan.current) return;
    autoFillRan.current = true;
    const today = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    let touched = false;
    setFields((prev) =>
      prev.map((f) => {
        if (f.type === "date_auto" && !f.value) {
          touched = true;
          return { ...f, value: today };
        }
        return f;
      })
    );
    if (touched) dirtyRef.current = true;
  }, []);

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

  const requestField = (fieldKey: string) => {
    const state = fields.find((f) => f.fieldKey === fieldKey);
    const meta = contentMeta[fieldKey];
    if (!state || !meta) return;
    const flavour = inputFlavourFor(meta.fieldType);
    if (flavour === "checkbox" || flavour === "date_auto") return;

    let initial = state.value ?? "";
    if (flavour === "date" && !initial) {
      initial = new Date().toISOString().slice(0, 10);
    } else if (flavour === "date" && initial) {
      const parsed = new Date(initial);
      if (!isNaN(parsed.getTime())) initial = parsed.toISOString().slice(0, 10);
    }
    setActiveKey(fieldKey);
    setInputValue(initial);
    setSaveSignatureChecked(false);
    setInputOpen(true);
  };

  const applyInputValue = async () => {
    if (!activeKey) return;
    const meta = contentMeta[activeKey];
    if (!meta) return;
    const flavour = inputFlavourFor(meta.fieldType);
    const trimmed = inputValue.trim();
    if (!trimmed) {
      toast({ title: "Please enter a value", variant: "destructive" });
      return;
    }

    let stored = trimmed;
    if (flavour === "date") {
      const d = new Date(trimmed);
      stored = isNaN(d.getTime())
        ? trimmed
        : d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
    }
    setFieldValue(activeKey, stored);

    if ((flavour === "signature" || flavour === "initials") && saveSignatureChecked) {
      try {
        await fetch(`/api/sign/${token}/save-signature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            flavour === "signature" ? { signature: trimmed } : { initials: trimmed }
          ),
        });
        if (flavour === "signature") setSavedSignature(trimmed);
        else setSavedInitials(trimmed);
      } catch {
        /* non-fatal */
      }
    }

    setInputOpen(false);
    setInputValue("");
    setActiveKey(null);
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
      if (!res.ok) throw new Error(data.error || "Failed to submit");
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
  const filledRequired = fields.filter(
    (f) => f.required && f.value && f.value.trim()
  ).length;

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

  const activeMeta = activeKey ? contentMeta[activeKey] : null;
  const activeFlavour = activeMeta ? inputFlavourFor(activeMeta.fieldType) : "text";

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
              onRequestField: requestField,
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

      {/* Input dialog — flavour-aware */}
      <Dialog
        open={inputOpen}
        onOpenChange={(open) => {
          setInputOpen(open);
          if (!open) {
            setInputValue("");
            setActiveKey(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeMeta?.label || "Enter value"}</DialogTitle>
            {(activeFlavour === "signature" || activeFlavour === "initials") && (
              <DialogDescription>
                Type your {activeFlavour === "signature" ? "full name" : "initials"} below.
                This will be legally binding.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(activeFlavour === "signature" || activeFlavour === "initials") && (
              <>
                {(activeFlavour === "signature" ? savedSignature : savedInitials) &&
                  !inputValue && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setInputValue(
                          (activeFlavour === "signature"
                            ? savedSignature
                            : savedInitials) ?? ""
                        )
                      }
                    >
                      Use saved {activeFlavour}:{" "}
                      <span className="ml-2 italic" style={{ fontFamily: "cursive" }}>
                        {activeFlavour === "signature" ? savedSignature : savedInitials}
                      </span>
                    </Button>
                  )}
                <Input
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    activeFlavour === "signature"
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

            {activeFlavour === "date" && (
              <Input
                type="date"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            )}

            {(activeFlavour === "text" || activeFlavour === "email" ||
              activeFlavour === "tel" || activeFlavour === "number") && (
              <Input
                autoFocus
                type={
                  activeFlavour === "email"
                    ? "email"
                    : activeFlavour === "tel"
                    ? "tel"
                    : activeFlavour === "number"
                    ? "number"
                    : "text"
                }
                inputMode={
                  activeFlavour === "email"
                    ? "email"
                    : activeFlavour === "tel"
                    ? "tel"
                    : activeFlavour === "number"
                    ? "decimal"
                    : "text"
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={activeMeta?.placeholder ?? `Enter ${activeMeta?.label?.toLowerCase() || "value"}`}
              />
            )}

            {activeFlavour === "textarea" && (
              <Textarea
                autoFocus
                rows={4}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={activeMeta?.placeholder ?? `Enter ${activeMeta?.label?.toLowerCase() || "value"}`}
              />
            )}

            {activeFlavour === "dropdown" && (
              <Select
                value={inputValue}
                onValueChange={(v) => setInputValue(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {(activeMeta?.options ?? []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
