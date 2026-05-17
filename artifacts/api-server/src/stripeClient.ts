import Stripe from "stripe";

async function getCredentials(): Promise<{ secretKey: string }> {
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";

  // En production déployée, utiliser la clé live stockée en secret
  if (isProduction) {
    const secretKey = process.env.STRIPE_SECRET_KEY_LIVE;
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY_LIVE manquante — ajoutez votre clé Stripe live dans les secrets Replit.",
      );
    }
    return { secretKey };
  }

  // En développement, utiliser l'intégration Replit (sandbox)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Variables d'environnement Replit manquantes — vérifiez que l'intégration Stripe est connectée.",
    );
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Erreur fetch Stripe credentials: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ settings?: { secret?: string } }>;
  };
  const secret = data.items?.[0]?.settings?.secret;

  if (!secret) {
    throw new Error("Stripe sandbox non connecté — connectez Stripe via l'onglet Intégrations.");
  }

  return { secretKey: secret };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" as any });
}

let _stripeSync: import("stripe-replit-sync").StripeSync | null = null;

export async function getStripeSync(): Promise<import("stripe-replit-sync").StripeSync> {
  if (_stripeSync) return _stripeSync;
  const { StripeSync } = await import("stripe-replit-sync");
  const { secretKey } = await getCredentials();
  _stripeSync = new StripeSync({
    poolConfig: { connectionString: process.env.DATABASE_URL!, max: 2 },
    stripeSecretKey: secretKey,
  });
  return _stripeSync;
}
