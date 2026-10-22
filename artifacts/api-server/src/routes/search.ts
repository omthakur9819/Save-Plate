import { Router, type IRouter } from "express";
import { SearchParseInput, ChatInput, z } from "@workspace/api-zod";
import { checkRateLimit, parseWithLLM } from "../lib/llm-search-parser";
import { checkChatRateLimit, chatWithAssistant } from "../lib/llm-chat-assistant";
import { HttpError } from "../lib/http-error";

const router: IRouter = Router();

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(1000),
      }),
    )
    .max(20),
  now: z.string().optional().default(() => new Date().toISOString()),
  timezone: z.string().optional().default("Asia/Kolkata"),
  userArea: z.string().optional(),
  listings: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        vendor: z.string().optional().default("Local Vendor"),
        category: z.string().optional().default("meals"),
        price: z.coerce.number().optional().default(100),
        originalPrice: z.coerce.number().optional().default(200),
        area: z.string().optional().default("Mumbai"),
        pickupWindow: z.string().optional().default("Today"),
        quantity: z.coerce.number().optional().default(1),
        dietaryTags: z.array(z.string()).optional().default([]),
        allergens: z.array(z.string()).optional().default([]),
        description: z.string().optional().default(""),
      }),
    )
    .max(100)
    .optional()
    .default([]),
});

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

router.post("/search/chat", async (req, res, next) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "anonymous";
    const clientKey = (res.locals.marketplaceUserId as string) || clientIp;

    if (!checkChatRateLimit(clientKey)) {
      throw new HttpError(429, "Too many chat requests. Please slow down.");
    }

    const input = ChatRequestSchema.parse(req.body);
    const chatResult = await chatWithAssistant(input);

    res.json(chatResult);
  } catch (error) {
    next(error);
  }
});

export default router;
