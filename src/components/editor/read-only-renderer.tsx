"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { SigningFieldNode } from "./nodes/signing-field-node";
import { VariableNode } from "./nodes/variable-node";
import { RolesProvider } from "./roles-context";
import type { RecipientRole } from "./types";

interface ReadOnlyRendererProps {
  content: unknown;
  roles: RecipientRole[];
  className?: string;
}

/**
 * Read-only view of composed content. Phase 2 will swap field nodes for
 * interactive inputs at signing time; for now this is used by the template
 * preview and the eventual PDF export pipeline.
 */
export function ReadOnlyRenderer({
  content,
  roles,
  className,
}: ReadOnlyRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      SigningFieldNode,
      VariableNode,
    ],
    content: (content as object | undefined) ?? { type: "doc", content: [] },
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-12 py-10",
      },
    },
  });

  if (!editor) return null;

  return (
    <RolesProvider roles={roles}>
      <div className={className}>
        <EditorContent editor={editor} />
      </div>
    </RolesProvider>
  );
}
