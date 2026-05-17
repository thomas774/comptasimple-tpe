import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, clientsTable } from "@workspace/db";
import { CreateClientBody, UpdateClientBody } from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const clients = await db.select().from(clientsTable)
    .where(eq(clientsTable.userId, userId))
    .orderBy(clientsTable.createdAt);
  res.json(clients);
});

router.post("/clients", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.insert(clientsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(client);
});

router.patch("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [client] = await db.update(clientsTable).set(parsed.data)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)))
    .returning();
  if (!client) {
    res.status(404).json({ error: "Client non trouvé" });
    return;
  }
  res.json(client);
});

router.delete("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [deleted] = await db.delete(clientsTable)
    .where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Client non trouvé" });
    return;
  }
  res.sendStatus(204);
});

export default router;
