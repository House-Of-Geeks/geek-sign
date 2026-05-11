"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { fieldTypeLabel, type SigningFieldType } from "../types";
import { useRoles } from "../roles-context";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    signingField: {
      insertSigningField: (attrs: {
        fieldKey: string;
        fieldType: SigningFieldType;
        recipientRoleId: string;
        label: string;
        required?: boolean;
        options?: string[];
        placeholder?: string;
      }) => ReturnType;
    };
  }
}

function SigningFieldView({ node, editor, deleteNode }: NodeViewProps) {
  const { fieldType, recipientRoleId, label, required } = node.attrs as {
    fieldType: SigningFieldType;
    recipientRoleId: string;
    label: string;
    required: boolean;
  };

  const { rolesById } = useRoles();
  const role = rolesById[recipientRoleId];
  const color = role?.color ?? "#64748b";
  const roleLabel = role?.label ?? "Unassigned";

  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center align-baseline mx-0.5"
      data-field-type={fieldType}
      contentEditable={false}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-md border-2 px-2 py-0.5 text-xs font-medium select-none"
        style={{
          borderColor: color,
          backgroundColor: `${color}15`,
          color,
        }}
        title={`${fieldTypeLabel(fieldType)} — ${roleLabel}${required ? " (required)" : ""}`}
      >
        <span className="font-semibold">{fieldTypeLabel(fieldType)}</span>
        <span className="opacity-70">· {label || roleLabel}</span>
        {isEditable && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              deleteNode();
            }}
            className="ml-1 rounded-sm opacity-60 hover:opacity-100 hover:bg-black/10 px-1"
            aria-label="Remove field"
          >
            ×
          </button>
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const SigningFieldNode = Node.create({
  name: "signingField",

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      fieldKey: { default: null },
      fieldType: { default: "signature" },
      recipientRoleId: { default: "" },
      label: { default: "" },
      required: { default: true },
      options: { default: null },
      placeholder: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-signing-field]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-signing-field": "true" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SigningFieldView);
  },

  addCommands() {
    return {
      insertSigningField:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { required: true, ...attrs },
            })
            .run(),
    };
  },
});
