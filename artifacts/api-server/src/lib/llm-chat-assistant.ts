export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ActiveListingSummary {
  id: string;
  name: string;
  vendor: string;
  category: string;
  price: number;
  originalPrice: number;
  area: string;
  pickupWindow: string;
  quantity: number;
  dietaryTags: string[];
  allergens: string[];
  description: string;
}

export interface ChatInput {
  messages: ChatMessage[];
  listings: ActiveListingSummary[];
  now: string;
  timezone: string;
  userArea?: string;
}

export interface ChatResponse {
  reply: string;
  listingIds: string[];
  intent: "search" | "info" | "fallback";
}

// Rate limiting (per-user / per-IP, max 20 requests per minute)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_CHAT_REQUESTS_PER_WINDOW = 20;
const chatRateLimitMap = new Map<string, number[]>();

export function checkChatRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const timestamps = chatRateLimitMap.get(clientKey) ?? [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_CHAT_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  chatRateLimitMap.set(clientKey, validTimestamps);
  return true;
}

export function extractMaxPrice(text: string): number | null {
  // Matches "under ₹100", "under 100", "below 100", "sub 100", "within 100", "less than 100", "< 100", "under 100rs"
  const prefixMatch = text.match(
    /(?:under|below|sub|within|less than|<|budget of|max(?:imum)?)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i,
  );
  if (prefixMatch) return parseInt(prefixMatch[1], 10);

  // Matches "100rs", "100 rs", "100 rupees", "100 bucks", "100 inr", "₹100 or less"
  const suffixMatch = text.match(
    /(\d+)\s*(?:₹|rs\.?|rupees|bucks|inr|\/-)\s*(?:under|or less|below|max)?/i,
  );
  if (
    suffixMatch &&
    (text.includes("under") ||
      text.includes("below") ||
      text.includes("less") ||
      suffixMatch[0].includes("rs") ||
      suffixMatch[0].includes("rupees"))
  ) {
    return parseInt(suffixMatch[1], 10);
  }

  // Matches "₹100" preceded or followed by under/below/budget
  const symbolMatch = text.match(/₹\s*(\d+)/);
  if (
    symbolMatch &&
    (text.includes("under") ||
      text.includes("below") ||
      text.includes("cheap") ||
      text.includes("budget"))
  ) {
    return parseInt(symbolMatch[1], 10);
  }

  return null;
}

export function extractCategory(text: string): "bakery" | "cafe" | "meals" | null {
  const t = text.toLowerCase();
  if (
    t.includes("bakery") ||
    t.includes("bread") ||
    t.includes("croissant") ||
    t.includes("pastry") ||
    t.includes("cake") ||
    t.includes("cruffin") ||
    t.includes("sourdough") ||
    t.includes("brioche") ||
    t.includes("focaccia") ||
    t.includes("babka") ||
    t.includes("tart") ||
    t.includes("bun")
  ) {
    return "bakery";
  }
  if (
    t.includes("cafe") ||
    t.includes("coffee") ||
    t.includes("chai") ||
    t.includes("tea") ||
    t.includes("sandwich") ||
    t.includes("snack") ||
    t.includes("nashta")
  ) {
    return "cafe";
  }
  if (
    t.includes("meal") ||
    t.includes("lunch") ||
    t.includes("dinner") ||
    t.includes("thali") ||
    t.includes("biryani") ||
    t.includes("rice") ||
    t.includes("roti") ||
    t.includes("curry")
  ) {
    return "meals";
  }
  return null;
}

const MUMBAI_AREAS = [
  "bandra",
  "khar",
  "colaba",
  "lower parel",
  "dadar",
  "juhu",
  "andheri",
  "powai",
  "santacruz",
  "bkc",
  "churchgate",
  "marine drive",
  "worli",
  "kemps corner",
  "fort",
  "byculla",
  "vile parle",
  "matunga",
  "sion",
];

export const NON_VEG_WORDS = [
  "chicken",
  "mutton",
  "kheema",
  "keema",
  "meat",
  "fish",
  "prawn",
  "prawns",
  "seafood",
  "bacon",
  "pork",
  "lamb",
  "gosht",
  "egg",
];

export function isItemNonVeg(l: ActiveListingSummary): boolean {
  const text = `${l.name} ${l.description} ${l.vendor} ${l.category}`.toLowerCase();
  const hasNonVegWord = NON_VEG_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));
  const hasVegTitle = /\b(veg|veggie|vegetables?|shakahari|jain|vegan)\b/i.test(l.name);
  const tags = (l.dietaryTags || []).map((t) => t.toLowerCase());
  const isPureVegTagged =
    tags.includes("veg") ||
    tags.includes("vegetarian") ||
    tags.includes("vegan") ||
    tags.includes("jain");
  return hasNonVegWord && (!hasVegTitle || !isPureVegTagged);
}

export function extractDietary(text: string): {
  veg?: boolean;
  nonVeg?: boolean;
  vegan?: boolean;
  eggless?: boolean;
  nutFree?: boolean;
} {
  const t = text.toLowerCase();
  const nonVeg =
    /\b(non[- ]?veg(?:etarian)?|no[- ]veg|not[- ]veg|mansahari|chicken|mutton|meat|fish|prawns?|kheema|keema|seafood|pork|bacon|lamb|gosht)\b/i.test(
      t,
    );

  return {
    nonVeg,
    veg: !nonVeg && /(?<!no\s+|non[- ]?|not\s+)\b(veg|veggie|vegetarians?|shakahari)\b/i.test(t),
    vegan: !nonVeg && t.includes("vegan"),
    eggless:
      t.includes("eggless") ||
      t.includes("no egg") ||
      t.includes("egg-free") ||
      t.includes("without egg"),
    nutFree:
      t.includes("nut-free") ||
      t.includes("no nut") ||
      t.includes("without nut") ||
      t.includes("nut free"),
  };
}

export function buildFallbackResponse(input: ChatInput): ChatResponse {
  const lastUserMsg =
    [...input.messages].reverse().find((m) => m.role === "user")?.content || "";
  const query = lastUserMsg.toLowerCase();

  const maxPrice = extractMaxPrice(query);
  const targetCategory = extractCategory(query);
  const diet = extractDietary(query);
  const targetArea =
    MUMBAI_AREAS.find((a) => query.includes(a)) ||
    (query.includes("near me") && input.userArea ? input.userArea.toLowerCase() : null);

  // 1. Strict filtering
  let candidates = [...input.listings];

  // STRICT PRICE CEILING: Never return items exceeding maxPrice
  if (maxPrice !== null) {
    candidates = candidates.filter((l) => l.price <= maxPrice);
  }

  // CATEGORY FILTER
  if (targetCategory) {
    candidates = candidates.filter((l) => {
      const cat = (l.category || "").toLowerCase();
      const name = (l.name || "").toLowerCase();
      const desc = (l.description || "").toLowerCase();
      if (cat === targetCategory) return true;
      if (targetCategory === "bakery") {
        return (
          name.includes("bread") ||
          name.includes("croissant") ||
          name.includes("pastry") ||
          name.includes("cake") ||
          name.includes("cruffin") ||
          name.includes("sourdough") ||
          name.includes("focaccia") ||
          name.includes("bun") ||
          desc.includes("baked")
        );
      }
      if (targetCategory === "cafe") {
        return (
          name.includes("coffee") ||
          name.includes("sandwich") ||
          name.includes("snack") ||
          name.includes("tea")
        );
      }
      if (targetCategory === "meals") {
        return (
          name.includes("thali") ||
          name.includes("meal") ||
          name.includes("biryani") ||
          name.includes("box")
        );
      }
      return false;
    });
  }

  // DIETARY FILTER
  if (diet.nonVeg) {
    // Strictly keep only non-veg items
    candidates = candidates.filter((l) => isItemNonVeg(l));

    // If query mentions specific meat, prioritize it
    const specificMeats = [
      "chicken",
      "mutton",
      "kheema",
      "keema",
      "prawn",
      "prawns",
      "fish",
      "egg",
    ].filter((m) => query.includes(m));
    if (specificMeats.length > 0) {
      const moreSpecific = candidates.filter((l) => {
        const text = `${l.name} ${l.description}`.toLowerCase();
        return specificMeats.some((m) => text.includes(m));
      });
      if (moreSpecific.length > 0) candidates = moreSpecific;
    }
  } else if (diet.veg) {
    // Strictly keep only vegetarian items, NEVER non-veg items
    candidates = candidates.filter((l) => {
      if (isItemNonVeg(l)) return false;
      const tags = (l.dietaryTags || []).map((t) => t.toLowerCase());
      const name = (l.name || "").toLowerCase();
      return (
        tags.some((t) => t.includes("veg") || t.includes("jain")) ||
        name.includes("veg")
      );
    });
  }

  if (diet.vegan) {
    candidates = candidates.filter((l) => {
      if (isItemNonVeg(l)) return false;
      const tags = (l.dietaryTags || []).map((t) => t.toLowerCase());
      return tags.some((t) => t.includes("vegan"));
    });
  }

  if (diet.eggless) {
    candidates = candidates.filter((l) => {
      const allergens = (l.allergens || []).map((a) => a.toLowerCase());
      const tags = (l.dietaryTags || []).map((t) => t.toLowerCase());
      return (
        !allergens.includes("eggs") &&
        !allergens.includes("egg") &&
        (tags.some((t) => t.includes("eggless") || t.includes("egg_free")) ||
          allergens.length === 0)
      );
    });
  }

  if (diet.nutFree) {
    candidates = candidates.filter((l) => {
      const allergens = (l.allergens || []).map((a) => a.toLowerCase());
      return (
        !allergens.includes("nuts") &&
        !allergens.includes("peanuts") &&
        !allergens.includes("tree nuts")
      );
    });
  }

  // AREA FILTER
  if (targetArea) {
    const inArea = candidates.filter((l) =>
      (l.area || "").toLowerCase().includes(targetArea),
    );
    if (inArea.length > 0) {
      candidates = inArea;
    }
  }

  // Sort candidate results
  if (maxPrice !== null) {
    candidates.sort((a, b) => a.price - b.price);
  } else {
    candidates.sort(
      (a, b) => 1 - b.price / b.originalPrice - (1 - a.price / a.originalPrice),
    );
  }

  // Case 1: Matching candidates found within the user's constraints
  if (candidates.length > 0) {
    const picked = candidates.slice(0, 3);
    const names = picked
      .map((p) => `${p.name} from ${p.vendor} (₹${p.price})`)
      .join(", ");
    let reply = "";
    if (diet.nonVeg) {
      reply = `Found ${picked.length} delicious non-veg surplus deal${picked.length > 1 ? "s" : ""}: ${names}! Grab them before pickup ends.`;
    } else if (maxPrice !== null && targetCategory) {
      reply = `Found ${picked.length} fresh ${targetCategory} deal${picked.length > 1 ? "s" : ""} under ₹${maxPrice}: ${names}!`;
    } else if (maxPrice !== null) {
      reply = `Here are great surplus meals under ₹${maxPrice}: ${names}! Reserve before pickup closes.`;
    } else if (targetArea) {
      reply = `Found surplus rescue options near ${picked[0].area}: ${names}!`;
    } else {
      reply = `Here are great surplus finds matching your request: ${names}. Check pickup times before reserving!`;
    }
    return {
      reply,
      listingIds: picked.map((p) => p.id),
      intent: "search",
    };
  }

  // Case 2a: Non-veg requested but no non-veg items match exact sub-filters (like area/price)
  if (diet.nonVeg) {
    let nonVegItems = input.listings.filter(isItemNonVeg);
    nonVegItems.sort((a, b) => a.price - b.price);
    const picked = nonVegItems.slice(0, 3);
    const names = picked.map((p) => `${p.name} from ${p.vendor} (₹${p.price})`).join(", ");
    const reply = picked.length > 0
      ? `No non-veg items available matching your exact criteria right now. The closest non-veg rescue deals are: ${names}.`
      : `No non-veg surplus items are available right now. Please check back later today as more restaurant surplus is added!`;
    return {
      reply,
      listingIds: picked.map((p) => p.id),
      intent: "fallback",
    };
  }

  // Case 2: User requested a price limit, but NO listings exist under that price
  if (maxPrice !== null) {
    let alternatives = [...input.listings];
    if (targetCategory) {
      const catAlts = alternatives.filter(
        (l) => (l.category || "").toLowerCase() === targetCategory,
      );
      if (catAlts.length > 0) alternatives = catAlts;
    }
    alternatives.sort((a, b) => a.price - b.price);
    const lowest = alternatives[0];
    const picked = alternatives.slice(0, 3);

    const reply = lowest
      ? `No ${targetCategory || "surplus"} items available under ₹${maxPrice} right now. The lowest priced option is ${lowest.name} from ${lowest.vendor} at ₹${lowest.price}. Here are the closest budget alternatives:`
      : `No items available under ₹${maxPrice} right now. Please check back later today as new surplus bags are added!`;

    return {
      reply,
      listingIds: picked.map((p) => p.id),
      intent: "fallback",
    };
  }

  // Case 3: General keyword match
  const matches = input.listings.filter((l) => {
    const text =
      `${l.name} ${l.vendor} ${l.area} ${l.category} ${(l.dietaryTags || []).join(" ")}`.toLowerCase();
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    return words.some((w) => text.includes(w));
  });

  const picked = matches.length > 0 ? matches.slice(0, 3) : input.listings.slice(0, 2);
  if (picked.length > 0) {
    const names = picked
      .map((p) => `${p.name} from ${p.vendor} (₹${p.price})`)
      .join(", ");
    return {
      reply: `Here are great surplus finds matching your request: ${names}. Check pickup times before reserving!`,
      listingIds: picked.map((p) => p.id),
      intent: "search",
    };
  }

  return {
    reply:
      "I'm SaveBot! I can help you rescue fresh bakery croissants, cafe lunches, or dinner thalis across Mumbai. What are you looking for right now?",
    listingIds: input.listings.slice(0, 2).map((l) => l.id),
    intent: "info",
  };
}

export function getChatSystemPrompt(
  nowStr: string,
  timezone: string,
  userArea?: string,
  listings: ActiveListingSummary[] = [],
): string {
  return `You are SaveBot, a friendly AI food rescue assistant for Save Plate — a Mumbai surplus food marketplace. You help users find food deals conversationally.

Current Time: ${nowStr}
Timezone: ${timezone}
User's Area: ${userArea ?? "unknown"}

ACTIVE LISTINGS (JSON):
${JSON.stringify(listings, null, 2)}

RULES:
1. Answer in 1–3 warm, friendly sentences. Be specific — mention food names, vendors, areas.
2. STRICT BUDGET & PRICE LIMITS: If the user specifies a maximum price (e.g., 'under ₹100', 'under 100rs', 'below 150', '< 200'), you MUST ONLY include listings with price <= maxPrice in "listingIds". NEVER include listings with price > maxPrice. If no listings exist under that price, state that clearly in the reply and return [] or suggest the lowest available items with an explanation.
3. STRICT VEG VS NON-VEG SEPARATION: Never confuse vegetarian and non-vegetarian dishes. If user asks for "non-veg", "chicken", "meat", or "mutton", NEVER return vegetarian dishes (e.g. "veg tiffin", "veg biryani", "paneer", "dal"). ONLY return dishes containing chicken, mutton, meat, seafood, or egg. If user asks for "veg" or "vegetarian", NEVER return meat/poultry/seafood dishes.
4. From the ACTIVE LISTINGS above, pick the 1–3 most relevant listing IDs that match the user's request.
   Return them in "listingIds". Return [] if none match well.
5. If user asks about allergens/diet: be careful and suggest they confirm with the vendor.
6. If user asks something unrelated to food/Save Plate: politely redirect.
7. Prices are in INR (₹). Pickup windows are time ranges (e.g. "6 PM – 9 PM").
8. Set "intent" to "search" if user is looking for food, "info" for general questions, "fallback" if unsure.
9. ONLY output raw JSON matching: { "reply": string, "listingIds": string[], "intent": string }
   No markdown, no prose outside the JSON.`;
}

export async function chatWithAssistant(input: ChatInput): Promise<ChatResponse> {
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const model = process.env.LLM_MODEL || (provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash");

  // Fallback if no LLM API key
  if (!apiKey) {
    return buildFallbackResponse(input);
  }

  const systemPrompt = getChatSystemPrompt(
    input.now,
    input.timezone || "Asia/Kolkata",
    input.userArea,
    input.listings,
  );

  const validListingIdSet = new Set(input.listings.map((l) => l.id));

  try {
    let rawJsonText = "";

    if (provider === "openai") {
      const messages = [
        { role: "system", content: systemPrompt },
        ...input.messages.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(6000), // 6s cutoff
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await response.json()) as any;
      rawJsonText = json.choices?.[0]?.message?.content || "";
    } else {
      // Default: Google Gemini API
      const conversationText = input.messages
        .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
        .join("\n");

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${systemPrompt}\n\nConversation History:\n${conversationText}\n\nRespond with JSON:`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(6000), // 6s cutoff
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await response.json()) as any;
      rawJsonText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const cleanedJson = rawJsonText
      .replace(/^```json/im, "")
      .replace(/^```/im, "")
      .replace(/```$/im, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const rawListingIds = Array.isArray(parsed.listingIds) ? parsed.listingIds : [];

    // Sanitize listing IDs to prevent hallucinations and strictly enforce budget limits
    const lastUserQuery =
      [...input.messages].reverse().find((m) => m.role === "user")?.content || "";
    const requestedMaxPrice = extractMaxPrice(lastUserQuery);

    const listingMap = new Map(input.listings.map((l) => [l.id, l]));
    let listingIds = rawListingIds.filter((id: unknown): id is string =>
      typeof id === "string" && validListingIdSet.has(id),
    );

    // If user specified a budget ceiling, strictly strip any items exceeding maxPrice
    if (requestedMaxPrice !== null) {
      listingIds = listingIds.filter((id: string) => {
        const item = listingMap.get(id);
        return item ? item.price <= requestedMaxPrice : false;
      });
    }

    // Strict Dietary Guardrail: Never return veg for non-veg requests, or non-veg for veg requests
    const userDiet = extractDietary(lastUserQuery);
    if (userDiet.nonVeg) {
      listingIds = listingIds.filter((id: string) => {
        const item = listingMap.get(id);
        return item ? isItemNonVeg(item) : false;
      });
    } else if (userDiet.veg) {
      listingIds = listingIds.filter((id: string) => {
        const item = listingMap.get(id);
        return item ? !isItemNonVeg(item) : false;
      });
    }

    const intent: "search" | "info" | "fallback" =
      parsed.intent === "search" || parsed.intent === "info" || parsed.intent === "fallback"
        ? parsed.intent
        : listingIds.length > 0
          ? "search"
          : "info";

    return {
      reply: typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : "Here are some surplus options ready for rescue right now!",
      listingIds,
      intent,
    };
  } catch (err) {
    console.warn("[SaveBot Chat] LLM error, using fallback:", err);
    return buildFallbackResponse(input);
  }
}

