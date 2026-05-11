"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PenTool, Type, Calendar, CheckSquare, Hash } from "lucide-react";
import {
  fieldTypeLabel,
  type RecipientRole,
  type SigningFieldType,
} from "./types";

interface FieldPaletteProps {
  editor: Editor | null;
  roles: RecipientRole[];
}

const FIELD_TYPES: { type: SigningFieldType; icon: React.ReactNode }[] = [
  { type: "signature", icon: <PenTool className="h-4 w-4" /> },
  { type: "initials", icon: <Hash className="h-4 w-4" /> },
  { type: "date", icon: <Calendar className="h-4 w-4" /> },
  { type: "text", icon: <Type className="h-4 w-4" /> },
  { type: "checkbox", icon: <CheckSquare className="h-4 w-4" /> },
];

export function FieldPalette({ editor, roles }: FieldPaletteProps) {
  const [activeRoleId, setActiveRoleId] = useState<string>(
    roles[0]?.id ?? ""
  );

  if (activeRoleId === "" && roles[0]) {
    setActiveRoleId(roles[0].id);
  }

  const activeRole = roles.find((r) => r.id === activeRoleId);

  const insert = (fieldType: SigningFieldType) => {
    if (!editor || !activeRole) return;
    editor
      .chain()
      .focus()
      .insertSigningField({
        fieldKey:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `f_${Math.random().toString(36).slice(2)}`,
        fieldType,
        recipientRoleId: activeRole.id,
        label: activeRole.label,
        required: true,
      })
      .run();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Signing fields</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Place the cursor where you want a field, pick a signer, then click a
          field type.
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

      <div className="grid grid-cols-2 gap-2">
        {FIELD_TYPES.map(({ type, icon }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={!editor || !activeRole}
            onClick={() => insert(type)}
          >
            {icon}
            <span className="ml-2">{fieldTypeLabel(type)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
