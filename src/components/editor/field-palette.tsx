"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PenTool,
  Type,
  Calendar,
  CheckSquare,
  Hash,
  AlignLeft,
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  MapPin,
  ListChecks,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import {
  fieldTypeLabel,
  type RecipientRole,
  type SigningFieldType,
} from "./types";

interface FieldPaletteProps {
  editor: Editor | null;
  roles: RecipientRole[];
}

interface FieldDef {
  type: SigningFieldType;
  icon: React.ReactNode;
}

const GROUPS: { name: string; fields: FieldDef[] }[] = [
  {
    name: "Signing",
    fields: [
      { type: "signature", icon: <PenTool className="h-4 w-4" /> },
      { type: "initials", icon: <Hash className="h-4 w-4" /> },
      { type: "date", icon: <Calendar className="h-4 w-4" /> },
      { type: "date_auto", icon: <CalendarClock className="h-4 w-4" /> },
      { type: "checkbox", icon: <CheckSquare className="h-4 w-4" /> },
    ],
  },
  {
    name: "Identity",
    fields: [
      { type: "name", icon: <User className="h-4 w-4" /> },
      { type: "firstname", icon: <User className="h-4 w-4" /> },
      { type: "lastname", icon: <User className="h-4 w-4" /> },
      { type: "company", icon: <Building className="h-4 w-4" /> },
      { type: "title", icon: <Briefcase className="h-4 w-4" /> },
    ],
  },
  {
    name: "Contact",
    fields: [
      { type: "email", icon: <Mail className="h-4 w-4" /> },
      { type: "phone", icon: <Phone className="h-4 w-4" /> },
    ],
  },
  {
    name: "Address",
    fields: [
      { type: "address", icon: <MapPin className="h-4 w-4" /> },
      { type: "suburb", icon: <MapPin className="h-4 w-4" /> },
      { type: "state", icon: <MapPin className="h-4 w-4" /> },
      { type: "postcode", icon: <MapPin className="h-4 w-4" /> },
      { type: "postcodes", icon: <MapPin className="h-4 w-4" /> },
    ],
  },
  {
    name: "Form",
    fields: [
      { type: "text", icon: <Type className="h-4 w-4" /> },
      { type: "paragraph", icon: <AlignLeft className="h-4 w-4" /> },
      { type: "number", icon: <Hash className="h-4 w-4" /> },
      { type: "dropdown", icon: <ListChecks className="h-4 w-4" /> },
      { type: "custom", icon: <Sparkles className="h-4 w-4" /> },
    ],
  },
];

export function FieldPalette({ editor, roles }: FieldPaletteProps) {
  const [activeRoleId, setActiveRoleId] = useState<string>(roles[0]?.id ?? "");

  if (activeRoleId === "" && roles[0]) {
    setActiveRoleId(roles[0].id);
  }

  const activeRole = roles.find((r) => r.id === activeRoleId);

  const insert = (fieldType: SigningFieldType) => {
    if (!editor || !activeRole) return;

    const fieldKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `f_${Math.random().toString(36).slice(2)}`;

    let label = fieldTypeLabel(fieldType);
    let options: string[] | undefined;
    // Only signature fields are required by default — keeps signers from
    // being blocked by every form field. Users can still flip per-field.
    let required = fieldType === "signature";

    // Configurable types: prompt for the details before inserting.
    if (fieldType === "dropdown") {
      const raw = window.prompt(
        "Dropdown options (comma-separated)",
        "Option 1, Option 2, Option 3"
      );
      if (!raw) return;
      options = raw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const customLabel = window.prompt("Field label", "Choose one");
      label = customLabel?.trim() || "Choose one";
    } else if (fieldType === "custom") {
      const customLabel = window.prompt("Custom field label", "Custom field");
      if (!customLabel) return;
      label = customLabel.trim();
    }

    editor
      .chain()
      .focus()
      .insertSigningField({
        fieldKey,
        fieldType,
        recipientRoleId: activeRole.id,
        label,
        required,
        options,
      })
      .run();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Insert field</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Place the cursor where you want the field, pick a signer, then click
          a field type.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Assign to signer</Label>
        <Select
          value={activeRoleId}
          onValueChange={(v) => setActiveRoleId(v)}
          disabled={roles.length === 0}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a signer" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  {r.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {GROUPS.map((group) => (
          <div key={group.name} className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {group.name}
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {group.fields.map(({ type, icon }) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 justify-start px-2 text-xs"
                  disabled={!editor || !activeRole}
                  onClick={() => insert(type)}
                >
                  {icon}
                  <span className="ml-1.5 truncate">{fieldTypeLabel(type)}</span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// keep `Input` exported so existing imports don't break if any reference it
// (no usages currently, but harmless to silence the linter)
void Input;
