import { Router, type IRouter } from "express";
import { SearchParseInput } from "@workspace/api-zod";
import { checkRateLimit, parseWithLLM } from "../lib/llm-search-parser";
import { HttpError } from "../lib/http-error";

const router: IRouter = Router();

router.post("/search/parse", async (req, res, next) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "anonymous";
    const clientKey = (res.locals.marketplaceUserId as string) || clientIp;

    if (!checkRateLimit(clientKey)) {
      throw new HttpError(429, "Too many search requests. Please slow down.");
    }

    const input = SearchParseInput.parse(req.body);
    const parsedFilters = await parseWithLLM(input);

    res.json(parsedFilters);
  } catch (error) {
    next(error);
  }
});

export default router;
