import {
  lemonSqueezySetup,
  createCheckout,
  getSubscription,
  type Subscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import crypto from "crypto";

// Initialize the SDK with your API key once at startup
lemonSqueezySetup({
  apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  onError: (error) => {
    console.error("[LemonSqueezy]", error);
  },
});

/**
 * Creates a checkout URL for a given variant, pre-filled with user info.
 */
export async function createCheckoutUrl({
  variantId,
  userEmail,
  userName,
  customData,
}: {
  variantId: string;
  userEmail: string;
  userName?: string;
  customData?: Record<string, string>;
}): Promise<string | null> {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID!;

  const { data, error } = await createCheckout(storeId, variantId, {
    checkoutData: {
      email: userEmail,
      name: userName,
      custom: customData,
    },
    checkoutOptions: {
      embed: false,
      media: true,
      logo: true,
    },
    productOptions: {
      enabledVariants: [Number(variantId)],
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
      receiptButtonText: "Go to Dashboard",
    },
  });

  if (error) {
    console.error("[LemonSqueezy] createCheckout error:", error);
    return null;
  }

  return data?.data.attributes.url ?? null;
}

/**
 * Fetches the current status of a subscription by its LS subscription ID.
 */
export async function getSubscriptionStatus(
  lsSubscriptionId: string
): Promise<Subscription["data"]["attributes"] | null> {
  const { data, error } = await getSubscription(lsSubscriptionId);

  if (error) {
    console.error("[LemonSqueezy] getSubscription error:", error);
    return null;
  }

  return data?.data.attributes ?? null;
}

/**
 * Verifies a Lemon Squeezy webhook signature.
 * Returns true if the signature is valid.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[LemonSqueezy] LEMONSQUEEZY_WEBHOOK_SECRET is not set");
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // timingSafeEqual throws on length mismatch — treat that as a bad
  // signature rather than letting a malformed header bubble up as a 500.
  const digestBuf = Buffer.from(digest, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (digestBuf.length !== signatureBuf.length || signatureBuf.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(digestBuf, signatureBuf);
}
