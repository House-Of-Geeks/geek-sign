"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CopySigningLinkButtonProps {
  signingToken: string;
}

export function CopySigningLinkButton({ signingToken }: CopySigningLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sign.houseofgeeks.online";
    const signingUrl = `${appUrl}/sign/${signingToken}`;

    try {
      await navigator.clipboard.writeText(signingUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Signing link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      title="Copy signing link"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[#07AFBA]" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
