import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe(): Promise<void> {
  try {
    const { getUncachableStripeClient } = await import("./stripeClient.js");
    const stripe = await getUncachableStripeClient();
    const balance = await stripe.balance.retrieve();
    logger.info({ available: balance.available.length }, "Stripe connecté");
  } catch (err) {
    logger.error({ err }, "Stripe non disponible — le serveur continue sans paiements");
  }
}

initStripe().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
