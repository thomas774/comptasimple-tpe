import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, companyTable } from "@workspace/db";
import { UpsertCompanyBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/company", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const [company] = await db.select().from(companyTable)
    .where(eq(companyTable.userId, userId))
    .limit(1);
  if (!company) {
    res.json({ id: 0, userId, name: "", legalForm: "", siret: "", vatNumber: "", address: "", postalCode: "", city: "", phone: "", email: "", website: "", iban: "", logo: "" });
    return;
  }
  res.json(company);
});

router.put("/company", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = UpsertCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(companyTable)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({ target: companyTable.userId, set: parsed.data })
    .returning();
  res.json(result);
});

export default router;
