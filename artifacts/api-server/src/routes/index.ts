import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard";
import healthRouter from "./health";
import productsRouter from "./products";
import salesRouter from "./sales";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(productsRouter);
router.use(salesRouter);

export default router;
