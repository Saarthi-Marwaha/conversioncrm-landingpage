"use client";

import { useRef, useState, useTransition } from "react";
import { saveWebsiteUrl } from "@/app/dashboard/settings/actions";

interface Props {
  currentUrl: string | null;
  apiKey: string;
  eventsEndpoint: string;
}

export function WebsiteUrlForm({ currentUrl, apiKey, eventsEndpoint }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Test-connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveWebsiteUrl(formData);
      if ("error" in res) {
        setError(res.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  async function sendTestEvent() {
    setTesting(true);
    setTestResult(null);
    setTestMessage("");
    try {
      // Call the server-side test endpoint so the event gets the workspace's
      // configured website origin (not this browser tab's origin), meaning it
      // passes the website_url filter and immediately appears on the dashboard.
      const res = await fetch("/api/dashboard/test-connection", { method: "POST" });
      if (res.ok) {
        setTestResult("success");
        setTestMessage("Test event sent! It should appear on the dashboard within 3 seconds.");
      } else {
        const body = await res.text();
        setTestResult("error");
        setTestMessage(`Server returned ${res.status}: ${body}`);
      }
    } catch (e) {
      setTestResult("error");
      setTestMessage(
        `Request failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={handleSave} className="flex items-center gap-2">
        <input
          type="url"
          name="website_url"
          defaultValue={currentUrl ?? ""}
          placeholder="https://www.yourproduct.com"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <p className="text-xs text-gray-500">
        Once set, the dashboard will only show events whose origin matches this
        URL — filtering out localhost or other test traffic.
      </p>

      {/* Test connection */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        <p className="text-xs font-medium text-gray-700">
          Test connection from this browser
        </p>
        <p className="text-xs text-gray-500">
          Click the button to fire a test event <em>right now</em> from your
          browser and confirm it reaches the server.
        </p>
        <button
          onClick={sendTestEvent}
          disabled={testing}
          className="px-4 py-2 text-sm font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
        >
          {testing ? "Sending…" : "Send test event"}
        </button>

        {testResult === "success" && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            ✓ {testMessage}
          </p>
        )}
        {testResult === "error" && (
          <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
            ✗ {testMessage}
          </p>
        )}
      </div>
    </div>
  );
}
