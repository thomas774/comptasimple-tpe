import { getUncachableStripeClient } from "./stripeClient.js";

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

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Création des produits et tarifs Stripe ComptaSimple...");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `metadata['planKey']:'${plan.planKey}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(`✓ ${plan.name} existe déjà (${existing.data[0].id})`);
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

    console.log(
      `✓ Créé: ${plan.name} — ${plan.unitAmount / 100}€/mois (product: ${product.id}, price: ${price.id})`,
    );
  }

  console.log("✓ Seed terminé.");
}

seedProducts().catch((err) => {
  console.error("Erreur seed:", err);
  process.exit(1);
});
