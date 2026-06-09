import { Resend } from "resend";

let _resend: Resend | null = null;

/**
 * Lazily instantiate the Resend client. We avoid creating it at module load
 * because `new Resend("")` throws when RESEND_API_KEY is unset — which would
 * break the production build while collecting page data for routes that import
 * this module. A placeholder key keeps construction safe; real sends require a
 * valid key in the environment.
 */
export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
  }
  return _resend;
}

export const EMAIL_FROM = `${process.env.RESEND_FROM_NAME ?? "ConversionCRM"} <${process.env.RESEND_FROM_EMAIL ?? "noreply@conversioncrm.io"}>`;
