"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ROLE_COLORS } from "./types";

export interface DocumentSigner {
  id: string;
  label: string;
  color: string;
  email: string;
  name: string;
}

interface SignerManagerProps {
  signers: DocumentSigner[];
  onChange: (signers: DocumentSigner[]) => void;
}

/**
 * Like RoleManager but each signer carries an email + name so the document
 * can be finalised into real recipient rows without a second prompt.
 */
export function SignerManager({ signers, onChange }: SignerManagerProps) {
  const [draftLabel, setDraftLabel] = useState("");

  const add = () => {
    if (!draftLabel.trim()) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r_${Math.random().toString(36).slice(2)}`;
    const color = ROLE_COLORS[signers.length % ROLE_COLORS.length];
    onChange([
      ...signers,
      { id, label: draftLabel.trim(), color, email: "", name: "" },
    ]);
    setDraftLabel("");
  };

  const remove = (id: string) => onChange(signers.filter((s) => s.id !== id));

  const update = (id: string, patch: Partial<DocumentSigner>) =>
    onChange(signers.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-1">Signers</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Add the people who need to sign. Each signer gets a colour for
          their fields in the editor.
        </p>
      </div>

      <div className="space-y-2">
        {signers.map((s) => (
          <div key={s.id} className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <Input
                value={s.label}
                onChange={(e) => update(s.id, { label: e.target.value })}
                className="h-7 border-0 bg-transparent px-1 text-sm font-medium focus-visible:ring-1"
                placeholder="Label (e.g. Client)"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(s.id)}
                aria-label={`Remove ${s.label}`}
                disabled={signers.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={s.name}
                  onChange={(e) => update(s.id, { name: e.target.value })}
                  placeholder="Full name (optional)"
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={s.email}
                  onChange={(e) => update(s.id, { email: e.target.value })}
                  placeholder="email@example.com"
                  className="h-8"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add signer (e.g. Witness)"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" onClick={add} disabled={!draftLabel.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
