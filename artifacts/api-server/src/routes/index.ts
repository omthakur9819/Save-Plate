import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(searchRouter);

export default router;

