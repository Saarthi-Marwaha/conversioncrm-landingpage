"use client";

import { useState, useTransition } from "react";
import { saveReplyToEmail } from "@/app/dashboard/settings/actions";

export function ReplyToEmailForm({
  currentEmail,
  currentSenderName,
}: {
  currentEmail: string | null;
  currentSenderName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveReplyToEmail(formData);
      if ("error" in res) {
        setError(res.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-3">
      <form action={handleSave} className="space-y-3">
        <div>
          <label
            htmlFor="email_sender_name"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Sender name (shown on outgoing emails)
          </label>
          <input
            id="email_sender_name"
            type="text"
            name="email_sender_name"
            defaultValue={currentSenderName ?? ""}
            placeholder="Acme Team"
            required
            className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="email"
            name="reply_to_email"
            defaultValue={currentEmail ?? ""}
            placeholder="you@gmail.com"
            required
            className="flex-1 text-sm bg-gray-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors"
          />
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">
        Emails send as{" "}
        <strong>{currentSenderName?.trim() || "Your name"}</strong> from{" "}
        <code className="text-gray-600">noreply@mail.conversioncrm.co</code>.
        Replies go to the address above.
      </p>
    </div>
  );
}
