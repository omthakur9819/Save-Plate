import { SearchFilters, type SearchFiltersOutput } from "@workspace/api-zod";
import { resolveMumbaiArea } from "./mumbai-areas";

type SearchFiltersType = SearchFiltersOutput;

interface ParseInput {
  query: string;
  now: string | Date;
  timezone: string;
}

// In-memory cache keyed by lowercase trimmed query
interface CacheEntry {
  data: SearchFiltersType;
  expiresAt: number;
}
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const queryCache = new Map<string, CacheEntry>();

// Rate limiting (per-user / per-IP)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientKey) ?? [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Exceeded limit
  }

  validTimestamps.push(now);
  rateLimitMap.set(clientKey, validTimestamps);
  return true;
}

export function buildSafeFallback(query: string): SearchFiltersType {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    keywords: words,
    diet: [],
    excludeAllergens: [],
    areas: [],
    nearMe: false,
    sortBy: "distance",
  };
}

export function getSystemPrompt(nowStr: string, timezone: string): string {
  return `You are an intelligent search assistant for Save Plate (a Mumbai surplus food rescue marketplace).
Your job is to convert natural-language user queries into structured search filter JSON.

TARGET JSON SCHEMA:
{
  "keywords": string[] (food or dish names extracted, default []),
  "category": "bakery" | "cafe" | "meals" (optional, ONLY if explicitly implied by bread/cake/croissant/bakery -> bakery, coffee/sandwich/snack/cafe/chai/nashta -> cafe, biryani/thali/dinner/lunch/meals/khana/dabba -> meals),
  "diet": array of "veg" | "vegan" | "egg_free" | "nut_free" | "jain" | "halal" (default []),
  "excludeAllergens": array of "milk" | "egg" | "peanuts" | "tree_nuts" | "gluten" | "soy" | "fish" | "shellfish" | "sesame" | "mustard" (default []),
  "maxPrice": number (in INR, optional. "under/below/less than 150 rupees" or "<150" or "₹150" or "sasta" with budget implies maxPrice),
  "minDiscountPercent": number (optional, e.g. "50% off or more" / "heavily discounted" / "badi chhoot" -> 50),
  "area": string (optional, primary Mumbai area name like Bandra, BKC, Andheri, Powai, Colaba, Lower Parel, Juhu, Dadar, Worli, Vashi, Panvel. NEVER return coordinates),
  "areas": string[] (optional, list of areas if user mentions multiple like "Bandra ya BKC" -> ["Bandra", "BKC"]),
  "nearMe": boolean (true if user says "near me", "nearby", "around here", default false),
  "maxDistanceKm": number (optional, e.g. "within 5km" -> 5),
  "pickupAfter": ISO datetime string (optional. Convert relative times like "tonight", "after 8pm" into absolute ISO string using the provided Current Reference Time and Timezone),
  "sortBy": "distance" | "price" | "ending_soon" | "popular" (default "distance". "cheap/sasta/lowest price" -> "price", "ending soon/urgent/quick" -> "ending_soon", "most rescued/popular/trending/bestseller/log kya le rahe hain" -> "popular", "nearest/near" -> "distance")
}

RULES:
1. Current Reference Time: ${nowStr}
2. Timezone: ${timezone} (Default: Asia/Kolkata)
3. "under", "below", "less than X rupees" or "₹X" means maxPrice: X.
4. "sasta" in Hindi/Hinglish means cheap -> sortBy "price".
5. "50% off or more" / "heavily discounted" / "badi chhoot" -> minDiscountPercent: 50.
6. Allergen exclusions:
   - "no nuts" / "nut free" / "without peanuts" -> excludeAllergens: ["peanuts", "tree_nuts"]
   - "no dairy" / "lactose free" / "without milk" -> excludeAllergens: ["milk"]
   - "no egg" / "eggless" -> excludeAllergens: ["egg"], and diet: ["egg_free"]
7. Multi-area support: "Bandra ya BKC" or "Bandra or BKC" -> area: "Bandra", areas: ["Bandra", "BKC"].
8. Hinglish food items:
   - "nashta" -> breakfast -> category: "cafe"
   - "meetha" / "mithai" -> keywords: ["dessert", "sweets"]
   - "kadak chai" -> category: "cafe", keywords: ["chai", "tea"]
   - "tikha" -> keywords: ["spicy"]
9. Popularity sorting: "most rescued" / "popular" / "trending" / "log kya le rahe hain" -> sortBy: "popular".
10. Return ONLY the area NAME string(s) (never coordinates or lat/lng).
11. Leave fields empty/undefined rather than guessing or hallucinating.
12. Only output raw JSON matching the schema, with no markdown code fences or conversational prose.

FEW-SHOT EXAMPLES:

Example 1:
Query: "veg dinner under ₹150 near Bandra"
Reference: 2026-10-20T18:00:00+05:30
Output:
{"keywords":["dinner"],"category":"meals","diet":["veg"],"maxPrice":150,"area":"Bandra","areas":["Bandra"],"nearMe":false,"sortBy":"distance"}

Example 2:
Query: "bakery items after 8pm"
Reference: 2026-10-20T17:00:00+05:30
Output:
{"keywords":["bakery"],"category":"bakery","diet":[],"pickupAfter":"2026-10-20T20:00:00+05:30","nearMe":false,"sortBy":"ending_soon"}

Example 3 (Hinglish):
Query: "sasta veg khana Andheri mein"
Reference: 2026-10-20T19:00:00+05:30
Output:
{"keywords":["khana"],"category":"meals","diet":["veg"],"area":"Andheri","areas":["Andheri"],"nearMe":false,"sortBy":"price"}

Example 4:
Query: "eggless pastries in Powai below 200"
Reference: 2026-10-20T16:30:00+05:30
Output:
{"keywords":["pastries"],"category":"bakery","diet":["egg_free"],"excludeAllergens":["egg"],"maxPrice":200,"area":"Powai","areas":["Powai"],"nearMe":false,"sortBy":"distance"}

Example 5:
Query: "vegan snacks near me within 3km"
Reference: 2026-10-20T15:00:00+05:30
Output:
{"keywords":["snacks"],"category":"cafe","diet":["vegan"],"nearMe":true,"maxDistanceKm":3,"sortBy":"distance"}

Example 6:
Query: "cheap meals in BKC ending soon"
Reference: 2026-10-20T21:00:00+05:30
Output:
{"keywords":["meals"],"category":"meals","diet":[],"area":"BKC","areas":["BKC"],"nearMe":false,"sortBy":"ending_soon"}

Example 7 (Multi-area + Popularity):
Query: "most rescued snacks in Bandra ya BKC"
Reference: 2026-10-20T19:00:00+05:30
Output:
{"keywords":["snacks"],"category":"cafe","area":"Bandra","areas":["Bandra","BKC"],"nearMe":false,"sortBy":"popular"}

Example 8 (Hinglish + Discount + Allergens):
Query: "nashta with kadak chai 50% off or more no dairy"
Reference: 2026-10-20T08:30:00+05:30
Output:
{"keywords":["chai","tea","nashta"],"category":"cafe","excludeAllergens":["milk"],"minDiscountPercent":50,"nearMe":false,"sortBy":"distance"}

Example 9 (Hinglish Meetha/Tikha):
Query: "meetha aur tikha khana under ₹100"
Reference: 2026-10-20T14:00:00+05:30
Output:
{"keywords":["dessert","sweets","spicy","khana"],"category":"meals","maxPrice":100,"nearMe":false,"sortBy":"distance"}

Example 10 (Strict Allergen Exclusion):
Query: "no dairy vegan cake"
Reference: 2026-10-20T16:00:00+05:30
Output:
{"keywords":["cake"],"category":"bakery","diet":["vegan","egg_free"],"excludeAllergens":["milk"],"nearMe":false,"sortBy":"distance"}`;
}

/**
 * Lightweight local heuristic extractor used for fallback or offline operation
 */
export function heuristicExtract(query: string, nowStr: string): Partial<SearchFiltersType> {
  const lower = query.toLowerCase();
  const result: Partial<SearchFiltersType> = {
    keywords: [],
    diet: [],
    excludeAllergens: [],
    areas: [],
    nearMe: false,
    sortBy: "distance",
  };

  // Diet (Strictly distinguish non-veg from veg)
  const isExplicitNonVeg =
    /\b(non[- ]?veg(?:etarian)?|no[- ]veg|not[- ]veg|mansahari|chicken|mutton|meat|fish|prawns?|kheema|keema|seafood|pork|bacon|lamb|gosht)\b/i.test(
      lower,
    );
  const diet: ("veg" | "vegan" | "egg_free" | "nut_free" | "jain" | "halal")[] = [];
  if (!isExplicitNonVeg) {
    if (lower.includes("vegan")) diet.push("vegan");
    else if (/(?<!no\s+|non[- ]?|not\s+)\b(veg|veggie|vegetarians?|shakahari)\b/.test(lower)) diet.push("veg");
  } else {
    const meatMatches = lower.match(
      /\b(chicken|mutton|kheema|keema|fish|prawns?|meat|seafood|non-veg|nonveg)\b/gi,
    );
    if (meatMatches) {
      result.keywords = Array.from(
        new Set([...(result.keywords || []), ...meatMatches.map((m) => m.toLowerCase())]),
      );
    }
  }
  if (/\b(eggless|egg[\s\-_]?free|no egg|no eggs)\b/.test(lower)) diet.push("egg_free");
  if (/\b(nut[\s\-_]?free|no nuts)\b/.test(lower)) diet.push("nut_free");
  if (/\b(jain)\b/.test(lower)) diet.push("jain");
  if (/\b(halal)\b/.test(lower)) diet.push("halal");
  result.diet = diet;

  // Allergen exclusions
  const excludeAllergens: ("milk" | "egg" | "peanuts" | "tree_nuts" | "gluten" | "soy" | "fish" | "shellfish" | "sesame" | "mustard")[] = [];
  if (/\b(no dairy|dairy[\s\-_]?free|no milk|without milk|lactose[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("milk");
  if (/\b(no egg|no eggs|eggless|egg[\s\-_]?free|without egg|without eggs)\b/.test(lower)) excludeAllergens.push("egg");
  if (/\b(no peanuts|peanut[\s\-_]?free|without peanuts)\b/.test(lower)) excludeAllergens.push("peanuts");
  if (/\b(no nuts|nut[\s\-_]?free|without nuts)\b/.test(lower)) {
    excludeAllergens.push("peanuts", "tree_nuts");
  }
  if (/\b(no gluten|gluten[\s\-_]?free|wheat[\s\-_]?free|without gluten)\b/.test(lower)) excludeAllergens.push("gluten");
  if (/\b(no soy|soy[\s\-_]?free|without soy)\b/.test(lower)) excludeAllergens.push("soy");
  if (/\b(no fish|fish[\s\-_]?free|without fish)\b/.test(lower)) excludeAllergens.push("fish");
  if (/\b(no shellfish|seafood[\s\-_]?free|without shellfish)\b/.test(lower)) excludeAllergens.push("shellfish");
  result.excludeAllergens = Array.from(new Set(excludeAllergens));

  // Category & Hinglish mapping
  if (/\b(bakery|breads?|breadd|croissants?|croissnt|pastr(?:y|ies)|cakes?|cookies?|buns?|brownies?|puffs?)\b/.test(lower)) {
    result.category = "bakery";
  } else if (/\b(cafes?|coffees?|sandwiches?|smoothies?|teas?|snacks?|chai|nashta|nasta)\b/.test(lower)) {
    result.category = "cafe";
  } else if (/\b(meals?|dinners?|dinenr|lunch(?:es)?|thalis?|khana|biryanis?|curry|curries|roti|rotis|rice|dabbas?)\b/.test(lower)) {
    result.category = "meals";
  }

  // Discount %
  const discountMatch = lower.match(/(\d+)%\s*off/i) || lower.match(/(?:at least|min|minimum)\s*(\d+)%/i);
  if (discountMatch) {
    result.minDiscountPercent = parseInt(discountMatch[1], 10);
  } else if (/\b(badi chhoot|heavily discounted)\b/.test(lower)) {
    result.minDiscountPercent = 50;
  }

  // Price (including INR ₹ prefix, e.g. ₹150, under ₹200, 150 rs)
  const priceMatch =
    query.match(/[₹]\s*(\d{1,5})/i) ||
    lower.match(/(?:under|below|less than|within|rs\.?|inr)\s*(\d{2,4})/i) ||
    lower.match(/(\d{2,4})\s*(?:rs|rupees|inr)/i);
  if (priceMatch) {
    result.maxPrice = parseInt(priceMatch[1], 10);
  }

  // Near me
  if (/\b(near me|nearby|close by|around me)\b/.test(lower)) {
    result.nearMe = true;
  }

  // Distance
  const distMatch = lower.match(/(?:within|under|in)\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilometers)/i);
  if (distMatch) {
    result.maxDistanceKm = parseFloat(distMatch[1]);
  }

  // Sorting: popular / price / ending_soon
  if (/\b(popular|most rescued|trending|bestseller|best selling|log kya le rahe hain)\b/.test(lower)) {
    result.sortBy = "popular";
  } else if (/\b(sasta|cheap|cheapest|lowest price|budget)\b/.test(lower)) {
    result.sortBy = "price";
  } else if (/\b(ending soon|hurry|urgent|closing|expiring)\b/.test(lower)) {
    result.sortBy = "ending_soon";
  }

  // Area & Multi-area detection
  const detectedAreas: string[] = [];
  const segments = lower.split(/\b(?:ya|or|and|,|\/)\b/);
  for (const seg of segments) {
    const area = resolveMumbaiArea(seg.trim());
    if (area && !detectedAreas.includes(area.canonicalName)) {
      detectedAreas.push(area.canonicalName);
    }
  }

  if (detectedAreas.length === 0) {
    let matchedArea = resolveMumbaiArea(lower);
    if (!matchedArea) {
      const rawTokens = lower.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
      for (const token of rawTokens) {
        const candidate = resolveMumbaiArea(token);
        if (candidate) {
          matchedArea = candidate;
          break;
        }
      }
    }
    if (matchedArea) {
      detectedAreas.push(matchedArea.canonicalName);
    }
  }

  if (detectedAreas.length > 0) {
    result.area = detectedAreas[0];
    result.areas = detectedAreas;
  }

  // Keywords: extract remaining content words + Hinglish tags
  const stopWords = new Set([
    "under", "below", "less", "than", "in", "near", "me", "nearby",
    "within", "rs", "inr", "rupees", "mein", "ko", "for", "and", "or",
    "the", "a", "an", "at", "sasta", "cheap", "food", "khana", "ya",
    "aur", "off", "most", "rescued", "popular", "trending",
  ]);

  const words = query
    .replace(/[₹.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2 && !stopWords.has(w) && isNaN(Number(w)));

  // Add Hinglish equivalents if detected
  if (/\b(meetha|mithai)\b/.test(lower)) {
    words.push("dessert", "sweets");
  }
  if (/\b(kadak chai|chai)\b/.test(lower)) {
    words.push("tea", "chai");
  }
  if (/\b(tikha|teekha)\b/.test(lower)) {
    words.push("spicy");
  }
  if (/\b(nashta|nasta)\b/.test(lower)) {
    words.push("breakfast", "snacks");
  }

  result.keywords = Array.from(new Set(words));

  return result;
}

export async function parseWithLLM(input: ParseInput): Promise<SearchFiltersType> {
  const cacheKey = input.query.trim().toLowerCase();
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const model = process.env.LLM_MODEL || (provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash");
  const nowStr = typeof input.now === "string" ? input.now : input.now.toISOString();

  // If no API key is set, use local heuristic with guaranteed schema compliance
  if (!apiKey) {
    const heuristic = heuristicExtract(input.query, nowStr);
    const parsed = SearchFilters.parse({
      ...buildSafeFallback(input.query),
      ...heuristic,
    });
    queryCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
    return parsed;
  }

  const systemPrompt = getSystemPrompt(nowStr, input.timezone || "Asia/Kolkata");
  const userPrompt = `User Query: "${input.query}"\nCurrent Reference Time: ${nowStr}`;

  try {
    let rawJsonText = "";

    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(6000), // 6s timeout
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const json = (await response.json()) as any;
      rawJsonText = json.choices?.[0]?.message?.content || "";
    } else {
      // Default to Google Gemini API
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(6000), // 6s timeout
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const json = (await response.json()) as any;
      rawJsonText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // Clean any markdown formatting if present
    const cleanedJson = rawJsonText
      .replace(/^```json/im, "")
      .replace(/^```/im, "")
      .replace(/```$/im, "")
      .trim();

    const unvalidated = JSON.parse(cleanedJson);
    const validated = SearchFilters.parse(unvalidated);

    queryCache.set(cacheKey, { data: validated, expiresAt: Date.now() + CACHE_TTL_MS });
    return validated;
  } catch (err) {
    // On any error or timeout (3s), fall back gracefully
    const heuristic = heuristicExtract(input.query, nowStr);
    const fallback = SearchFilters.parse({
      ...buildSafeFallback(input.query),
      ...heuristic,
    });
    return fallback;
  }
}
