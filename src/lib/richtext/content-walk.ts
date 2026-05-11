/**
 * Server-side helpers for walking Tiptap JSON content used by richtext
 * templates and one-off documents. Kept dependency-free so they can run in
 * both route handlers and edge runtimes.
 */

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: unknown[];
}

export interface CollectedField {
  fieldKey: string;
  fieldType: string;
  recipientRoleId: string;
  required: boolean;
}

export function collectSigningFields(content: unknown): CollectedField[] {
  const out: CollectedField[] = [];
  const walk = (node: TiptapNode | null | undefined) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "signingField" && node.attrs) {
      const attrs = node.attrs as Record<string, unknown>;
      const fieldKey = typeof attrs.fieldKey === "string" ? attrs.fieldKey : null;
      const fieldType = typeof attrs.fieldType === "string" ? attrs.fieldType : "text";
      const recipientRoleId =
        typeof attrs.recipientRoleId === "string" ? attrs.recipientRoleId : "";
      const required = attrs.required !== false;
      if (fieldKey) out.push({ fieldKey, fieldType, recipientRoleId, required });
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };
  walk(content as TiptapNode | null);
  return out;
}

/**
 * Replace variable nodes with text nodes containing the resolved value.
 * Variables with empty / whitespace-only values are LEFT IN PLACE — replacing
 * them with empty text nodes would crash the Tiptap renderer ("Empty text
 * nodes are not allowed"). Same for unfilled variables.
 */
export function substituteVariables(
  content: unknown,
  variables: Record<string, string>
): unknown {
  if (!content || typeof content !== "object") return content;
  const node = content as TiptapNode;

  if (node.type === "variable" && node.attrs) {
    const key = node.attrs.variableKey as string | undefined;
    const value = key ? variables[key] : undefined;
    if (typeof value === "string" && value.trim() !== "") {
      return { type: "text", text: value };
    }
    return node;
  }

  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content
        .map((child) => substituteVariables(child, variables))
        .filter(Boolean),
    };
  }

  return node;
}

/**
 * Walk content and drop any empty text nodes (text === "" or whitespace-only).
 * Tiptap throws "Empty text nodes are not allowed" on load if it encounters
 * one, which blanks the entire editor. Use this on the read path as a
 * defensive sanitiser for content that may have been written by older
 * versions of the substitution code.
 */
export function stripEmptyTextNodes(content: unknown): unknown {
  if (!content || typeof content !== "object") return content;
  const node = content as TiptapNode;
  if (Array.isArray(node.content)) {
    const cleaned = node.content
      .map((child) => stripEmptyTextNodes(child))
      .filter((child) => {
        if (!child || typeof child !== "object") return true;
        const c = child as TiptapNode;
        if (c.type === "text") {
          return typeof c.text === "string" && c.text.length > 0;
        }
        return true;
      });
    return { ...node, content: cleaned };
  }
  return node;
}

/**
 * Rewrite signingField.recipientRoleId attributes via a role-id remap.
 * Used at the boundary between "design-time" role IDs and the recipient
 * UUIDs that the signer view uses for ownership matching.
 */
export function remapFieldRoles(
  content: unknown,
  roleIdToRecipientId: Map<string, string>
): unknown {
  if (!content || typeof content !== "object") return content;
  const node = content as TiptapNode;

  if (node.type === "signingField" && node.attrs) {
    const roleId = node.attrs.recipientRoleId as string | undefined;
    if (roleId && roleIdToRecipientId.has(roleId)) {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          recipientRoleId: roleIdToRecipientId.get(roleId),
        },
      };
    }
    return node;
  }

  if (Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content
        .map((child) => remapFieldRoles(child, roleIdToRecipientId))
        .filter(Boolean),
    };
  }

  return node;
}
