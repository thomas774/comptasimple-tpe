/**
 * Seed products/prices in the LIVE Stripe account.
 * Utilise STRIPE_SECRET_KEY_LIVE depuis les secrets Replit.
 * Run with: pnpm --filter @workspace/scripts run seed-products-production
 */
import Stripe from "stripe";

const PLANS = [
  {
    planKey: "starter",
    name: "Starter",
    description: "Pour micro-entrepreneurs et auto-entrepreneurs",
    unitAmount: 900,
  },
  {
    planKey: "pro",
    name: "Pro",
    description: "Pour TPE et petites entreprises",
    unitAmount: 1900,
  },
  {
    planKey: "business",
    name: "Business",
    description: "Pour PME avec besoins avancés",
    unitAmount: 3900,
  },
] as const;

async function seedProductionProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY_LIVE;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY_LIVE manquante — ajoutez votre clé live dans les secrets Replit.",
    );
  }

  if (secretKey.startsWith("sk_test_")) {
    throw new Error(
      "⚠️  La clé fournie est une clé TEST. Fournissez une clé sk_live_... pour le compte production.",
    );
  }

  console.log("🚀 Connexion au compte Stripe LIVE...");
  const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" as any });

  // Vérification rapide
  const balance = await stripe.balance.retrieve();
  console.log(`✓ Connecté (${balance.available[0]?.currency?.toUpperCase() ?? "EUR"})\n`);

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `metadata['planKey']:'${plan.planKey}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      const existingPrices = await stripe.prices.list({
        product: existing.data[0].id,
        active: true,
        limit: 1,
      });
      console.log(
        `✓ ${plan.name} existe déjà — product: ${existing.data[0].id}, price: ${existingPrices.data[0]?.id ?? "aucun"}`,
      );
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { planKey: plan.planKey },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.unitAmount,
      currency: "eur",
      recurring: { interval: "month" },
    });

    console.log(`✓ Créé: ${plan.name} — ${plan.unitAmount / 100}€/mois`);
    console.log(`  product: ${product.id}`);
    console.log(`  price:   ${price.id}\n`);
  }

  console.log("✓ Seed production terminé.");
}

seedProductionProducts().catch((err) => {
  console.error("Erreur:", (err as Error).message);
  process.exit(1);
});
