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
import { Plus, Trash2 } from "lucide-react";
import type { VariableDef, VariableType } from "./types";

interface VariablePaletteProps {
  editor: Editor | null;
  variables: VariableDef[];
  onChange: (variables: VariableDef[]) => void;
}

function toKey(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `var_${Math.random().toString(36).slice(2, 6)}`
  );
}

export function VariablePalette({
  editor,
  variables,
  onChange,
}: VariablePaletteProps) {
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<VariableType>("text");

  const addVariable = () => {
    if (!draftLabel.trim()) return;
    const key = toKey(draftLabel);
    if (variables.some((v) => v.key === key)) {
      setDraftLabel("");
      return;
    }
    onChange([
      ...variables,
      { key, label: draftLabel.trim(), type: draftType },
    ]);
    setDraftLabel("");
  };

  const removeVariable = (key: string) => {
    onChange(variables.filter((v) => v.key !== key));
  };

  const insert = (v: VariableDef) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertVariable({ variableKey: v.key, label: v.label })
      .run();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Variables</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Placeholders the sender fills in when using this template
          (e.g. client name, amount, dates).
        </p>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-xs">Add variable</Label>
        <Input
          placeholder="Client name"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addVariable();
            }
          }}
        />
        <div className="flex gap-2">
          <Select
            value={draftType}
            onValueChange={(v) => setDraftType(v as VariableType)}
          >
            <SelectTrigger className="h-9 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            onClick={addVariable}
            disabled={!draftLabel.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {variables.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Insert at cursor</Label>
          <div className="space-y-1">
            {variables.map((v) => (
              <div
                key={v.key}
                className="flex items-center gap-1 rounded-md border bg-muted/30 pl-2 pr-1"
              >
                <button
                  type="button"
                  onClick={() => insert(v)}
                  disabled={!editor}
                  className="flex-1 py-1.5 text-left text-xs font-mono hover:text-primary disabled:opacity-50"
                >
                  {"{{"}{v.label}{"}}"}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeVariable(v.key)}
                  aria-label={`Remove ${v.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
