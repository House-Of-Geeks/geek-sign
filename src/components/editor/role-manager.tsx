"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { ROLE_COLORS, type RecipientRole } from "./types";

interface RoleManagerProps {
  roles: RecipientRole[];
  onChange: (roles: RecipientRole[]) => void;
}

export function RoleManager({ roles, onChange }: RoleManagerProps) {
  const [draftLabel, setDraftLabel] = useState("");

  const addRole = () => {
    if (!draftLabel.trim()) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `r_${Math.random().toString(36).slice(2)}`;
    const color = ROLE_COLORS[roles.length % ROLE_COLORS.length];
    onChange([...roles, { id, label: draftLabel.trim(), color }]);
    setDraftLabel("");
  };

  const removeRole = (id: string) => {
    onChange(roles.filter((r) => r.id !== id));
  };

  const updateRole = (id: string, label: string) => {
    onChange(roles.map((r) => (r.id === id ? { ...r, label } : r)));
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold mb-2">Signers</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Roles people will sign as (e.g. Client, Contractor). Recipient
          emails are assigned when the template is used.
        </p>
      </div>

      <div className="space-y-1.5">
        {roles.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-md border bg-card p-2"
          >
            <span
              className="inline-block h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: r.color }}
            />
            <Input
              value={r.label}
              onChange={(e) => updateRole(r.id, e.target.value)}
              className="h-7 border-0 bg-transparent px-1 focus-visible:ring-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRole(r.id)}
              aria-label={`Remove ${r.label}`}
              disabled={roles.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Label htmlFor="new-role" className="sr-only">
          Add signer role
        </Label>
        <Input
          id="new-role"
          placeholder="Add signer (e.g. Witness)"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRole();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          onClick={addRole}
          disabled={!draftLabel.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
