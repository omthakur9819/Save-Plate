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
  "category": "bakery" | "cafe" | "meals" (optional, ONLY if explicitly implied by bread/cake/croissant/bakery -> bakery, coffee/sandwich/snack/cafe -> cafe, biryani/thali/dinner/lunch/meals/khana/dabba -> meals),
  "diet": array of "veg" | "vegan" | "egg_free" | "nut_free" (default []),
  "maxPrice": number (in INR, optional. "under/below/less than 150 rupees" or "<150" or "sasta" with budget implies maxPrice),
  "area": string (optional, return ONLY the area NAME in Mumbai like Bandra, BKC, Andheri, Powai, Colaba, Lower Parel, Juhu, Dadar, Worli, Vashi, Panvel. NEVER return coordinates),
  "nearMe": boolean (true if user says "near me", "nearby", "around here", default false),
  "maxDistanceKm": number (optional, e.g. "within 5km" -> 5),
  "pickupAfter": ISO datetime string (optional. Convert relative times like "tonight", "after 8pm" into absolute ISO string using the provided Current Reference Time and Timezone),
  "sortBy": "distance" | "price" | "ending_soon" (default "distance". "cheap/sasta/lowest price" -> "price", "ending soon/urgent/quick" -> "ending_soon", "nearest/near" -> "distance")
}

RULES:
1. Current Reference Time: ${nowStr}
2. Timezone: ${timezone} (Default: Asia/Kolkata)
3. "under", "below", "less than X rupees" or "₹X" means maxPrice: X.
4. "sasta" in Hindi/Hinglish means cheap -> sortBy "price".
5. Return ONLY the area NAME string (never coordinates or lat/lng).
6. Leave fields empty/undefined rather than guessing or hallucinating.
7. Only output raw JSON matching the schema, with no markdown code fences or conversational prose.

FEW-SHOT EXAMPLES:

Example 1:
Query: "veg dinner under ₹150 near Bandra"
Reference: 2026-10-20T18:00:00+05:30
Output:
{"keywords":["dinner"],"category":"meals","diet":["veg"],"maxPrice":150,"area":"Bandra","nearMe":false,"sortBy":"distance"}

Example 2:
Query: "bakery items after 8pm"
Reference: 2026-10-20T17:00:00+05:30
Output:
{"keywords":["bakery"],"category":"bakery","diet":[],"pickupAfter":"2026-10-20T20:00:00+05:30","nearMe":false,"sortBy":"ending_soon"}

Example 3 (Hinglish):
Query: "sasta veg khana Andheri mein"
Reference: 2026-10-20T19:00:00+05:30
Output:
{"keywords":["khana"],"category":"meals","diet":["veg"],"area":"Andheri","nearMe":false,"sortBy":"price"}

Example 4:
Query: "eggless pastries in Powai below 200"
Reference: 2026-10-20T16:30:00+05:30
Output:
{"keywords":["pastries"],"category":"bakery","diet":["egg_free"],"maxPrice":200,"area":"Powai","nearMe":false,"sortBy":"distance"}

Example 5:
Query: "vegan snacks near me within 3km"
Reference: 2026-10-20T15:00:00+05:30
Output:
{"keywords":["snacks"],"category":"cafe","diet":["vegan"],"nearMe":true,"maxDistanceKm":3,"sortBy":"distance"}

Example 6:
Query: "cheap meals in BKC ending soon"
Reference: 2026-10-20T21:00:00+05:30
Output:
{"keywords":["meals"],"category":"meals","diet":[],"area":"BKC","nearMe":false,"sortBy":"ending_soon"}`;
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
    nearMe: false,
    sortBy: "distance",
  };

  // Diet
  const diet: ("veg" | "vegan" | "egg_free" | "nut_free" | "jain" | "halal")[] = [];
  if (lower.includes("vegan")) diet.push("vegan");
  else if (/\b(veg|veggie|vegetarians?|shakahari)\b/.test(lower)) diet.push("veg");
  if (/\b(eggless|egg[\s\-_]?free)\b/.test(lower)) diet.push("egg_free");
  if (/\b(nut[\s\-_]?free|no nuts)\b/.test(lower)) diet.push("nut_free");
  if (/\b(jain)\b/.test(lower)) diet.push("jain");
  if (/\b(halal)\b/.test(lower)) diet.push("halal");
  result.diet = diet;

  // Allergen exclusions
  const excludeAllergens: ("milk" | "egg" | "peanuts" | "tree_nuts" | "gluten" | "soy" | "fish" | "shellfish" | "sesame" | "mustard")[] = [];
  if (/\b(no dairy|dairy[\s\-_]?free|no milk|lactose[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("milk");
  if (/\b(no egg|no eggs|eggless|egg[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("egg");
  if (/\b(no peanuts|peanut[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("peanuts");
  if (/\b(no nuts|nut[\s\-_]?free)\b/.test(lower)) {
    excludeAllergens.push("peanuts", "tree_nuts");
  }
  if (/\b(no gluten|gluten[\s\-_]?free|wheat[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("gluten");
  if (/\b(no soy|soy[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("soy");
  if (/\b(no fish|fish[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("fish");
  if (/\b(no shellfish|seafood[\s\-_]?free)\b/.test(lower)) excludeAllergens.push("shellfish");
  result.excludeAllergens = Array.from(new Set(excludeAllergens));

  // Category
  if (/\b(bakery|breads?|breadd|croissants?|croissnt|pastr(?:y|ies)|cakes?|cookies?|buns?|brownies?|puffs?)\b/.test(lower)) {
    result.category = "bakery";
  } else if (/\b(cafes?|coffees?|sandwiches?|smoothies?|teas?|snacks?|chai)\b/.test(lower)) {
    result.category = "cafe";
  } else if (/\b(meals?|dinners?|dinenr|lunch(?:es)?|thalis?|khana|biryanis?|curry|curries|roti|rotis|rice|dabbas?)\b/.test(lower)) {
    result.category = "meals";
  }

  // Price
  const priceMatch = lower.match(/(?:under|below|less than|within|₹|rs\.?|inr)\s*(\d{2,4})/i) ||
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

  // Sorting
  if (/\b(sasta|cheap|cheapest|lowest price|budget)\b/.test(lower)) {
    result.sortBy = "price";
  } else if (/\b(ending soon|hurry|urgent|closing|expiring)\b/.test(lower)) {
    result.sortBy = "ending_soon";
  }

  // Area detection: check full string first, then individual word tokens
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
    result.area = matchedArea.canonicalName;
  }

  // Keywords: extract remaining content words
  const stopWords = new Set([
    "under", "below", "less", "than", "in", "near", "me", "nearby",
    "within", "rs", "inr", "rupees", "mein", "ko", "for", "and", "or",
    "the", "a", "an", "at", "sasta", "cheap", "food", "khana",
  ]);
  const words = query
    .replace(/[₹.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 2 && !stopWords.has(w) && isNaN(Number(w)));

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
        signal: AbortSignal.timeout(3000), // 3s timeout
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
        signal: AbortSignal.timeout(3000), // 3s timeout
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
