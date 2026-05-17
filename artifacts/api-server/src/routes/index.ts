import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import invoicesRouter from "./invoices";
import devisRouter from "./devis";
import expensesRouter from "./expenses";
import transactionsRouter from "./transactions";
import bankRouter from "./bank";
import companyRouter from "./company";
import ocrRouter from "./ocr";
import subscriptionRouter from "./subscription";
import aiRouter from "./ai";
import gocardlessRouter from "./gocardless";
import tinkRouter from "./tink";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(invoicesRouter);
router.use(devisRouter);
router.use(expensesRouter);
router.use(transactionsRouter);
router.use(bankRouter);
router.use(companyRouter);
router.use(ocrRouter);
router.use(subscriptionRouter);
router.use(aiRouter);
router.use(gocardlessRouter);
router.use(tinkRouter);

export default router;
