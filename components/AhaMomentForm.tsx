"use client";

import { useState, useTransition } from "react";
import { saveAhaMoment } from "@/app/dashboard/settings/actions";
import { Sparkles } from "lucide-react";

const inputClass =
  "w-full text-sm bg-gray-50 rounded-lg px-3 py-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

export function AhaMomentForm({
  currentName,
  currentEvent,
}: {
  currentName: string | null;
  currentEvent: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState(currentEvent ?? "");

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveAhaMoment(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        if (res && "event" in res && typeof res.event === "string") {
          setEventName(res.event);
        }
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const snippetEvent = eventName || "feature_used";
  const snippet =
    snippetEvent === "feature_used"
      ? `ConversionCRM.track("feature_used", { feature: "${currentName || "your feature"}" });`
      : `ConversionCRM.track("${snippetEvent}");`;

  return (
    <div className="space-y-4">
      <form action={handleSave} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Feature name
            </span>
            <input
              name="key_feature_name"
              defaultValue={currentName ?? ""}
              placeholder="e.g. Export report"
              maxLength={120}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">
              Event name{" "}
              <span className="font-normal text-gray-400">optional</span>
            </span>
            <input
              name="key_feature_event"
              defaultValue={currentEvent ?? ""}
              placeholder="e.g. report_exported"
              maxLength={64}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save aha moment"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      <div className="rounded-xl bg-sky-50 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          How the catcher works
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Fire this in your product when the user hits the moment of value.
          Scoring awards up to <strong>20 points</strong> for it, and the
          onboarding nudge email stops once it&apos;s caught:
        </p>
        <pre className="mt-2 bg-white rounded-lg px-3 py-2.5 text-[11px] text-sky-800 font-mono overflow-x-auto whitespace-pre-wrap">
          {snippet}
        </pre>
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          With a custom event name, any{" "}
          <code className="text-gray-500">track(&quot;{snippetEvent}&quot;)</code> call
          counts. Without one, <code className="text-gray-500">feature_used</code>{" "}
          events whose <code className="text-gray-500">feature</code> property matches
          the name above count.
        </p>
      </div>
    </div>
  );
}
