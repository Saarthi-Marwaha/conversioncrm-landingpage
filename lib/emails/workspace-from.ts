import { formatEmailFrom } from "@/lib/resend";

type WorkspaceSenderFields = {
  email_sender_name?: string | null;
  product_name?: string | null;
  name?: string | null;
};

/** Resolve the display name for the From header. */
export function workspaceSenderName(ws: WorkspaceSenderFields): string {
  const custom = ws.email_sender_name?.trim();
  if (custom) return custom;
  const product = ws.product_name?.trim();
  if (product) return product;
  const company = ws.name?.trim();
  if (company) return company;
  return process.env.RESEND_FROM_NAME ?? "ConversionCRM";
}

export function emailFromForWorkspace(ws: WorkspaceSenderFields): string {
  return formatEmailFrom(workspaceSenderName(ws));
}
