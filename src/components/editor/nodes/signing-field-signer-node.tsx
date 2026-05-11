"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Check, PenLine } from "lucide-react";
import { fieldTypeLabel, type SigningFieldType } from "../types";
import { useSigner } from "../signer-context";

/**
 * Signer-mode replacement for the signingField node. Same attrs as the
 * editor version (fieldKey + fieldType + recipientRoleId), but its node
 * view is interactive: the current recipient gets clickable inputs, other
 * recipients see read-only state.
 *
 * Registered under the same node name ("signingField") so existing
 * documents render with this view in the signer context.
 */
function SignerFieldView({ node }: NodeViewProps) {
  const { fieldKey, fieldType, recipientRoleId, required } = node.attrs as {
    fieldKey: string;
    fieldType: SigningFieldType;
    recipientRoleId: string;
    required: boolean;
  };

  const {
    currentRecipientId,
    fieldsByKey,
    rolesById,
    onRequestSignature,
    onRequestDate,
    onChangeValue,
    hasConsented,
    onConsentRequired,
  } = useSigner();

  const state = fieldsByKey[fieldKey];
  const role = rolesById[recipientRoleId];
  const color = role?.color ?? "#64748b";
  const roleLabel = role?.label ?? "Signer";

  const isOwn = !!state && state.recipientId === currentRecipientId;
  const value = state?.value ?? "";
  const filled = !!value;

  const handleClick = () => {
    if (!isOwn) return;
    if (!hasConsented) {
      onConsentRequired();
      return;
    }
    if (fieldType === "signature") onRequestSignature(fieldKey, "signature");
    else if (fieldType === "initials") onRequestSignature(fieldKey, "initials");
    else if (fieldType === "date") onRequestDate(fieldKey);
    else if (fieldType === "checkbox") onChangeValue(fieldKey, filled ? null : "checked");
  };

  // Other-recipient view: read-only chip
  if (!isOwn) {
    if (filled) {
      return (
        <NodeViewWrapper
          as="span"
          className="inline-flex items-center align-baseline mx-0.5"
          contentEditable={false}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-sm"
            style={{ borderColor: `${color}55` }}
          >
            <Check className="h-3 w-3" style={{ color }} />
            <span className="font-medium" style={{ fontFamily: fieldType === "signature" || fieldType === "initials" ? "cursive" : undefined }}>
              {value}
            </span>
          </span>
        </NodeViewWrapper>
      );
    }
    return (
      <NodeViewWrapper
        as="span"
        className="inline-flex items-center align-baseline mx-0.5"
        contentEditable={false}
      >
        <span
          className="inline-flex items-center gap-1 rounded-md border-2 border-dashed px-2 py-0.5 text-xs italic opacity-60"
          style={{ borderColor: color, color }}
          title={`Waiting for ${roleLabel}`}
        >
          {fieldTypeLabel(fieldType)} — {roleLabel}
        </span>
      </NodeViewWrapper>
    );
  }

  // Own field, already filled: editable display with click-to-change for text/date,
  // click-to-toggle for checkbox, click-to-re-sign for signature/initials
  if (filled) {
    if (fieldType === "checkbox") {
      return (
        <NodeViewWrapper as="span" className="inline-flex align-baseline mx-0.5" contentEditable={false}>
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm hover:bg-muted/50"
            style={{ borderColor: color }}
          >
            <Check className="h-3.5 w-3.5" style={{ color }} />
            <span className="text-xs text-muted-foreground">Checked</span>
          </button>
        </NodeViewWrapper>
      );
    }
    return (
      <NodeViewWrapper as="span" className="inline-flex align-baseline mx-0.5" contentEditable={false}>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-sm hover:bg-muted/30"
          style={{ borderColor: color, backgroundColor: `${color}10` }}
        >
          <Check className="h-3 w-3" style={{ color }} />
          <span
            className="font-medium"
            style={{
              fontFamily:
                fieldType === "signature" || fieldType === "initials"
                  ? "cursive"
                  : undefined,
            }}
          >
            {value}
          </span>
        </button>
      </NodeViewWrapper>
    );
  }

  // Own field, empty: prominent CTA
  return (
    <NodeViewWrapper as="span" className="inline-flex align-baseline mx-0.5" contentEditable={false}>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 text-xs font-medium transition-colors animate-pulse-subtle hover:opacity-90"
        style={{
          borderColor: color,
          backgroundColor: `${color}15`,
          color,
        }}
        data-field-key={fieldKey}
        data-required={required ? "true" : "false"}
      >
        <PenLine className="h-3.5 w-3.5" />
        <span>
          {fieldTypeLabel(fieldType)}
          {required && <span className="ml-0.5">*</span>}
        </span>
      </button>
    </NodeViewWrapper>
  );
}

export const SigningFieldSignerNode = Node.create({
  name: "signingField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      fieldKey: { default: null },
      fieldType: { default: "signature" },
      recipientRoleId: { default: "" },
      label: { default: "" },
      required: { default: true },
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
    return ReactNodeViewRenderer(SignerFieldView);
  },
});
