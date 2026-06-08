"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  label?: string;
  compact?: boolean;
}

export function CopyButton({ text, label = "Copy", compact = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 font-medium transition-colors rounded-lg border text-sm flex-shrink-0",
        compact
          ? "px-3 py-2"
          : "px-4 py-2",
        copied
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {!compact && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}
