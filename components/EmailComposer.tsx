"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  EMAIL_THEME_PRESETS,
  renderCustomEmailHtml,
  type EmailTheme,
} from "@/lib/emails/render-custom";
import {
  Send,
  Copy,
  Check,
  Palette,
  Monitor,
  Smartphone,
  AlertTriangle,
} from "lucide-react";

const NAVY = "text-[#0b3a5e]";

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; to: string }
  | { kind: "error"; message: string };

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {optional && (
          <span className="text-gray-400 font-normal ml-1">optional</span>
        )}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg bg-gray-50 px-3 py-2 text-sm focus:bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300";

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-600">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 rounded-md bg-white shadow-soft p-0.5 cursor-pointer"
      />
      <span className="flex-1">{label}</span>
      <code className="text-[10px] text-gray-400">{value}</code>
    </label>
  );
}

export function EmailComposer({
  senderName,
  replyToConfigured,
}: {
  senderName: string;
  replyToConfigured: boolean;
}) {
  const params = useSearchParams();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [footerText, setFooterText] = useState("");
  const [presetId, setPresetId] = useState("sky");
  const [theme, setTheme] = useState<EmailTheme>(EMAIL_THEME_PRESETS[0].theme);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<SendState>({ kind: "idle" });

  useEffect(() => {
    const qpTo = params.get("to");
    if (qpTo) setTo(qpTo);
  }, [params]);

  const uid = params.get("uid") ?? undefined;

  const html = useMemo(
    () =>
      renderCustomEmailHtml(
        {
          subject: subject || "Your email subject",
          preheader,
          heading,
          body:
            body ||
            "Write your message in the form on the left.\n\nBlank lines create new paragraphs — the preview updates as you type.",
          ctaLabel,
          ctaUrl,
          footerText,
          senderName,
        },
        theme
      ),
    [subject, preheader, heading, body, ctaLabel, ctaUrl, footerText, theme, senderName]
  );

  function applyPreset(id: string) {
    const preset = EMAIL_THEME_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setTheme(preset.theme);
  }

  function setThemeColor(key: keyof EmailTheme, value: string) {
    setPresetId("custom");
    setTheme((t) => ({ ...t, [key]: value }));
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function send() {
    if (sendState.kind === "sending") return;
    setSendState({ kind: "sending" });
    try {
      const res = await fetch("/api/emails/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          preheader: preheader || undefined,
          heading: heading || undefined,
          body,
          ctaLabel: ctaLabel || undefined,
          ctaUrl: ctaUrl || undefined,
          footerText: footerText || undefined,
          userId: uid,
          theme,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }
      setSendState({ kind: "sent", to });
    } catch (e) {
      setSendState({
        kind: "error",
        message: e instanceof Error ? e.message : "Send failed",
      });
    }
  }

  const canSend =
    to.trim().length > 3 &&
    to.includes("@") &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    sendState.kind !== "sending";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Composer</h1>
        <p className="text-gray-500 text-sm mt-1">
          Build a hand-written email in your colors, preview the exact HTML,
          and send it — it&apos;s logged on the user&apos;s profile.
        </p>
      </div>

      {!replyToConfigured && (
        <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-2.5 text-xs text-amber-800 shadow-soft">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          No reply-to email configured — replies won&apos;t reach your inbox.
          Set it in Settings.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ── Form ───────────────────────────────────── */}
        <div className="card p-5 sm:p-6 space-y-4">
          <Field label="To">
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="user@example.com"
              className={inputClass}
            />
          </Field>

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quick question about your trial"
              maxLength={200}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Heading" optional>
              <input
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                placeholder="You're almost there"
                maxLength={200}
                className={inputClass}
              />
            </Field>
            <Field label="Preview text" optional>
              <input
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                placeholder="Shown next to the subject in the inbox"
                maxLength={200}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Message">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Hi there,\n\nI noticed you tried the export feature…\n\nBlank lines start a new paragraph."}
              rows={8}
              maxLength={8000}
              className={cn(inputClass, "resize-y leading-relaxed")}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Button label" optional>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Open dashboard"
                maxLength={80}
                className={inputClass}
              />
            </Field>
            <Field label="Button link" optional>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://yourapp.com"
                maxLength={500}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Footer text" optional>
            <input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder={`Sent by ${senderName}. Reply any time.`}
              maxLength={300}
              className={inputClass}
            />
          </Field>

          {/* ── Color scheme ─────────────────────────── */}
          <div className="pt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-3">
              <Palette className="h-3.5 w-3.5 text-sky-500" />
              Color scheme
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {EMAIL_THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                    presetId === p.id
                      ? "bg-sky-50 text-sky-900 ring-2 ring-sky-300"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: p.theme.accent }}
                  />
                  {p.name}
                </button>
              ))}
              {presetId === "custom" && (
                <span className="flex items-center rounded-lg bg-sky-50 ring-2 ring-sky-300 px-2.5 py-1.5 text-xs font-medium text-sky-900">
                  Custom
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <ColorInput
                label="Accent (button & bar)"
                value={theme.accent}
                onChange={(v) => setThemeColor("accent", v)}
              />
              <ColorInput
                label="Background"
                value={theme.background}
                onChange={(v) => setThemeColor("background", v)}
              />
              <ColorInput
                label="Card surface"
                value={theme.surface}
                onChange={(v) => setThemeColor("surface", v)}
              />
              <ColorInput
                label="Text"
                value={theme.text}
                onChange={(v) => setThemeColor("text", v)}
              />
            </div>
          </div>

          {/* ── Actions ──────────────────────────────── */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm",
                canSend
                  ? "bg-sky-500 hover:bg-sky-600"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              <Send className="h-4 w-4" />
              {sendState.kind === "sending" ? "Sending…" : "Send email"}
            </button>
            <button
              type="button"
              onClick={copyHtml}
              className="inline-flex items-center gap-2 rounded-lg bg-white shadow-soft px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy HTML"}
            </button>

            {sendState.kind === "sent" && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-3 py-1.5">
                ✓ Sent to {sendState.to}
              </span>
            )}
            {sendState.kind === "error" && (
              <span className="text-xs font-medium text-red-700 bg-red-50 rounded-full px-3 py-1.5">
                {sendState.message}
              </span>
            )}
          </div>
        </div>

        {/* ── Live preview ───────────────────────────── */}
        <div className="card overflow-hidden xl:sticky xl:top-6">
          <div className="px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Live preview</h2>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">
                From: <span className={cn("font-medium", NAVY)}>{senderName}</span>
              </span>
              <button
                type="button"
                onClick={() => setMobilePreview(false)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  !mobilePreview
                    ? "bg-sky-50 text-sky-700"
                    : "text-gray-400 hover:text-gray-600"
                )}
                title="Desktop preview"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMobilePreview(true)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  mobilePreview
                    ? "bg-sky-50 text-sky-700"
                    : "text-gray-400 hover:text-gray-600"
                )}
                title="Mobile preview"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="bg-gray-50 flex justify-center p-4">
            <iframe
              title="email-preview"
              sandbox=""
              srcDoc={html}
              className={cn(
                "bg-white rounded-lg shadow-card h-[34rem] transition-all",
                mobilePreview ? "w-[375px]" : "w-full"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
