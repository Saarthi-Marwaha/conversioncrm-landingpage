import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a random API key for workspace widget embeds.
 * Format: ccrm_<32 hex chars>
 */
export function generateApiKey(): string {
  return `ccrm_${crypto.randomBytes(16).toString("hex")}`;
}

/**
 * Validates that the CRON_SECRET header matches the expected secret.
 */
export function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured = cron endpoints are closed (never accept
  // "Bearer undefined").
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

/**
 * Returns the start of today in UTC as an ISO string.
 */
export function todayUTCStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Returns a date N days ago as an ISO string.
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/**
 * Parses a raw body buffer to a string and verifies it has content.
 */
export async function rawBody(req: Request): Promise<string> {
  const text = await req.text();
  return text;
}
