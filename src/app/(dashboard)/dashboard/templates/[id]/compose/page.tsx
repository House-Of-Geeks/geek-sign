"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Check, AlertCircle } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { RoleManager } from "@/components/editor/role-manager";
import { FieldPalette } from "@/components/editor/field-palette";
import { VariablePalette } from "@/components/editor/variable-palette";
import {
  ROLE_COLORS,
  type RecipientRole,
  type VariableDef,
} from "@/components/editor/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  contentType: string;
  content: unknown;
  variableSchema: VariableDef[] | null;
  recipientRoles: RecipientRole[] | null;
}

const DEFAULT_ROLE: RecipientRole = {
  id: "signer-1",
  label: "Signer",
  color: ROLE_COLORS[0],
};

export default function ComposeTemplatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<unknown>(null);
  const [roles, setRoles] = useState<RecipientRole[]>([DEFAULT_ROLE]);
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notFound, setNotFound] = useState(false);

  // Load template
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          throw new Error("Failed to load template");
        }
        const data: TemplateData = await res.json();
        if (cancelled) return;

        if (data.contentType !== "richtext") {
          toast({
            title: "Wrong editor",
            description: "This is a PDF template — opening the field editor instead.",
          });
          router.replace(`/dashboard/templates/${templateId}/edit`);
          return;
        }

        setName(data.name);
        setDescription(data.description ?? "");
        setContent(data.content ?? null);
        setRoles(
          data.recipientRoles && data.recipientRoles.length > 0
            ? data.recipientRoles
            : [DEFAULT_ROLE]
        );
        setVariables(data.variableSchema ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, router, toast]);

  // Debounced autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      void save();
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, content, roles, variables]);

  const save = async () => {
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Untitled template",
          description: description || null,
          content,
          recipientRoles: roles,
          variableSchema: variables,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveState("saved");
      dirtyRef.current = false;
    } catch (e) {
      console.error(e);
      setSaveState("error");
    }
  };

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
        <p className="text-sm text-muted-foreground">Template not found.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/templates">Back to templates</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-0 bg-transparent px-1 text-2xl font-semibold focus-visible:ring-1"
              placeholder="Untitled template"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional) — internal note about what this template is for"
            rows={2}
            className="resize-none"
          />
          <TiptapEditor
            initialContent={content}
            roles={roles}
            onChange={setContent}
            onReady={setEditor}
          />
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <RoleManager roles={roles} onChange={setRoles} />
          </section>

          <section className="rounded-lg border bg-card p-4">
            <FieldPalette editor={editor} roles={roles} />
          </section>

          <section className="rounded-lg border bg-card p-4">
            <VariablePalette
              editor={editor}
              variables={variables}
              onChange={setVariables}
            />
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

