"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function NewBlankTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const created = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (created.current) return;
    created.current = true;

    (async () => {
      try {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Untitled template",
            contentType: "richtext",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || data.message || "Failed to create template");
        }
        router.replace(`/dashboard/templates/${data.id}/compose`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create template";
        setError(msg);
        toast({ title: "Couldn't open the composer", description: msg, variant: "destructive" });
      }
    })();
  }, [router, toast]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Opening composer…</p>
          </>
        )}
      </div>
    </div>
  );
}
