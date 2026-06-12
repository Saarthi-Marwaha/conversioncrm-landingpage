"use client";

import { useState } from "react";
import { Check, Copy, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  label?: string;
  compact?: boolean;
  variant?: "default" | "agent";
}

export function CopyButton({
  text,
  label = "Copy",
  compact = false,
  variant = "default",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const isAgent = variant === "agent";

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 font-medium transition-all rounded-lg text-sm flex-shrink-0",
        compact ? "px-3 py-2" : "px-4 py-2",
        copied
          ? "bg-green-50 text-green-700"
          : isAgent
          ? "bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
          : "bg-white shadow-soft text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : isAgent ? (
        <Bot className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {!compact && (
        <span>{copied ? "Prompt copied!" : label}</span>
      )}
    </button>
  );
}
