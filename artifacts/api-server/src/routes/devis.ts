import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, devisTable } from "@workspace/db";
import { CreateDevisBody, UpdateDevisBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/devis", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const devis = await db.select().from(devisTable)
    .where(eq(devisTable.userId, userId))
    .orderBy(devisTable.createdAt);
  res.json(devis);
});

router.post("/devis", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = CreateDevisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [d] = await db.insert(devisTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(d);
});

router.patch("/devis/:devisId", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const devisId = Array.isArray(req.params.devisId) ? req.params.devisId[0] : req.params.devisId;
  const parsed = UpdateDevisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [d] = await db.update(devisTable).set(parsed.data)
    .where(and(eq(devisTable.devisId, devisId), eq(devisTable.userId, userId)))
    .returning();
  if (!d) {
    res.status(404).json({ error: "Devis non trouvé" });
    return;
  }
  res.json(d);
});

export default router;
