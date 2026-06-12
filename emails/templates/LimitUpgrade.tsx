import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

interface LimitUpgradeEmailProps {
  userName: string;
  limitLabel: string;
  checkoutUrl?: string;
  appUrl?: string;
  productName?: string;
}

export function LimitUpgradeEmail({
  userName,
  limitLabel,
  checkoutUrl,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
  productName,
}: LimitUpgradeEmailProps) {
  const ctaUrl = checkoutUrl ?? `${appUrl}/pricing`;

  return (
    <EmailShell
      preview={`Your ${limitLabel} on ${productName ?? "the platform"} has ended`}
      heading="You've reached your free limit"
      userName={userName}
      ctaLabel="Upgrade to keep going →"
      ctaUrl={ctaUrl}
      productName={productName}
    >
      <Text style={emailText}>
        Your <strong>{limitLabel}</strong> on{" "}
        {productName ?? "the platform"} has ended. To keep using everything
        without interruption, upgrade your plan.
      </Text>
      <Text style={emailText}>
        If you have questions about plans or what&apos;s included, just reply
        to this email — we&apos;re happy to help.
      </Text>
    </EmailShell>
  );
}

export default LimitUpgradeEmail;
