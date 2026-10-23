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

// --- SMART LOCAL NLP UTILITIES ---

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    let prev = i;
    for (let j = 1; j <= a.length; j++) {
      const val = b[i - 1] === a[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}

export function hasFuzzyWord(text: string, targets: string[], maxDistance = 1): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const target of targets) {
      if (word === target) return true;
      if (Math.abs(word.length - target.length) <= maxDistance) {
        if (levenshteinDistance(word, target) <= maxDistance) return true;
      }
    }
  }
  return false;
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

const BAKERY_KEYWORDS = [
  "bakery", "bread", "croissant", "pastry", "cake", "cruffin",
  "sourdough", "brioche", "focaccia", "babka", "tart", "bun",
  "muffin", "donut", "doughnut", "cookie", "dessert", "sweet", "meetha", "mithai"
];

const CAFE_KEYWORDS = [
  "cafe", "coffee", "chai", "tea", "sandwich", "snack", "nashta",
  "burger", "wrap", "roll", "samosa", "puff", "salad", "juice", "shake"
];

const MEALS_KEYWORDS = [
  "meal", "lunch", "dinner", "thali", "biryani", "rice", "roti",
  "curry", "paneer", "dal", "tiffin", "platter", "combo", "pizza", "pasta", "noodles"
];

export function extractCategory(text: string): "bakery" | "cafe" | "meals" | null {
  const t = text.toLowerCase();
  if (BAKERY_KEYWORDS.some((k) => t.includes(k)) || hasFuzzyWord(t, ["bakery", "croissant", "pastry", "cake", "bread", "dessert"])) {
    return "bakery";
  }
  if (CAFE_KEYWORDS.some((k) => t.includes(k)) || hasFuzzyWord(t, ["coffee", "sandwich", "burger", "snacks", "cafe"])) {
    return "cafe";
  }
  if (MEALS_KEYWORDS.some((k) => t.includes(k)) || hasFuzzyWord(t, ["biryani", "thali", "dinner", "lunch", "meals", "curry", "pizza"])) {
    return "meals";
  }
  return null;
}

const MUMBAI_AREAS = [
  "bandra", "khar", "colaba", "lower parel", "dadar", "juhu",
  "andheri", "powai", "santacruz", "bkc", "churchgate", "marine drive",
  "worli", "kemps corner", "fort", "byculla", "vile parle", "matunga", "sion", "malad", "borivali"
];

export function extractMatchedArea(text: string, userArea?: string): string | null {
  const query = text.toLowerCase();
  for (const area of MUMBAI_AREAS) {
    if (query.includes(area)) return area;
  }
  // Fuzzy match for area typos (e.g. "bandara", "andhari", "juhuu")
  for (const area of MUMBAI_AREAS) {
    if (hasFuzzyWord(query, [area])) return area;
  }
  if (query.includes("near me") && userArea) {
    return userArea.toLowerCase();
  }
  return null;
}

export const NON_VEG_WORDS = [
  "chicken", "mutton", "kheema", "keema", "meat", "fish", "prawn",
  "prawns", "seafood", "bacon", "pork", "lamb", "gosht", "egg"
];

export function isItemNonVeg(l: ActiveListingSummary): boolean {
  const text = `${l.name} ${l.description} ${l.vendor} ${l.category}`.toLowerCase();
  const hasNonVegWord =
    NON_VEG_WORDS.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text)) ||
    hasFuzzyWord(text, ["chicken", "mutton", "seafood", "prawns"]);
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
  jain?: boolean;
} {
  const t = text.toLowerCase();
  const nonVeg =
    /\b(non[- ]?veg(?:etarian)?|no[- ]veg|not[- ]veg|mansahari|chicken|mutton|meat|fish|prawns?|kheema|keema|seafood|pork|bacon|lamb|gosht)\b/i.test(t) ||
    hasFuzzyWord(t, ["chicken", "mutton", "nonveg", "seafood"]);

  const isJain = /\b(jain|no onion|no garlic|swaminarayan)\b/i.test(t);

  return {
    nonVeg,
    veg: !nonVeg && (/(?<!no\s+|non[- ]?|not\s+)\b(veg|veggie|vegetarians?|shakahari)\b/i.test(t) || hasFuzzyWord(t, ["vegetarian", "veggie"]) || isJain),
    vegan: !nonVeg && t.includes("vegan"),
    jain: isJain,
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
  const query = lastUserMsg.toLowerCase().trim();

  // 1. GREETING & INTRO DETECTION
  const isGreeting = /^(hi|hello|hey|hola|namaste|yo|good (morning|afternoon|evening)|help|who are you|what can you do)[\s!.]*$/i.test(query);
  if (isGreeting) {
    const featured = input.listings.slice(0, 3);
    const names = featured.map((l) => `${l.name} from ${l.vendor} (₹${l.price})`).join(", ");
    return {
      reply: `Hi there! 👋 I'm SaveBot, your Mumbai food rescue assistant. I can help you find fresh surplus meals, bakery treats under ₹100, deals closing soon, or cafe bites across Bandra, Andheri, and Colaba. Top rescue finds right now: ${names}. What are you craving today?`,
      listingIds: featured.map((l) => l.id),
      intent: "info",
    };
  }

  // 2. PARSE QUERY ATTRIBUTES
  const maxPrice = extractMaxPrice(query);
  const targetCategory = extractCategory(query);
  const diet = extractDietary(query);
  const targetArea = extractMatchedArea(query, input.userArea);
  const isEndingSoon = /\b(ending soon|ends soon|closing soon|closes soon|urgent|last chance|expiring|hurry|pickup soon)\b/i.test(query);
  const isBestDeals = /\b(best deals?|biggest discounts?|highest discounts?|huge discounts?|top savings?|cheapest|steal|super saver)\b/i.test(query);
  const isExpensive = /\b(expensive|costly|costliest|priciest|pricy|premium|luxury|gourmet|highest price|most expensive)\b/i.test(query);

  // VENDOR / RESTAURANT EXTRACTION (e.g., "bastian", "subko", "theobroma", "bombay canteen")
  let matchedVendor: string | null = null;
  for (const item of input.listings) {
    const vWords = item.vendor.toLowerCase().split(/[^a-z0-9]+/);
    for (const vw of vWords) {
      if (vw.length >= 4 && (query.includes(vw) || hasFuzzyWord(query, [vw]))) {
        matchedVendor = item.vendor;
        break;
      }
    }
    if (matchedVendor) break;
  }

  // 3. CANDIDATE FILTERING
  let candidates = [...input.listings];

  // VENDOR FILTER
  if (matchedVendor) {
    const vPrefix = matchedVendor.toLowerCase().split(' ')[0];
    const vendorMatches = candidates.filter((l) =>
      l.vendor.toLowerCase().includes(vPrefix) || query.includes(l.vendor.toLowerCase())
    );
    candidates = vendorMatches;
  }

  // STRICT PRICE CEILING
  if (maxPrice !== null) {
    candidates = candidates.filter((l) => l.price <= maxPrice);
  }

  // CATEGORY FILTER WITH FUZZY FALLBACK
  // Rule: If an item has an explicit category (e.g. 'Meals'), keyword matches
  // in its name (e.g. 'brioche') must NOT override the explicit category.
  if (targetCategory) {
    candidates = candidates.filter((l) => {
      const cat = (l.category || "").toLowerCase();
      // If item has an explicit category that doesn't match, reject it
      if (cat && cat !== targetCategory) return false;
      if (cat === targetCategory) return true;
      const name = (l.name || "").toLowerCase();
      const desc = (l.description || "").toLowerCase();
      if (targetCategory === "bakery") {
        return BAKERY_KEYWORDS.some((k) => name.includes(k) || desc.includes(k)) ||
               hasFuzzyWord(`${name} ${desc}`, ["croissant", "pastry", "cake", "bread", "muffin"]);
      }
      if (targetCategory === "cafe") {
        return CAFE_KEYWORDS.some((k) => name.includes(k) || desc.includes(k)) ||
               hasFuzzyWord(`${name} ${desc}`, ["coffee", "sandwich", "burger", "chai"]);
      }
      if (targetCategory === "meals") {
        return MEALS_KEYWORDS.some((k) => name.includes(k) || desc.includes(k)) ||
               hasFuzzyWord(`${name} ${desc}`, ["biryani", "thali", "curry", "rice", "pizza"]);
      }
      return false;
    });
  }

  // DIETARY FILTERS
  if (diet.nonVeg) {
    candidates = candidates.filter((l) => isItemNonVeg(l));
    const specificMeats = NON_VEG_WORDS.filter((m) => query.includes(m) || hasFuzzyWord(query, [m]));
    if (specificMeats.length > 0) {
      const moreSpecific = candidates.filter((l) => {
        const text = `${l.name} ${l.description}`.toLowerCase();
        return specificMeats.some((m) => text.includes(m) || hasFuzzyWord(text, [m]));
      });
      if (moreSpecific.length > 0) candidates = moreSpecific;
    }
  } else if (diet.veg) {
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

  if (diet.jain) {
    candidates = candidates.filter((l) => {
      if (isItemNonVeg(l)) return false;
      const tags = (l.dietaryTags || []).map((t) => t.toLowerCase());
      const desc = (l.description || "").toLowerCase();
      return tags.some((t) => t.includes("jain")) || desc.includes("jain") || desc.includes("no onion");
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
      (l.area || "").toLowerCase().includes(targetArea) ||
      hasFuzzyWord(l.area || "", [targetArea]),
    );
    candidates = inArea;
  }

  // SPECIFIC FOOD KEYWORDS (e.g., "biryani", "prawns", "pasta", "sushi", "tacos", etc.)
  const stopWords = new Set([
    "give", "me", "expensive", "costly", "priciest", "premium", "food", "at", "in", "from",
    "restaurant", "restaurent", "hotel", "cafe", "bakery", "meals", "meal", "dishes", "dish",
    "item", "items", "surplus", "deal", "deals", "find", "show", "any", "please", "the", "for",
    "with", "near", "what", "can", "you", "tell", "display", "options", "today", "now", "there",
    "arent", "none", "results", "save", "plate", "best", "good", "cheap", "cheapest", "under",
    "below", "less", "more", "want", "craving", "like", "some", "sweet", "sweets", "dessert",
    "veg", "vegetarian", "non", "nonveg", "non-veg", "jain", "vegan", "eggless", "halal",
    "pure", "fresh", "hot", "healthy",
    "rs", "inr", "rupees"
  ]);
  const specificWords = query
    .split(/[^a-z]+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !stopWords.has(w) &&
        !NON_VEG_WORDS.includes(w) &&
        !(matchedVendor && matchedVendor.toLowerCase().includes(w)) &&
        !(targetArea && targetArea.includes(w)),
    );

  if (specificWords.length > 0) {
    const specificMatches = candidates.filter((l) => {
      const text = `${l.name} ${l.description || ""}`.toLowerCase();
      return specificWords.some((w) => text.includes(w) || hasFuzzyWord(text, [w]));
    });
    candidates = specificMatches;
  }

  // 4. SORTING STRATEGIES
  if (isExpensive) {
    // Sort highest price first
    candidates.sort((a, b) => b.price - a.price);
  } else if (isEndingSoon) {
    // Sort by lower quantity and earliest pickup window mention
    candidates.sort((a, b) => (a.quantity ?? 1) - (b.quantity ?? 1));
  } else if (isBestDeals) {
    // Sort by discount % descending
    candidates.sort(
      (a, b) => (1 - b.price / b.originalPrice) - (1 - a.price / a.originalPrice),
    );
  } else if (maxPrice !== null) {
    candidates.sort((a, b) => a.price - b.price);
  } else {
    candidates.sort(
      (a, b) => (1 - b.price / b.originalPrice) - (1 - a.price / a.originalPrice),
    );
  }

  // 5. MATCHING RESPONSE GENERATION (WHEN MATCHES EXIST)
  if (candidates.length > 0) {
    const picked = candidates.slice(0, 3);
    const names = picked
      .map((p) => {
        const discount = Math.round((1 - p.price / p.originalPrice) * 100);
        return `${p.name} from ${p.vendor} (₹${p.price}, ${discount}% off)`;
      })
      .join(", ");

    let reply = "";
    if (isExpensive && matchedVendor) {
      reply = `✨ Here are the top premium surplus specials from ${matchedVendor}: ${names}. Gourmet dining at rescue prices!`;
    } else if (isExpensive) {
      reply = `✨ Here are our top gourmet surplus picks: ${names}. Premium meals rescued at incredible discounts!`;
    } else if (isEndingSoon) {
      reply = `⚡ Urgent deals ending soon! Grab these before pickup windows close: ${names}. Save food and reserve right away!`;
    } else if (isBestDeals) {
      const maxDiscount = Math.max(...picked.map((p) => Math.round((1 - p.price / p.originalPrice) * 100)));
      reply = `🔥 Here are the biggest surplus discounts available right now (up to ${maxDiscount}% off): ${names}. Massive savings and zero food waste!`;
    } else if (matchedVendor) {
      reply = `Found ${picked.length} delicious surplus item${picked.length > 1 ? "s" : ""} from ${matchedVendor}: ${names}!`;
    } else if (diet.jain) {
      reply = `Found ${picked.length} delicious Jain-friendly surplus deal${picked.length > 1 ? "s" : ""}: ${names}!`;
    } else if (diet.nonVeg) {
      reply = `Found ${picked.length} delicious non-veg surplus deal${picked.length > 1 ? "s" : ""}: ${names}! Grab them before pickup ends.`;
    } else if (maxPrice !== null && targetCategory) {
      reply = `Found ${picked.length} fresh ${targetCategory} deal${picked.length > 1 ? "s" : ""} under ₹${maxPrice}: ${names}!`;
    } else if (maxPrice !== null) {
      reply = `Here are great surplus meals under ₹${maxPrice}: ${names}! Reserve before pickup closes.`;
    } else if (targetArea) {
      reply = `Found surplus rescue options in ${picked[0].area}: ${names}!`;
    } else {
      reply = `Here are top surplus rescue finds matching your request: ${names}. Check pickup times before reserving!`;
    }
    return {
      reply,
      listingIds: picked.map((p) => p.id),
      intent: "search",
    };
  }

  // 6. ZERO RESULTS FOUND - DISPLAY NONE RESULTS
  let noResultMsg = "No matching surplus items found right now.";
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

    noResultMsg = lowest
      ? `No ${targetCategory || "surplus"} items available under ₹${maxPrice} right now. The lowest priced option is ${lowest.name} from ${lowest.vendor} at ₹${lowest.price}.`
      : `No items available under ₹${maxPrice} right now. Please check back later today as new surplus bags are added!`;
  } else if (matchedVendor && targetCategory) {
    noResultMsg = `No ${targetCategory} surplus items found from ${matchedVendor} right now. Please check back later today!`;
  } else if (matchedVendor && specificWords.length > 0) {
    noResultMsg = `No surplus items found matching "${specificWords.join(" ")}" from ${matchedVendor} right now. Please check back later today!`;
  } else if (matchedVendor) {
    noResultMsg = `No surplus listings currently available from ${matchedVendor}. Please check back later today!`;
  } else if (diet.nonVeg) {
    noResultMsg = `No non-veg surplus items found matching your criteria right now. Please check back later today!`;
  } else if (diet.jain) {
    noResultMsg = `No Jain-friendly surplus items found matching your search right now. Please check back later today!`;
  } else if (diet.vegan) {
    noResultMsg = `No vegan surplus items found matching your search right now. Please check back later today!`;
  } else if (diet.veg) {
    noResultMsg = `No vegetarian surplus items found matching your criteria right now. Please check back later today!`;
  } else if (targetArea && specificWords.length > 0) {
    noResultMsg = `No surplus items found matching "${specificWords.join(" ")}" in ${targetArea} right now. Please check back later!`;
  } else if (targetArea) {
    noResultMsg = `No surplus items found in ${targetArea} right now. Try checking nearby areas or check back later!`;
  } else if (specificWords.length > 0) {
    noResultMsg = `No surplus listings found matching "${specificWords.join(" ")}". Please check back later today as restaurants add new surplus bags!`;
  } else {
    noResultMsg = `No surplus listings found matching your request right now. Please check back later today as restaurants add new surplus bags!`;
  }

  return {
    reply: noResultMsg,
    listingIds: [],
    intent: "search",
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
2. STRICT BUDGET & PRICE LIMITS: If the user specifies a maximum price (e.g., 'under ₹100', 'under 100rs', 'below 150', '< 200'), you MUST ONLY include listings with price <= maxPrice in "listingIds". NEVER include listings with price > maxPrice. If no listings exist under that price, state that clearly in the reply and return [] in "listingIds".
3. STRICT VEG VS NON-VEG SEPARATION: Never confuse vegetarian and non-vegetarian dishes. If user asks for "non-veg", "chicken", "meat", or "mutton", NEVER return vegetarian dishes (e.g. "veg tiffin", "veg biryani", "paneer", "dal"). ONLY return dishes containing chicken, mutton, meat, seafood, or egg. If user asks for "veg" or "vegetarian", NEVER return meat/poultry/seafood dishes.
4. ZERO RESULTS / NO MATCHES (CRITICAL): If there are NO listings that match the user's specific request (e.g., the requested restaurant has no items matching the request, or no listings match the requested food item, category, dietary preference, or price limit):
   - You MUST explicitly state in "reply" that no matching surplus items were found (e.g. "No surplus items found for [criteria] right now. Please check back later today as new surplus bags are posted!").
   - You MUST set "listingIds": [].
   - NEVER suggest or return unrelated listings from other restaurants or mismatched categories when there are no matching results.
5. If matching listings exist from the ACTIVE LISTINGS above, pick the 1–3 most relevant listing IDs that strictly match the user's request. Return them in "listingIds".
6. If user asks about allergens/diet: be careful and suggest they confirm with the vendor.
7. If user asks something unrelated to food/Save Plate: politely redirect.
8. Prices are in INR (₹). Pickup windows are time ranges (e.g. "6 PM – 9 PM").
9. Set "intent" to "search" if user is looking for food, "info" for general questions, "fallback" if unsure.
10. ONLY output raw JSON matching: { "reply": string, "listingIds": string[], "intent": string }
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

