import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  BulkCreateTransactionsBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const txs = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(transactionsTable.date);
  res.json(txs);
});

router.post("/transactions/bulk", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = BulkCreateTransactionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.transactions.length === 0) {
    res.status(201).json([]);
    return;
  }
  const rows = parsed.data.transactions.map((t) => ({ ...t, userId }));
  const txs = await db.insert(transactionsTable).values(rows).returning();
  res.status(201).json(txs);
});

router.post("/transactions", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tx] = await db.insert(transactionsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(tx);
});

router.patch("/transactions/:txId", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const txId = Array.isArray(req.params.txId) ? req.params.txId[0] : req.params.txId;
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tx] = await db
    .update(transactionsTable)
    .set(parsed.data)
    .where(and(eq(transactionsTable.txId, txId), eq(transactionsTable.userId, userId)))
    .returning();
  if (!tx) {
    res.status(404).json({ error: "Transaction non trouvée" });
    return;
  }
  res.json(tx);
});

export default router;
