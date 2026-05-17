import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import { CreateExpenseBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/expenses", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const expenses = await db.select().from(expensesTable)
    .where(eq(expensesTable.userId, userId))
    .orderBy(expensesTable.createdAt);
  res.json(expenses);
});

router.post("/expenses", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db.insert(expensesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(expense);
});

export default router;
