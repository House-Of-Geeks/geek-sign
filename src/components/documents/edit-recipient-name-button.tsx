"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface EditRecipientNameButtonProps {
  documentId: string;
  recipientId: string;
  currentName: string | null;
  email: string;
}

export function EditRecipientNameButton({
  documentId,
  recipientId,
  currentName,
  email,
}: EditRecipientNameButtonProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed === (currentName || "")) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/recipients/${recipientId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed || null }),
        }
      );

      if (!res.ok) throw new Error("Failed to update");

      toast({ title: "Recipient updated", description: `Name updated to "${trimmed || email}"` });
      setEditing(false);
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to update recipient name", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setValue(currentName || "");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm py-0 w-36"
          placeholder={email}
          disabled={saving}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#07AFBA] hover:text-[#07AFBA]/80"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => { setValue(currentName || ""); setEditing(false); }}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      onClick={() => setEditing(true)}
      title="Edit recipient name"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}
