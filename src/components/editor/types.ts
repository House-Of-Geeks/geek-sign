export type SigningFieldType =
  // Signing primitives
  | "signature"
  | "initials"
  | "date"
  | "date_auto"
  | "checkbox"
  // Free text
  | "text"
  | "paragraph"
  // Identity
  | "name"
  | "firstname"
  | "lastname"
  | "company"
  | "title"
  // Contact
  | "email"
  | "phone"
  // Address
  | "address"
  | "suburb"
  | "state"
  | "postcode"
  | "postcodes"
  // Numbers
  | "number"
  // Structured
  | "dropdown"
  // Custom label, free text
  | "custom";

export interface SigningFieldAttrs {
  fieldKey: string;
  fieldType: SigningFieldType;
  recipientRoleId: string;
  label: string;
  required: boolean;
  /** dropdown options (comma-separated values when stored) */
  options?: string[];
  /** placeholder hint shown to the signer */
  placeholder?: string;
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

/** Display label for a field type. Falls back to humanised key. */
export function fieldTypeLabel(t: SigningFieldType): string {
  const labels: Record<SigningFieldType, string> = {
    signature: "Signature",
    initials: "Initials",
    date: "Date",
    date_auto: "Signing date",
    checkbox: "Checkbox",
    text: "Text",
    paragraph: "Paragraph",
    name: "Full name",
    firstname: "First name",
    lastname: "Last name",
    company: "Company",
    title: "Title",
    email: "Email",
    phone: "Phone",
    address: "Address",
    suburb: "Suburb / City",
    state: "State",
    postcode: "Postcode",
    postcodes: "Postcodes",
    number: "Number",
    dropdown: "Dropdown",
    custom: "Custom",
  };
  return labels[t] || t;
}

/** Default label for a freshly-inserted field. Used when the user hasn't set one. */
export function defaultFieldLabel(t: SigningFieldType): string {
  return fieldTypeLabel(t);
}

/**
 * The signer-side input flavour. Used by the signer view to pick the right
 * input control (typed input, textarea, select, date picker, signature pad).
 */
export type SignerInputFlavour =
  | "signature"
  | "initials"
  | "date"
  | "date_auto" // no UI; auto-filled
  | "checkbox"
  | "text"
  | "email"
  | "tel"
  | "number"
  | "textarea"
  | "dropdown";

export function inputFlavourFor(t: SigningFieldType): SignerInputFlavour {
  switch (t) {
    case "signature":
      return "signature";
    case "initials":
      return "initials";
    case "date":
      return "date";
    case "date_auto":
      return "date_auto";
    case "checkbox":
      return "checkbox";
    case "email":
      return "email";
    case "phone":
      return "tel";
    case "number":
      return "number";
    case "paragraph":
    case "address":
    case "postcodes":
      return "textarea";
    case "dropdown":
      return "dropdown";
    case "text":
    case "name":
    case "firstname":
    case "lastname":
    case "company":
    case "title":
    case "suburb":
    case "state":
    case "postcode":
    case "custom":
      return "text";
  }
}
