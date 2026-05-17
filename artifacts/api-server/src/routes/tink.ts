import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bankAccountTable, transactionsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  isConfigured,
  buildTinkLinkUrl,
  exchangeCode,
  listAccounts,
  listTransactions,
  tinkAmountToFloat,
  type TinkTransaction,
} from "../lib/tink";

const router: IRouter = Router();

// ── GET /api/tink/status ──────────────────────────────────────────────────────
router.get("/tink/status", requireAuth, (_req, res): void => {
  res.json({ configured: isConfigured() });
});

// ── GET /api/tink/link ────────────────────────────────────────────────────────
// Returns the Tink Link URL to redirect the user to for bank auth
router.get("/tink/link", requireAuth, async (req, res): Promise<void> => {
  if (!isConfigured()) {
    res.status(503).json({ error: "Tink non configuré — ajoutez TINK_CLIENT_ID et TINK_CLIENT_SECRET" });
    return;
  }
  const redirectUri = (req.query.redirect_uri as string) || "";
  if (!redirectUri) {
    res.status(400).json({ error: "redirect_uri est requis" });
    return;
  }
  try {
    const url = buildTinkLinkUrl(redirectUri);
    res.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur Tink";
    res.status(502).json({ error: message });
  }
});

// ── POST /api/tink/sync ───────────────────────────────────────────────────────
// Called after user returns from Tink Link with ?code=...
// Exchanges the code, fetches accounts + transactions, stores in DB
router.post("/tink/sync", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const { code } = req.body as { code?: string };

  if (!code) {
    res.status(400).json({ error: "code est requis (retour de Tink Link)" });
    return;
  }
  if (!isConfigured()) {
    res.status(503).json({ error: "Tink non configuré" });
    return;
  }

  try {
    // 1. Exchange authorization code for user access token
    const tokenData = await exchangeCode(code);
    const userToken = tokenData.access_token;

    // 2. Fetch accounts
    const accounts = await listAccounts(userToken);
    if (accounts.length === 0) {
      res.status(400).json({ error: "Aucun compte bancaire trouvé dans Tink" });
      return;
    }

    // Use first checking/savings account, fallback to first
    const account =
      accounts.find(a => a.type === "CHECKING" || a.type === "SAVINGS") ??
      accounts[0];

    const iban = account.identifiers.iban?.iban ?? "";
    const accountName = account.name || "Compte bancaire";
    const balance = account.balances.booked
      ? tinkAmountToFloat(account.balances.booked.amount as Parameters<typeof tinkAmountToFloat>[0])
      : account.balances.available
        ? tinkAmountToFloat(account.balances.available.amount as Parameters<typeof tinkAmountToFloat>[0])
        : 0;

    // 3. Update bank account in DB
    await db.insert(bankAccountTable)
      .values({
        userId,
        name: accountName,
        iban,
        connected: true,
        gcRequisitionId: null,
        gcAccountId: account.id,
        gcLogoUrl: null,
      })
      .onConflictDoUpdate({
        target: bankAccountTable.userId,
        set: { name: accountName, iban, connected: true, gcAccountId: account.id, gcRequisitionId: null },
      });

    // 4. Fetch transactions (paginated, all pages)
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));

    let pageToken: string | undefined;
    let totalInserted = 0;

    do {
      const page = await listTransactions(userToken, account.id, pageToken);
      pageToken = page.nextPageToken;

      const rows = page.transactions
        .filter(tx => tx.dates.booked)
        .map(tx => {
          const amount = tinkAmountToFloat(tx.amount);
          const label =
            tx.descriptions.display ||
            tx.descriptions.original ||
            tx.merchantInformation?.merchantName ||
            "Transaction";
          return {
            userId,
            txId: tx.id,
            date: tx.dates.booked!,
            label: label.slice(0, 255),
            amount: String(Math.abs(amount)),
            type: amount >= 0 ? "credit" : "debit",
            category: amount >= 0 ? "Recette" : "Autre",
            vatRate: null as string | null,
            documentName: null as string | null,
          };
        });

      for (const row of rows) {
        await db.insert(transactionsTable).values(row).onConflictDoNothing();
        totalInserted++;
      }
    } while (pageToken);

    res.json({
      success: true,
      accountId: account.id,
      iban,
      accountName,
      balance,
      transactionsImported: totalInserted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur Tink";
    res.status(502).json({ error: message });
  }
});

// ── POST /api/tink/refresh ────────────────────────────────────────────────────
// Re-syncs with a new Tink Link session (user must re-authenticate — Tink tokens are short-lived)
// For now, returns an instruction to re-authenticate
router.post("/tink/refresh", requireAuth, async (_req, res): Promise<void> => {
  res.json({
    requiresReauth: true,
    message: "Pour actualiser les transactions, reconnectez votre banque via Tink.",
  });
});

// ── DELETE /api/tink/connection ───────────────────────────────────────────────
router.delete("/tink/connection", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  await db.insert(bankAccountTable)
    .values({ userId, name: "", iban: "", connected: false, gcRequisitionId: null, gcAccountId: null })
    .onConflictDoUpdate({
      target: bankAccountTable.userId,
      set: { connected: false, gcRequisitionId: null, gcAccountId: null, name: "", iban: "" },
    });

  res.json({ success: true });
});

export default router;
