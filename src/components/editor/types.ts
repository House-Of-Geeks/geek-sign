export type SigningFieldType =
  | "signature"
  | "initials"
  | "date"
  | "text"
  | "checkbox";

export interface SigningFieldAttrs {
  fieldKey: string;
  fieldType: SigningFieldType;
  recipientRoleId: string;
  label: string;
  required: boolean;
}

export interface VariableAttrs {
  variableKey: string;
  label: string;
}

export interface RecipientRole {
  id: string;
  label: string;
  color: string;
}

export type VariableType = "text" | "number" | "date";

export interface VariableDef {
  key: string;
  label: string;
  type: VariableType;
  defaultValue?: string;
}

export interface ComposedTemplateContent {
  doc: unknown; // Tiptap JSON
  roles: RecipientRole[];
  variables: VariableDef[];
}

export const ROLE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

export function fieldTypeLabel(t: SigningFieldType): string {
  switch (t) {
    case "signature":
      return "Signature";
    case "initials":
      return "Initials";
    case "date":
      return "Date";
    case "text":
      return "Text";
    case "checkbox":
      return "Checkbox";
  }
}
