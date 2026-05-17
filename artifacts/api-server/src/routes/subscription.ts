import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth.js";
import type { AuthedRequest } from "../middlewares/requireAuth.js";
import { stripeStorage } from "../stripeStorage.js";
import { getUncachableStripeClient } from "../stripeClient.js";

const router = Router();

const VALID_PLANS = ["starter", "pro", "business"] as const;
type PlanKey = (typeof VALID_PLANS)[number];

router.get("/subscription/status", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;

  let sub = await stripeStorage.getSubscriptionByUserId(userId);
  if (!sub) {
    sub = await stripeStorage.createTrialSubscription(userId);
  }

  const now = new Date();

  if (sub.stripeCustomerId) {
    const stripeSub = await stripeStorage.getActiveStripeSubscription(sub.stripeCustomerId);
    if (stripeSub) {
      sub = await stripeStorage.updateSubscription(userId, {
        status: "active",
        stripeSubscriptionId: stripeSub.id,
        plan: stripeSub.planKey,
        currentPeriodEnd: stripeSub.currentPeriodEnd,
      });
      res.json({
        status: "active",
        daysRemaining: null,
        plan: sub.plan,
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
      });
      return;
    }
  }

  let status = sub.status;
  if (status === "trial" && sub.trialEndsAt < now) {
    sub = await stripeStorage.updateSubscription(userId, { status: "expired" });
    status = "expired";
  }
  if (status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
    sub = await stripeStorage.updateSubscription(userId, { status: "expired" });
    status = "expired";
  }

  const daysRemaining =
    status === "trial"
      ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000))
      : null;

  res.json({
    status,
    daysRemaining,
    plan: sub.plan,
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: sub.currentPeriodEnd,
  });
});

router.post("/subscription/checkout", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  const { planKey } = req.body as { planKey: string };

  if (!VALID_PLANS.includes(planKey as PlanKey)) {
    res.status(400).json({ error: "Plan invalide" });
    return;
  }

  const priceId = await stripeStorage.getPriceIdForPlan(planKey);
  if (!priceId) {
    res.status(503).json({
      error: "Tarif introuvable. Les prix ne sont pas encore configurés dans Stripe. Lancez le script seed-products.",
    });
    return;
  }

  let sub = await stripeStorage.getSubscriptionByUserId(userId);
  if (!sub) {
    sub = await stripeStorage.createTrialSubscription(userId);
  }

  let customerId = sub.stripeCustomerId;
  if (!customerId) {
    const clerkAuth = getAuth(req);
    const claims = (clerkAuth as any).sessionClaims ?? {};
    const email: string = claims.email ?? "";
    const name: string = claims.name ?? "";

    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });
    customerId = customer.id;
    sub = await stripeStorage.updateSubscription(userId, { stripeCustomerId: customerId });
  }

  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.get("host") ?? "";
  const origin = `${proto}://${host}`;

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${origin}/?subscription=success`,
    cancel_url: `${origin}/?subscription=cancelled`,
    metadata: { userId, planKey },
  });

  res.json({ url: session.url });
});

router.post("/subscription/portal", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthedRequest;
  const sub = await stripeStorage.getSubscriptionByUserId(userId);

  if (!sub?.stripeCustomerId) {
    res.status(404).json({ error: "Aucun compte Stripe trouvé" });
    return;
  }

  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.get("host") ?? "";
  const origin = `${proto}://${host}`;

  const stripe = await getUncachableStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/`,
  });

  res.json({ url: session.url });
});

export default router;
