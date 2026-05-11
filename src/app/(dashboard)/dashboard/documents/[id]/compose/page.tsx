"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Check, AlertCircle, Send } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { FieldPalette } from "@/components/editor/field-palette";
import {
  SignerManager,
  type DocumentSigner,
} from "@/components/editor/signer-manager";
import { ROLE_COLORS, type RecipientRole } from "@/components/editor/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface ApiDocument {
  id: string;
  title: string;
  contentType: string;
  content: unknown;
  recipientRoles: DocumentSigner[] | null;
  status: string;
}

const DEFAULT_SIGNER: DocumentSigner = {
  id: "signer-1",
  label: "Signer",
  color: ROLE_COLORS[0],
  email: "",
  name: "",
};

export default function ComposeDocumentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const documentId = params.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [signers, setSigners] = useState<DocumentSigner[]>([DEFAULT_SIGNER]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          throw new Error("Failed to load document");
        }
        const data = await res.json();
        const doc: ApiDocument = data.document;
        if (cancelled) return;

        if (doc.contentType !== "richtext") {
          toast({
            title: "Wrong editor",
            description: "This is a PDF document — opening the field editor.",
          });
          router.replace(`/dashboard/documents/${documentId}/edit`);
          return;
        }

        if (doc.status !== "draft") {
          toast({
            title: "Document already sent",
            description: "Opening the detail page.",
          });
          router.replace(`/dashboard/documents/${documentId}`);
          return;
        }

        setTitle(doc.title);
        setContent(doc.content ?? null);
        setSigners(
          doc.recipientRoles && doc.recipientRoles.length > 0
            ? doc.recipientRoles
            : [DEFAULT_SIGNER]
        );
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, router, toast]);

  // Debounced autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => void save(), 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, signers]);

  const save = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled document",
          content,
          recipientRoles: signers,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  };

  const allSignersValid = signers.every(
    (s) => s.email.trim() && /\S+@\S+\.\S+/.test(s.email.trim())
  );

  const handlePrepare = async () => {
    if (!allSignersValid) {
      toast({
        title: "Missing email",
        description: "Every signer needs a valid email before sending.",
        variant: "destructive",
      });
      return;
    }
    setPreparing(true);
    try {
      // Flush a final save before finalising
      await save();
      const res = await fetch(
        `/api/documents/${documentId}/finalize-richtext`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Couldn't prepare the document");
      }
      toast({
        title: "Ready to send",
        description: `${data.recipientCount} signer(s), ${data.fieldCount} field(s) set up.`,
      });
      router.push(`/dashboard/documents/${documentId}`);
    } catch (e) {
      toast({
        title: "Couldn't prepare",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPreparing(false);
    }
  };

  // Adapt DocumentSigner[] -> RecipientRole[] for FieldPalette / TiptapEditor
  const editorRoles: RecipientRole[] = signers.map((s) => ({
    id: s.id,
    label: s.label || "Signer",
    color: s.color,
  }));

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Document not found.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/documents">Back to documents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/documents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-0 bg-transparent px-1 text-2xl font-semibold focus-visible:ring-1"
            placeholder="Untitled document"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <SaveIndicator state={saveState} />
          </span>
          <Button onClick={handlePrepare} disabled={preparing || !allSignersValid}>
            {preparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Prepare to send
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <TiptapEditor
          initialContent={content}
          roles={editorRoles}
          onChange={setContent}
          onReady={setEditor}
        />

        <aside className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <SignerManager signers={signers} onChange={setSigners} />
          </section>

          <section className="rounded-lg border bg-card p-4">
            <FieldPalette editor={editor} roles={editorRoles} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Saving…</span>
      </>
    );
  }
  if (state === "saved") {
    return (
      <>
        <Check className="h-3.5 w-3.5 text-green-600" />
        <span>Saved</span>
      </>
    );
  }
  if (state === "error") {
    return (
      <>
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        <span className="text-destructive">Save failed</span>
      </>
    );
  }
  return null;
}
