import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Subscription } from "@workspace/db";

const TRIAL_DAYS = 7;

export class StripeStorage {
  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));
    return sub ?? null;
  }

  async createTrialSubscription(userId: string): Promise<Subscription> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const [sub] = await db
      .insert(subscriptionsTable)
      .values({ userId, trialEndsAt, status: "trial" })
      .onConflictDoNothing()
      .returning();

    if (!sub) {
      const existing = await this.getSubscriptionByUserId(userId);
      return existing!;
    }
    return sub;
  }

  async updateSubscription(
    userId: string,
    data: Partial<Omit<Subscription, "id" | "userId" | "createdAt">>
  ): Promise<Subscription> {
    const [sub] = await db
      .update(subscriptionsTable)
      .set(data)
      .where(eq(subscriptionsTable.userId, userId))
      .returning();
    return sub;
  }

  /**
   * Look up the Stripe price ID for a plan key by searching the Stripe API directly.
   */
  async getPriceIdForPlan(planKey: string): Promise<string | null> {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient.js");
      const stripe = await getUncachableStripeClient();

      const products = await stripe.products.search({
        query: `metadata['planKey']:'${planKey}' AND active:'true'`,
      });
      const product = products.data[0];
      if (!product) return null;

      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 1,
        recurring: { interval: "month" },
      } as Parameters<typeof stripe.prices.list>[0]);

      return prices.data[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Check Stripe API directly for an active subscription by customer ID.
   * Falls back gracefully if Stripe is unavailable.
   */
  async getActiveStripeSubscription(stripeCustomerId: string): Promise<{
    id: string;
    planKey: string | null;
    currentPeriodEnd: Date;
  } | null> {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient.js");
      const stripe = await getUncachableStripeClient();

      const subs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "active",
        limit: 1,
        expand: ["data.items.data.price.product"],
      });

      const sub = subs.data[0];
      if (!sub) return null;

      const priceProduct = sub.items.data[0]?.price?.product;
      const planKey =
        priceProduct && typeof priceProduct === "object" && "metadata" in priceProduct
          ? ((priceProduct as { metadata?: Record<string, string> }).metadata?.planKey ?? null)
          : null;

      return {
        id: sub.id,
        planKey,
        currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
      };
    } catch {
      return null;
    }
  }
}

export const stripeStorage = new StripeStorage();
