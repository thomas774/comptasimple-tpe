import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bankAccountTable, transactionsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import {
  isConfigured,
  getInstitutions,
  createRequisition,
  getRequisition,
  getAccountDetails,
  getAccountBalances,
  getAccountTransactions,
  deleteRequisition,
  type GcTransaction,
} from "../lib/gocardless";

const router: IRouter = Router();

// ── GET /api/gocardless/status ──────────────────────────────────────────────
router.get("/gocardless/status", requireAuth, (_req, res): void => {
  res.json({ configured: isConfigured() });
});

// ── GET /api/gocardless/institutions ────────────────────────────────────────
router.get("/gocardless/institutions", requireAuth, async (_req, res): Promise<void> => {
  if (!isConfigured()) {
    res.status(503).json({ error: "GoCardless non configuré — ajoutez GOCARDLESS_SECRET_ID et GOCARDLESS_SECRET_KEY" });
    return;
  }
  try {
    const institutions = await getInstitutions("fr");
    res.json(institutions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur GoCardless";
    res.status(502).json({ error: message });
  }
});

// ── POST /api/gocardless/requisition ────────────────────────────────────────
router.post("/gocardless/requisition", requireAuth, async (req, res): Promise<void> => {
  if (!isConfigured()) {
    res.status(503).json({ error: "GoCardless non configuré" });
    return;
  }

  const { institutionId, redirectUrl, institutionName, logoUrl } = req.body as {
    institutionId: string;
    redirectUrl: string;
    institutionName?: string;
    logoUrl?: string;
  };

  if (!institutionId || !redirectUrl) {
    res.status(400).json({ error: "institutionId et redirectUrl sont requis" });
    return;
  }

  const { userId } = req as AuthedRequest;

  try {
    const reference = `compta-${userId.slice(0, 8)}-${Date.now()}`;
    const requisition = await createRequisition(institutionId, redirectUrl, reference);

    // Store requisition ID and bank name in DB (pre-connection)
    await db.insert(bankAccountTable)
      .values({
        userId,
        name: institutionName ?? "",
        iban: "",
        connected: false,
        gcRequisitionId: requisition.id,
        gcAccountId: null,
        gcLogoUrl: logoUrl ?? null,
      })
      .onConflictDoUpdate({
        target: bankAccountTable.userId,
        set: {
          name: institutionName ?? "",
          gcRequisitionId: requisition.id,
          gcAccountId: null,
          gcLogoUrl: logoUrl ?? null,
          connected: false,
        },
      });

    res.json({ requisitionId: requisition.id, link: requisition.link });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur GoCardless";
    res.status(502).json({ error: message });
  }
});

// ── POST /api/gocardless/sync ────────────────────────────────────────────────
// Called after the user returns from bank auth — syncs accounts + transactions
router.post("/gocardless/sync", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const { requisitionId } = req.body as { requisitionId?: string };

  // Determine which requisition to use
  let reqId = requisitionId;
  if (!reqId) {
    const [account] = await db.select().from(bankAccountTable)
      .where(eq(bankAccountTable.userId, userId)).limit(1);
    reqId = account?.gcRequisitionId ?? undefined;
  }

  if (!reqId) {
    res.status(400).json({ error: "Aucune connexion bancaire en attente" });
    return;
  }

  if (!isConfigured()) {
    res.status(503).json({ error: "GoCardless non configuré" });
    return;
  }

  try {
    // Get accounts from requisition
    const requisition = await getRequisition(reqId);

    if (!requisition.accounts || requisition.accounts.length === 0) {
      res.status(400).json({ error: "Aucun compte disponible — assurez-vous d'avoir complété l'authentification bancaire" });
      return;
    }

    // Use first account
    const accountId = requisition.accounts[0];

    // Fetch account details (IBAN, name)
    const details = await getAccountDetails(accountId);

    // Fetch balances
    const balances = await getAccountBalances(accountId);
    const closingBalance = balances.find(b =>
      b.balanceType === "closingBooked" || b.balanceType === "expected" || b.balanceType === "interimAvailable"
    );
    const balanceAmount = closingBalance ? parseFloat(closingBalance.balanceAmount.amount) : 0;

    // Fetch transactions (last 90 days)
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const txData = await getAccountTransactions(accountId, dateFrom);
    const allTxs: GcTransaction[] = [...txData.booked, ...txData.pending];

    // Update bank account in DB
    await db.insert(bankAccountTable)
      .values({
        userId,
        name: details.name || details.ownerName || requisition.institution_id,
        iban: details.iban ?? "",
        connected: true,
        gcRequisitionId: reqId,
        gcAccountId: accountId,
      })
      .onConflictDoUpdate({
        target: bankAccountTable.userId,
        set: {
          name: details.name || details.ownerName || requisition.institution_id,
          iban: details.iban ?? "",
          connected: true,
          gcRequisitionId: reqId,
          gcAccountId: accountId,
        },
      });

    // Delete existing transactions for this user (replace with real ones)
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));

    // Map and insert GoCardless transactions
    const rows = allTxs
      .filter(tx => tx.bookingDate)
      .map((tx) => {
        const amount = parseFloat(tx.transactionAmount.amount);
        const label =
          tx.remittanceInformationUnstructured ||
          tx.remittanceInformationStructured ||
          (amount > 0 ? tx.debtorName : tx.creditorName) ||
          "Transaction";
        const txId = tx.transactionId || tx.internalTransactionId || `gc-${Date.now()}-${Math.random()}`;
        return {
          userId,
          txId,
          date: tx.bookingDate,
          label: label.slice(0, 255),
          amount: String(Math.abs(amount)),
          type: amount >= 0 ? "credit" : "debit",
          category: amount >= 0 ? "Recette" : "Autre",
          vatRate: null as string | null,
          documentName: null as string | null,
        };
      });

    if (rows.length > 0) {
      // Insert with conflict handling (skip duplicates by txId)
      for (const row of rows) {
        await db.insert(transactionsTable)
          .values(row)
          .onConflictDoNothing();
      }
    }

    res.json({
      success: true,
      accountId,
      iban: details.iban,
      accountName: details.name || details.ownerName,
      balance: balanceAmount,
      transactionsImported: rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur GoCardless";
    res.status(502).json({ error: message });
  }
});

// ── POST /api/gocardless/refresh ─────────────────────────────────────────────
// Re-sync transactions for an already connected account
router.post("/gocardless/refresh", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  if (!isConfigured()) {
    res.status(503).json({ error: "GoCardless non configuré" });
    return;
  }

  const [account] = await db.select().from(bankAccountTable)
    .where(eq(bankAccountTable.userId, userId)).limit(1);

  if (!account?.gcAccountId) {
    res.status(400).json({ error: "Aucun compte bancaire connecté" });
    return;
  }

  try {
    const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const txData = await getAccountTransactions(account.gcAccountId, dateFrom);
    const allTxs: GcTransaction[] = [...txData.booked, ...txData.pending];

    // Fetch updated balances
    const balances = await getAccountBalances(account.gcAccountId);
    const closingBalance = balances.find(b =>
      b.balanceType === "closingBooked" || b.balanceType === "expected" || b.balanceType === "interimAvailable"
    );
    const balanceAmount = closingBalance ? parseFloat(closingBalance.balanceAmount.amount) : 0;

    // Insert new transactions (skip existing)
    const rows = allTxs
      .filter(tx => tx.bookingDate && (tx.transactionId || tx.internalTransactionId))
      .map((tx) => {
        const amount = parseFloat(tx.transactionAmount.amount);
        const label =
          tx.remittanceInformationUnstructured ||
          tx.remittanceInformationStructured ||
          (amount > 0 ? tx.debtorName : tx.creditorName) ||
          "Transaction";
        return {
          userId,
          txId: tx.transactionId || tx.internalTransactionId!,
          date: tx.bookingDate,
          label: label.slice(0, 255),
          amount: String(Math.abs(amount)),
          type: amount >= 0 ? "credit" : "debit",
          category: amount >= 0 ? "Recette" : "Autre",
          vatRate: null as string | null,
          documentName: null as string | null,
        };
      });

    let inserted = 0;
    for (const row of rows) {
      const result = await db.insert(transactionsTable)
        .values(row)
        .onConflictDoNothing()
        .returning();
      inserted += result.length;
    }

    res.json({ success: true, balance: balanceAmount, newTransactions: inserted, total: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur GoCardless";
    res.status(502).json({ error: message });
  }
});

// ── DELETE /api/gocardless/requisition ──────────────────────────────────────
router.delete("/gocardless/requisition", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;

  const [account] = await db.select().from(bankAccountTable)
    .where(eq(bankAccountTable.userId, userId)).limit(1);

  if (account?.gcRequisitionId && isConfigured()) {
    try {
      await deleteRequisition(account.gcRequisitionId);
    } catch {
      // Ignore GoCardless errors on delete
    }
  }

  // Disconnect in DB
  await db.insert(bankAccountTable)
    .values({ userId, name: "", iban: "", connected: false, gcRequisitionId: null, gcAccountId: null })
    .onConflictDoUpdate({
      target: bankAccountTable.userId,
      set: { connected: false, gcRequisitionId: null, gcAccountId: null, name: "", iban: "" },
    });

  res.json({ success: true });
});

export default router;
