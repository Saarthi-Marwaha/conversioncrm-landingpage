"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { saveEmailDelivery } from "@/app/dashboard/settings/actions";
import { Server, Zap, CheckCircle2, XCircle } from "lucide-react";

const inputClass =
  "w-full text-sm bg-gray-50 rounded-lg px-3 py-2 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-colors";

export function EmailDeliveryForm({
  currentProvider,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpSecure,
  smtpFromEmail,
  hasPassword,
}: {
  currentProvider: "resend" | "smtp";
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean;
  smtpFromEmail: string | null;
  hasPassword: boolean;
}) {
  const [provider, setProvider] = useState<"resend" | "smtp">(currentProvider);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<
    | { kind: "idle" }
    | { kind: "testing" }
    | { kind: "ok"; to: string; provider: string }
    | { kind: "fail"; message: string }
  >({ kind: "idle" });

  function handleSave(formData: FormData) {
    startTransition(async () => {
      setSaved(false);
      setError(null);
      const res = await saveEmailDelivery(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  async function sendTest() {
    setTestState({ kind: "testing" });
    try {
      const res = await fetch("/api/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setTestState({ kind: "ok", to: json.to, provider: json.provider });
    } catch (e) {
      setTestState({
        kind: "fail",
        message: e instanceof Error ? e.message : "Test failed",
      });
    }
  }

  return (
    <form action={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          className={cn(
            "rounded-xl p-4 cursor-pointer transition-all",
            provider === "resend"
              ? "bg-sky-50 ring-2 ring-sky-400"
              : "bg-gray-50 hover:bg-gray-100"
          )}
        >
          <input
            type="radio"
            name="email_provider"
            value="resend"
            checked={provider === "resend"}
            onChange={() => setProvider("resend")}
            className="sr-only"
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Zap className="h-4 w-4 text-sky-500" />
            Built-in sender
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Zero setup. Emails send from our verified domain with your sender
            name and your reply-to address.
          </p>
        </label>

        <label
          className={cn(
            "rounded-xl p-4 cursor-pointer transition-all",
            provider === "smtp"
              ? "bg-sky-50 ring-2 ring-sky-400"
              : "bg-gray-50 hover:bg-gray-100"
          )}
        >
          <input
            type="radio"
            name="email_provider"
            value="smtp"
            checked={provider === "smtp"}
            onChange={() => setProvider("smtp")}
            className="sr-only"
          />
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Server className="h-4 w-4 text-sky-500" />
            Your SMTP server
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Send from your own domain via Gmail, Outlook, SES, Postmark — any
            SMTP credentials work.
          </p>
        </label>
      </div>

      {provider === "smtp" && (
        <div className="rounded-xl bg-gray-50/70 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-gray-700">Host</span>
              <input
                name="smtp_host"
                defaultValue={smtpHost ?? ""}
                placeholder="smtp.gmail.com"
                className={cn(inputClass, "mt-1 bg-white")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Port</span>
              <input
                name="smtp_port"
                type="number"
                defaultValue={smtpPort ?? 465}
                placeholder="465"
                className={cn(inputClass, "mt-1 bg-white")}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Username</span>
              <input
                name="smtp_user"
                defaultValue={smtpUser ?? ""}
                placeholder="you@yourdomain.com"
                autoComplete="off"
                className={cn(inputClass, "mt-1 bg-white")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">
                Password{hasPassword ? " (saved — leave blank to keep)" : ""}
              </span>
              <input
                name="smtp_pass"
                type="password"
                placeholder={hasPassword ? "••••••••" : "App password"}
                autoComplete="new-password"
                className={cn(inputClass, "mt-1 bg-white")}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Security</span>
              <select
                name="smtp_secure"
                defaultValue={smtpSecure ? "ssl" : "starttls"}
                className={cn(inputClass, "mt-1 bg-white")}
              >
                <option value="ssl">SSL/TLS (port 465)</option>
                <option value="starttls">STARTTLS (port 587)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">
                From address <span className="font-normal text-gray-400">optional</span>
              </span>
              <input
                name="smtp_from_email"
                type="email"
                defaultValue={smtpFromEmail ?? ""}
                placeholder="Defaults to username"
                className={cn(inputClass, "mt-1 bg-white")}
              />
            </label>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Gmail/Outlook need an app password (not your login password).
            Credentials are stored server-side and never sent back to the
            browser.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : saved ? "Saved ✓" : "Save delivery settings"}
        </button>
        <button
          type="button"
          onClick={sendTest}
          disabled={testState.kind === "testing"}
          className="px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-lg shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {testState.kind === "testing" ? "Sending test…" : "Send test email"}
        </button>

        {testState.kind === "ok" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Delivered to {testState.to} via {testState.provider}
          </span>
        )}
        {testState.kind === "fail" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-full px-3 py-1.5 max-w-md">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {testState.message}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-gray-400">
        Save first, then test — the test uses your stored settings.
      </p>
    </form>
  );
}
