/**
 * Renderer for hand-composed emails built in the dashboard composer.
 *
 * Pure string templating — shared by the client (live preview) and the
 * send API (server renders the final HTML itself; client-supplied HTML is
 * never trusted). All text is HTML-escaped, URLs are scheme-checked, and
 * colors must be valid hex — so composer input can't inject markup.
 */

export type EmailTheme = {
  /** Buttons, links, accent bar. */
  accent: string;
  /** Page background behind the card. */
  background: string;
  /** Card surface. */
  surface: string;
  /** Main copy color. */
  text: string;
  /** Footer / secondary copy. */
  muted: string;
  /** Text on accent-colored elements. */
  accentText: string;
};

export const EMAIL_THEME_PRESETS: { id: string; name: string; theme: EmailTheme }[] = [
  {
    id: "sky",
    name: "Sky",
    theme: {
      accent: "#0ea5e9",
      background: "#eff8ff",
      surface: "#ffffff",
      text: "#111827",
      muted: "#6b7280",
      accentText: "#ffffff",
    },
  },
  {
    id: "navy",
    name: "Navy",
    theme: {
      accent: "#0b3a5e",
      background: "#f1f5f9",
      surface: "#ffffff",
      text: "#0f172a",
      muted: "#64748b",
      accentText: "#ffffff",
    },
  },
  {
    id: "forest",
    name: "Forest",
    theme: {
      accent: "#059669",
      background: "#f0fdf4",
      surface: "#ffffff",
      text: "#14271d",
      muted: "#6b7280",
      accentText: "#ffffff",
    },
  },
  {
    id: "slate",
    name: "Slate",
    theme: {
      accent: "#111827",
      background: "#f6f7f9",
      surface: "#ffffff",
      text: "#111827",
      muted: "#6b7280",
      accentText: "#ffffff",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    theme: {
      accent: "#ea580c",
      background: "#fff7ed",
      surface: "#ffffff",
      text: "#1f2937",
      muted: "#78716c",
      accentText: "#ffffff",
    },
  },
  {
    id: "plum",
    name: "Plum",
    theme: {
      accent: "#7c3aed",
      background: "#f8f5ff",
      surface: "#ffffff",
      text: "#1e1b2e",
      muted: "#6b7280",
      accentText: "#ffffff",
    },
  },
];

export type CustomEmailInput = {
  subject: string;
  preheader?: string;
  heading?: string;
  /** Plain text; blank lines split paragraphs. */
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerText?: string;
  senderName?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function sanitizeHexColor(value: string | undefined, fallback: string): string {
  if (value && HEX_COLOR.test(value.trim())) return value.trim();
  return fallback;
}

/** Allows only http(s) and mailto links; everything else is dropped. */
export function sanitizeUrl(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  return null;
}

export function sanitizeTheme(theme: Partial<EmailTheme> | undefined): EmailTheme {
  const base = EMAIL_THEME_PRESETS[0].theme;
  return {
    accent: sanitizeHexColor(theme?.accent, base.accent),
    background: sanitizeHexColor(theme?.background, base.background),
    surface: sanitizeHexColor(theme?.surface, base.surface),
    text: sanitizeHexColor(theme?.text, base.text),
    muted: sanitizeHexColor(theme?.muted, base.muted),
    accentText: sanitizeHexColor(theme?.accentText, base.accentText),
  };
}

/** Renders the final email-safe HTML document. */
export function renderCustomEmailHtml(
  input: CustomEmailInput,
  rawTheme?: Partial<EmailTheme>
): string {
  const t = sanitizeTheme(rawTheme);

  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:${t.text};font-size:15px;line-height:1.65;">${escapeHtml(
          p
        ).replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");

  const ctaUrl = sanitizeUrl(input.ctaUrl);
  const ctaLabel = input.ctaLabel?.trim();
  const ctaBlock =
    ctaUrl && ctaLabel
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
          <tr><td align="center">
            <a href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener"
               style="display:inline-block;background-color:${t.accent};color:${t.accentText};font-size:15px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;">
              ${escapeHtml(ctaLabel)}
            </a>
          </td></tr>
        </table>`
      : "";

  const heading = input.heading?.trim()
    ? `<h1 style="margin:0 0 20px;color:${t.text};font-size:22px;font-weight:700;line-height:1.35;">${escapeHtml(
        input.heading.trim()
      )}</h1>`
    : "";

  const preheader = input.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
        input.preheader.trim()
      )}</div>`
    : "";

  const footer = input.footerText?.trim()
    ? escapeHtml(input.footerText.trim())
    : `Sent by ${escapeHtml(input.senderName?.trim() || "our team")}. Reply to this email and a real person will see it.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${t.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${t.background};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
      <tr><td style="height:4px;background-color:${t.accent};border-radius:8px 8px 0 0;"></td></tr>
      <tr><td style="background-color:${t.surface};border:1px solid rgba(15,23,42,0.06);border-top:none;border-radius:0 0 12px 12px;padding:40px;">
        ${heading}
        ${paragraphs}
        ${ctaBlock}
        <hr style="border:none;border-top:1px solid rgba(15,23,42,0.08);margin:28px 0 20px;"/>
        <p style="margin:0;color:${t.muted};font-size:13px;line-height:1.5;">${footer}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
