import {
  scanAllergens,
  scanDietary,
  DIETARY_TAGS,
  ALLERGEN_TAGS,
  DietaryTag,
  AllergenTag,
} from "./allergen-rule-checker";

export interface TagSuggestion {
  tag: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface SuggestTagsResult {
  dietary: TagSuggestion[];
  allergens: TagSuggestion[];
  mayContain: TagSuggestion[];
  aiAvailable: boolean;
}

interface SuggestInput {
  title: string;
  description?: string;
  photo?: string;
  clientIp?: string;
}

// In-memory rate limiting (30 requests per minute per IP / client)
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const rateLimitMap = new Map<string, number[]>();

export function checkSuggestRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientKey) ?? [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(clientKey, validTimestamps);
  return true;
}

// In-memory cache for suggestion queries (10 min TTL)
interface CacheEntry {
  data: SuggestTagsResult;
  expiresAt: number;
}
const CACHE_TTL_MS = 10 * 60 * 1000;
const suggestionCache = new Map<string, CacheEntry>();

function getCacheKey(title: string, description?: string, photo?: string): string {
  return `${title.trim().toLowerCase()}|${(description ?? "").trim().toLowerCase()}|${photo ?? ""}`;
}

const SYSTEM_PROMPT = `You are a conservative food allergen and dietary safety assistant for Save Plate, a Mumbai surplus food marketplace.
Your task is to analyze food item titles, descriptions, and optional photos to suggest dietary tags and allergen alerts for vendor verification.

CRITICAL SAFETY PRINCIPLE:
Allergen suggestions require HIGH RECALL. Severe allergic reactions can be fatal.
- If an ingredient or common preparation typically contains an allergen, ALWAYS include it.
- Never guess an item is free of allergens. When uncertain, suggest it with "medium" or "low" confidence, or place it under "mayContain" (traces).
- Photos provide WEAK visual evidence: never assume allergens are absent based on appearance alone.

SUPPORTED TAXONOMY:
- Dietary tags: "vegetarian", "vegan", "egg_free", "jain", "halal"
- Allergen tags: "milk", "egg", "peanuts", "tree_nuts", "gluten", "soy", "fish", "shellfish", "sesame", "mustard"

TARGET JSON SCHEMA:
{
  "dietary": [
    { "tag": "vegetarian" | "vegan" | "egg_free" | "jain" | "halal", "confidence": "high" | "medium" | "low", "reason": "concise explanation" }
  ],
  "allergens": [
    { "tag": "milk" | "egg" | "peanuts" | "tree_nuts" | "gluten" | "soy" | "fish" | "shellfish" | "sesame" | "mustard", "confidence": "high" | "medium" | "low", "reason": "concise explanation" }
  ],
  "mayContain": [
    { "tag": "milk" | "egg" | "peanuts" | "tree_nuts" | "gluten" | "soy" | "fish" | "shellfish" | "sesame" | "mustard", "confidence": "high" | "medium" | "low", "reason": "concise explanation" }
  ]
}

FEW-SHOT EXAMPLES:

Example 1:
Title: "Paneer Tikka Roll"
Description: "Char-grilled spiced cottage cheese wrapped in a fresh roomali roti with mint chutney."
Output:
{
  "dietary": [
    { "tag": "vegetarian", "confidence": "high", "reason": "Paneer is dairy; no meat or seafood detected." }
  ],
  "allergens": [
    { "tag": "milk", "confidence": "high", "reason": "Paneer and curd marinade are dairy." },
    { "tag": "gluten", "confidence": "high", "reason": "Roomali roti is made of refined wheat (maida)." },
    { "tag": "mustard", "confidence": "medium", "reason": "Tikka marinades frequently use mustard oil." }
  ],
  "mayContain": []
}

Example 2:
Title: "Veg Puff / Vegetable Patties"
Description: "Crispy layered puff pastry filled with spiced potatoes, green peas and carrots."
Output:
{
  "dietary": [
    { "tag": "vegetarian", "confidence": "high", "reason": "Vegetable filling; no meat or egg listed." },
    { "tag": "vegan", "confidence": "medium", "reason": "Vegetable filling, but puff pastry fat may be butter or margarine." }
  ],
  "allergens": [
    { "tag": "gluten", "confidence": "high", "reason": "Puff pastry dough is prepared with wheat flour." }
  ],
  "mayContain": [
    { "tag": "milk", "confidence": "medium", "reason": "May use butter or milk wash on bakery pastry." }
  ]
}

Example 3:
Title: "Butter Croissant"
Description: "Flaky French pastry baked golden."
Output:
{
  "dietary": [
    { "tag": "vegetarian", "confidence": "high", "reason": "No meat or fish." }
  ],
  "allergens": [
    { "tag": "gluten", "confidence": "high", "reason": "Baked with wheat flour." },
    { "tag": "milk", "confidence": "high", "reason": "Prepared with generous dairy butter." }
  ],
  "mayContain": [
    { "tag": "egg", "confidence": "medium", "reason": "Egg wash is traditional on croissants." }
  ]
}

Example 4:
Title: "Chole Bhature"
Description: "Spicy chickpea curry served with two puffed bhaturas, pickled onions, and green chili."
Output:
{
  "dietary": [
    { "tag": "vegetarian", "confidence": "high", "reason": "Legume curry without meat or eggs." },
    { "tag": "vegan", "confidence": "medium", "reason": "Plant-based curry, unless ghee or curd used in bhatura dough." }
  ],
  "allergens": [
    { "tag": "gluten", "confidence": "high", "reason": "Bhatura is made from maida (wheat)." }
  ],
  "mayContain": [
    { "tag": "milk", "confidence": "low", "reason": "Some recipes use yogurt/curd in bhatura leavening." }
  ]
}

Example 5:
Title: "Fudgy Walnut Brownie"
Description: "Rich chocolate brownie loaded with toasted California walnuts."
Output:
{
  "dietary": [
    { "tag": "vegetarian", "confidence": "high", "reason": "Dessert without meat." }
  ],
  "allergens": [
    { "tag": "tree_nuts", "confidence": "high", "reason": "Contains walnuts." },
    { "tag": "gluten", "confidence": "high", "reason": "Wheat flour used for baking." },
    { "tag": "milk", "confidence": "high", "reason": "Butter and dairy chocolate." }
  ],
  "mayContain": [
    { "tag": "egg", "confidence": "medium", "reason": "Standard brownies use eggs unless explicitly stated eggless." },
    { "tag": "peanuts", "confidence": "low", "reason": "Common cross-contact in nut-handling bakeries." }
  ]
}

Example 6:
Title: "Sev Puri"
Description: "Crispy flat puris topped with potatoes, onions, tamarind chutney, and fine sev."
Output:
{
  "dietary": [
    { "tag": "vegetarian", "confidence": "high", "reason": "No meat or egg ingredients." },
    { "tag": "vegan", "confidence": "high", "reason": "No dairy, eggs, or animal products." }
  ],
  "allergens": [
    { "tag": "gluten", "confidence": "high", "reason": "Puris and sev are made from wheat/besan mix." }
  ],
  "mayContain": [
    { "tag": "peanuts", "confidence": "medium", "reason": "Chaat vendors commonly handle crushed peanuts." }
  ]
}

Respond ONLY with valid JSON matching the schema. No markdown formatting, no explanatory text outside the JSON.`;

/**
 * Merge deterministic scanner results with AI results.
 * Rule: Any allergen detected by keyword rules with "high" confidence MUST appear in the final output.
 */
function mergeWithDeterministicSafetyNet(
  aiResult: { dietary: TagSuggestion[]; allergens: TagSuggestion[]; mayContain: TagSuggestion[] } | null,
  title: string,
  description?: string,
): SuggestTagsResult {
  const ruleAllergens = scanAllergens(title, description);
  const ruleDietary = scanDietary(title, description);

  const allergensMap = new Map<string, TagSuggestion>();
  const mayContainMap = new Map<string, TagSuggestion>();
  const dietaryMap = new Map<string, TagSuggestion>();

  // 1. Add AI suggestions first if present
  if (aiResult) {
    for (const item of aiResult.allergens) {
      if (ALLERGEN_TAGS.includes(item.tag as AllergenTag)) {
        allergensMap.set(item.tag, item);
      }
    }
    for (const item of aiResult.mayContain) {
      if (ALLERGEN_TAGS.includes(item.tag as AllergenTag)) {
        mayContainMap.set(item.tag, item);
      }
    }
    for (const item of aiResult.dietary) {
      if (DIETARY_TAGS.includes(item.tag as DietaryTag)) {
        dietaryMap.set(item.tag, item);
      }
    }
  }

  // 2. Deterministic keyword scanner overrides/adds allergens (Safety Net)
  for (const ruleItem of ruleAllergens) {
    const existing = allergensMap.get(ruleItem.tag);
    if (!existing) {
      // If it was in mayContain, promote to allergens if rule is high confidence
      if (mayContainMap.has(ruleItem.tag) && ruleItem.confidence === "high") {
        mayContainMap.delete(ruleItem.tag);
        allergensMap.set(ruleItem.tag, ruleItem);
      } else if (!mayContainMap.has(ruleItem.tag)) {
        allergensMap.set(ruleItem.tag, ruleItem);
      }
    } else if (ruleItem.confidence === "high" && existing.confidence !== "high") {
      allergensMap.set(ruleItem.tag, ruleItem);
    }
  }

  // 3. Deterministic keyword scanner for dietary
  for (const ruleItem of ruleDietary) {
    const existing = dietaryMap.get(ruleItem.tag);
    if (!existing || (ruleItem.confidence === "high" && existing.confidence !== "high")) {
      dietaryMap.set(ruleItem.tag, ruleItem);
    }
  }

  // 4. Ensure no item is in both allergens and mayContain
  for (const key of allergensMap.keys()) {
    mayContainMap.delete(key);
  }

  // 5. Cross-tag safety pruning: never suggest contradictory diet tags
  if (allergensMap.has("egg")) {
    dietaryMap.delete("egg_free");
    dietaryMap.delete("vegan");
  }
  if (allergensMap.has("milk") || allergensMap.has("fish") || allergensMap.has("shellfish")) {
    dietaryMap.delete("vegan");
  }
  if (allergensMap.has("fish") || allergensMap.has("shellfish")) {
    dietaryMap.delete("vegetarian");
    dietaryMap.delete("jain");
  }

  return {
    dietary: Array.from(dietaryMap.values()),
    allergens: Array.from(allergensMap.values()),
    mayContain: Array.from(mayContainMap.values()),
    aiAvailable: aiResult !== null,
  };
}

export async function suggestListingTags(input: SuggestInput): Promise<SuggestTagsResult> {
  const cacheKey = getCacheKey(input.title, input.description, input.photo);
  const cached = suggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  const model = process.env.LLM_MODEL || (provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash");

  // If no API key configured, use deterministic scanner safely
  if (!apiKey) {
    const fallback = mergeWithDeterministicSafetyNet(null, input.title, input.description);
    fallback.aiAvailable = false;
    suggestionCache.set(cacheKey, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
    return fallback;
  }

  const userPrompt = `Item Title: "${input.title}"\nDescription: "${input.description || "N/A"}"\nPhoto category reference: "${input.photo || "none"}"`;

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
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
              parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const json = (await response.json()) as any;
      rawJsonText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    const cleanedJson = rawJsonText
      .replace(/^```json/im, "")
      .replace(/^```/im, "")
      .replace(/```$/im, "")
      .trim();

    const parsed = JSON.parse(cleanedJson);
    const validatedAiResult = {
      dietary: Array.isArray(parsed.dietary) ? parsed.dietary : [],
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens : [],
      mayContain: Array.isArray(parsed.mayContain) ? parsed.mayContain : [],
    };

    const finalResult = mergeWithDeterministicSafetyNet(validatedAiResult, input.title, input.description);
    suggestionCache.set(cacheKey, { data: finalResult, expiresAt: Date.now() + CACHE_TTL_MS });
    return finalResult;
  } catch (err) {
    // Graceful fallback to deterministic safety net on timeout or failure
    const fallback = mergeWithDeterministicSafetyNet(null, input.title, input.description);
    fallback.aiAvailable = false;
    return fallback;
  }
}
