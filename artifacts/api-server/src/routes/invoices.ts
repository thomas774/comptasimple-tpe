import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, invoicesTable } from "@workspace/db";
import { CreateInvoiceBody, UpdateInvoiceBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/invoices", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const invoices = await db.select().from(invoicesTable)
    .where(eq(invoicesTable.userId, userId))
    .orderBy(invoicesTable.createdAt);
  res.json(invoices);
});

router.post("/invoices", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [invoice] = await db.insert(invoicesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(invoice);
});

router.patch("/invoices/:invoiceId", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [invoice] = await db.update(invoicesTable).set(parsed.data)
    .where(and(eq(invoicesTable.invoiceId, invoiceId), eq(invoicesTable.userId, userId)))
    .returning();
  if (!invoice) {
    res.status(404).json({ error: "Facture non trouvée" });
    return;
  }
  res.json(invoice);
});

export default router;
