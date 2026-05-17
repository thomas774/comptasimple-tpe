import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bankAccountTable } from "@workspace/db";
import { UpsertBankAccountBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/bank-account", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const [account] = await db.select().from(bankAccountTable)
    .where(eq(bankAccountTable.userId, userId))
    .limit(1);
  if (!account) {
    res.json({ id: 0, userId, name: "", iban: "", connected: false });
    return;
  }
  res.json(account);
});

router.put("/bank-account", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = UpsertBankAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(bankAccountTable)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({ target: bankAccountTable.userId, set: parsed.data })
    .returning();
  res.json(result);
});

export default router;
