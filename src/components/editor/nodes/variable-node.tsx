"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (attrs: { variableKey: string; label: string }) => ReturnType;
    };
  }
}

function VariableView({ node, editor, deleteNode }: NodeViewProps) {
  const { variableKey, label } = node.attrs as {
    variableKey: string;
    label: string;
  };
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex items-center align-baseline mx-0.5"
      contentEditable={false}
      data-variable-key={variableKey}
    >
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-mono border border-border select-none">
        <span className="opacity-60">{"{{"}</span>
        <span>{label || variableKey}</span>
        <span className="opacity-60">{"}}"}</span>
        {isEditable && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              deleteNode();
            }}
            className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 hover:bg-black/10 px-1"
            aria-label="Remove variable"
          >
            ×
          </button>
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const VariableNode = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      variableKey: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable-key]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-variable-key": node.attrs.variableKey,
      }),
      `{{${node.attrs.label || node.attrs.variableKey}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableView);
  },

  addCommands() {
    return {
      insertVariable:
        (attrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
