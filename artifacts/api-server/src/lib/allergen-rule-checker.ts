import type { AllergenTag, DietaryTag, TagSuggestion } from "@workspace/api-zod";

export const DIETARY_TAGS: DietaryTag[] = ["vegetarian", "vegan", "egg_free", "jain", "halal"];
export const ALLERGEN_TAGS: AllergenTag[] = [
  "milk", "egg", "peanuts", "tree_nuts", "gluten", "soy", "fish", "shellfish", "sesame", "mustard"
];
export type { AllergenTag, DietaryTag, TagSuggestion };

export interface AllergenRuleHit {
  tag: AllergenTag;
  matchedWord: string;
  source: "title" | "description";
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface DietRuleHit {
  tag: DietaryTag;
  matchedWord: string;
  source: "title" | "description";
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface ContradictionCheckResult {
  hasContradiction: boolean;
  warnings: string[];
  blockingReasons: string[];
}

// 1. Allergen Keywords Dictionary (English + Hindi / Hinglish + Common Mumbai dishes)
const ALLERGEN_KEYWORDS: Record<AllergenTag, Array<{ word: string; confidence: "high" | "medium" | "low"; reason: string }>> = {
  milk: [
    { word: "paneer", confidence: "high", reason: "contains cottage cheese (dairy milk)" },
    { word: "butter", confidence: "high", reason: "contains dairy butter" },
    { word: "buttered", confidence: "high", reason: "spread or cooked with dairy butter" },
    { word: "makhani", confidence: "high", reason: "cooked in butter and cream" },
    { word: "ghee", confidence: "high", reason: "clarified dairy butter" },
    { word: "cheese", confidence: "high", reason: "contains dairy cheese" },
    { word: "curd", confidence: "high", reason: "contains dairy curd/dahi" },
    { word: "dahi", confidence: "high", reason: "contains yogurt/curd" },
    { word: "cream", confidence: "high", reason: "contains dairy cream" },
    { word: "malai", confidence: "high", reason: "contains milk fat cream" },
    { word: "milk", confidence: "high", reason: "contains milk" },
    { word: "dudh", confidence: "high", reason: "contains milk" },
    { word: "mawa", confidence: "high", reason: "contains dried whole milk solids" },
    { word: "khoya", confidence: "high", reason: "contains condensed milk solids" },
    { word: "rabdi", confidence: "high", reason: "condensed sweetened milk" },
    { word: "kheer", confidence: "high", reason: "milk rice pudding" },
    { word: "chaas", confidence: "high", reason: "buttermilk drink" },
    { word: "lassi", confidence: "high", reason: "yogurt beverage" },
    { word: "raita", confidence: "high", reason: "yogurt condiment" },
    { word: "yogurt", confidence: "high", reason: "contains yogurt" },
    { word: "yoghurt", confidence: "high", reason: "contains yogurt" },
    { word: "burrata", confidence: "high", reason: "fresh cow milk cheese" },
    { word: "mozzarella", confidence: "high", reason: "dairy cheese" },
    { word: "cheddar", confidence: "high", reason: "dairy cheese" },
    { word: "ricotta", confidence: "high", reason: "whey milk cheese" },
    { word: "brie", confidence: "high", reason: "dairy cheese" },
    { word: "biryani", confidence: "medium", reason: "traditionally cooked with ghee, curd, or butter" },
    { word: "croissant", confidence: "high", reason: "laminated with dairy butter" },
    { word: "brioche", confidence: "high", reason: "enriched with butter and milk" },
    { word: "bun maska", confidence: "high", reason: "slathered with butter" },
  ],
  egg: [
    { word: "egg", confidence: "high", reason: "contains egg" },
    { word: "eggs", confidence: "high", reason: "contains eggs" },
    { word: "anda", confidence: "high", reason: "contains egg (anda)" },
    { word: "baida", confidence: "high", reason: "contains egg (baida)" },
    { word: "omelette", confidence: "high", reason: "egg dish" },
    { word: "omelet", confidence: "high", reason: "egg dish" },
    { word: "mayo", confidence: "high", reason: "traditionally made with egg yolks" },
    { word: "mayonnaise", confidence: "high", reason: "contains egg emulsion" },
    { word: "custard", confidence: "medium", reason: "often thickened with egg yolks" },
    { word: "meringue", confidence: "high", reason: "whipped egg whites" },
  ],
  peanuts: [
    { word: "peanut", confidence: "high", reason: "contains peanuts" },
    { word: "peanuts", confidence: "high", reason: "contains peanuts" },
    { word: "groundnut", confidence: "high", reason: "contains groundnuts (peanuts)" },
    { word: "groundnuts", confidence: "high", reason: "contains groundnuts" },
    { word: "moongphali", confidence: "high", reason: "contains peanuts" },
    { word: "mungfali", confidence: "high", reason: "contains peanuts" },
    { word: "shengdana", confidence: "high", reason: "crushed peanuts in Maharashtrian cuisine" },
    { word: "dabeli", confidence: "high", reason: "topped with spiced roasted peanuts" },
    { word: "sabudana khichdi", confidence: "high", reason: "crushed roasted peanuts are a primary ingredient" },
  ],
  tree_nuts: [
    { word: "almond", confidence: "high", reason: "contains tree nut: almonds" },
    { word: "almonds", confidence: "high", reason: "contains tree nut: almonds" },
    { word: "badam", confidence: "high", reason: "contains almonds (badam)" },
    { word: "cashew", confidence: "high", reason: "contains tree nut: cashews" },
    { word: "cashews", confidence: "high", reason: "contains cashews" },
    { word: "kaju", confidence: "high", reason: "contains cashews (kaju)" },
    { word: "walnut", confidence: "high", reason: "contains tree nut: walnuts" },
    { word: "walnuts", confidence: "high", reason: "contains walnuts" },
    { word: "akhrot", confidence: "high", reason: "contains walnuts" },
    { word: "pista", confidence: "high", reason: "contains pistachios" },
    { word: "pistachio", confidence: "high", reason: "contains pistachios" },
    { word: "pistachios", confidence: "high", reason: "contains pistachios" },
    { word: "hazelnut", confidence: "high", reason: "contains tree nut: hazelnuts" },
    { word: "hazelnuts", confidence: "high", reason: "contains hazelnuts" },
    { word: "pecan", confidence: "high", reason: "contains pecans" },
    { word: "pecans", confidence: "high", reason: "contains pecans" },
    { word: "praline", confidence: "high", reason: "candied nuts" },
    { word: "nutella", confidence: "high", reason: "contains hazelnut paste" },
    { word: "ferrero", confidence: "high", reason: "contains hazelnut" },
    { word: "korma", confidence: "medium", reason: "traditional korma gravy uses blended cashew/almond paste" },
  ],
  gluten: [
    { word: "maida", confidence: "high", reason: "refined wheat flour contains gluten" },
    { word: "atta", confidence: "high", reason: "whole wheat flour contains gluten" },
    { word: "wheat", confidence: "high", reason: "contains wheat gluten" },
    { word: "gehu", confidence: "high", reason: "wheat contains gluten" },
    { word: "bread", confidence: "high", reason: "wheat bread contains gluten" },
    { word: "bun", confidence: "high", reason: "wheat bun contains gluten" },
    { word: "pav", confidence: "high", reason: "bakery pav made from refined wheat flour" },
    { word: "pao", confidence: "high", reason: "bakery pav made from refined wheat flour" },
    { word: "naan", confidence: "high", reason: "wheat flatbread" },
    { word: "parotta", confidence: "high", reason: "layered wheat flatbread" },
    { word: "paratha", confidence: "high", reason: "wheat flatbread" },
    { word: "roti", confidence: "high", reason: "wheat flatbread" },
    { word: "chapati", confidence: "high", reason: "wheat flatbread" },
    { word: "kulcha", confidence: "high", reason: "wheat flatbread" },
    { word: "croissant", confidence: "high", reason: "laminated wheat dough" },
    { word: "sourdough", confidence: "high", reason: "fermented wheat flour" },
    { word: "brioche", confidence: "high", reason: "wheat dough" },
    { word: "babka", confidence: "high", reason: "yeasted wheat bread" },
    { word: "bagel", confidence: "high", reason: "boiled wheat bread" },
    { word: "puff", confidence: "high", reason: "wheat puff pastry" },
    { word: "pastry", confidence: "high", reason: "wheat flour pastry" },
    { word: "cookie", confidence: "high", reason: "wheat flour baked good" },
    { word: "cookies", confidence: "high", reason: "wheat flour baked good" },
    { word: "biscuit", confidence: "high", reason: "wheat flour baked biscuit" },
    { word: "biscuits", confidence: "high", reason: "wheat flour baked biscuit" },
    { word: "flour", confidence: "high", reason: "wheat flour contains gluten" },
    { word: "cake", confidence: "high", reason: "wheat flour cake" },
    { word: "pasta", confidence: "high", reason: "durum wheat pasta" },
    { word: "noodles", confidence: "high", reason: "wheat noodles" },
    { word: "semolina", confidence: "high", reason: "wheat semolina" },
    { word: "sooji", confidence: "high", reason: "wheat semolina (sooji/rava)" },
    { word: "suji", confidence: "high", reason: "wheat semolina (suji/rava)" },
    { word: "rava", confidence: "high", reason: "wheat semolina" },
    { word: "bhatura", confidence: "high", reason: "fried leavened maida flatbread" },
    { word: "bhature", confidence: "high", reason: "fried leavened maida flatbread" },
    { word: "puri", confidence: "high", reason: "deep fried wheat bread" },
    { word: "poori", confidence: "high", reason: "deep fried wheat bread" },
    { word: "samosa", confidence: "high", reason: "crisp maida shell contains gluten" },
    { word: "kachori", confidence: "high", reason: "wheat/maida pastry shell" },
  ],
  soy: [
    { word: "soy", confidence: "high", reason: "contains soy" },
    { word: "soya", confidence: "high", reason: "contains soya" },
    { word: "soybean", confidence: "high", reason: "contains soybean" },
    { word: "tofu", confidence: "high", reason: "coagulated soy milk" },
    { word: "edamame", confidence: "high", reason: "young soybeans" },
    { word: "miso", confidence: "high", reason: "fermented soybean paste" },
    { word: "tempeh", confidence: "high", reason: "fermented soybean cake" },
    { word: "soy sauce", confidence: "high", reason: "fermented soy condiment" },
  ],
  fish: [
    { word: "fish", confidence: "high", reason: "contains fish" },
    { word: "machhli", confidence: "high", reason: "contains fish" },
    { word: "machli", confidence: "high", reason: "contains fish" },
    { word: "salmon", confidence: "high", reason: "contains salmon fish" },
    { word: "tuna", confidence: "high", reason: "contains tuna fish" },
    { word: "pomfret", confidence: "high", reason: "contains pomfret fish" },
    { word: "surmai", confidence: "high", reason: "contains kingfish (surmai)" },
    { word: "rawas", confidence: "high", reason: "contains Indian salmon (rawas)" },
    { word: "bangda", confidence: "high", reason: "contains mackerel (bangda)" },
    { word: "mackerel", confidence: "high", reason: "contains mackerel fish" },
    { word: "bombil", confidence: "high", reason: "contains Bombay duck (bombil)" },
  ],
  shellfish: [
    { word: "prawn", confidence: "high", reason: "contains shellfish (prawns)" },
    { word: "prawns", confidence: "high", reason: "contains shellfish (prawns)" },
    { word: "jhinga", confidence: "high", reason: "contains prawns (jhinga)" },
    { word: "kolambi", confidence: "high", reason: "contains prawns (kolambi)" },
    { word: "shrimp", confidence: "high", reason: "contains shellfish (shrimp)" },
    { word: "lobster", confidence: "high", reason: "contains shellfish (lobster)" },
    { word: "crab", confidence: "high", reason: "contains shellfish (crab)" },
    { word: "khekda", confidence: "high", reason: "contains crab" },
    { word: "squid", confidence: "high", reason: "contains mollusc/shellfish" },
    { word: "calamari", confidence: "high", reason: "contains squid" },
    { word: "clam", confidence: "high", reason: "contains shellfish (clams)" },
    { word: "oyster", confidence: "high", reason: "contains shellfish (oysters)" },
  ],
  sesame: [
    { word: "sesame", confidence: "high", reason: "contains sesame seeds" },
    { word: "til", confidence: "high", reason: "contains sesame (til)" },
    { word: "tahini", confidence: "high", reason: "ground sesame paste" },
    { word: "gingelly", confidence: "high", reason: "sesame oil" },
    { word: "tilkut", confidence: "high", reason: "pounded sesame sweet" },
    { word: "hummus", confidence: "medium", reason: "traditionally blended with sesame tahini" },
  ],
  mustard: [
    { word: "mustard", confidence: "high", reason: "contains mustard" },
    { word: "sarson", confidence: "high", reason: "contains mustard (sarson)" },
    { word: "rai", confidence: "high", reason: "contains mustard seeds (rai)" },
    { word: "kasundi", confidence: "high", reason: "bengali mustard sauce" },
  ],
};

// Words that contradict diets
const NON_VEG_WORDS = [
  "chicken", "mutton", "lamb", "pork", "beef", "bacon", "fish", "prawn",
  "prawns", "shrimp", "lobster", "crab", "meat", "kheema", "keema",
  "gosht", "murgh", "pepperoni", "ham", "sausage", "surmai", "pomfret",
];

const NON_VEGAN_WORDS = [
  ...NON_VEG_WORDS,
  "egg", "eggs", "anda", "baida", "omelette", "paneer", "butter", "makhani",
  "ghee", "cheese", "curd", "dahi", "cream", "malai", "milk", "dudh",
  "mawa", "khoya", "rabdi", "kheer", "honey", "burrata", "ricotta", "mozzarella",
];

const NON_JAIN_WORDS = [
  ...NON_VEG_WORDS,
  "onion", "onions", "pyaz", "pyaaz", "kanda",
  "garlic", "lehsun", "lahsun",
  "potato", "potatoes", "aloo", "alu", "batata",
  "carrot", "carrots", "gajar",
  "radish", "mooli",
  "ginger", "adrak",
  "beetroot", "turnip",
];

/**
 * Deterministic keyword scanning for allergens
 */
export function scanAllergens(title: string, description = ""): AllergenRuleHit[] {
  const text = `${title} ${description}`.toLowerCase();
  const hits: AllergenRuleHit[] = [];
  const seenTags = new Set<AllergenTag>();

  for (const [tag, keywords] of Object.entries(ALLERGEN_KEYWORDS) as Array<[AllergenTag, typeof ALLERGEN_KEYWORDS[AllergenTag]]>) {
    for (const kw of keywords) {
      // Regex boundary check to avoid partial word mismatches
      const regex = new RegExp(`\\b${escapeRegExp(kw.word)}\\b`, "i");
      let titleMatch = regex.test(title);
      let descMatch = regex.test(description);

      // Avoid matching dairy 'curd' if the text specifically says 'soy curd' or 'bean curd'
      if (tag === "milk" && kw.word === "curd") {
        if (/\b(soy|bean)\s+curd\b/i.test(title)) titleMatch = false;
        if (/\b(soy|bean)\s+curd\b/i.test(description)) descMatch = false;
      }

      // Avoid matching egg allergen if the text is explicitly "eggless" or "without eggs"
      if (tag === "egg" && (kw.word === "egg" || kw.word === "eggs")) {
        if (/\b(without|no|zero)\s+(egg|eggs)\b/i.test(title) || /\beggless\b/i.test(title)) {
          titleMatch = false;
        }
        if (/\b(without|no|zero)\s+(egg|eggs)\b/i.test(description) || /\beggless\b/i.test(description)) {
          descMatch = false;
        }
      }

      if (titleMatch || descMatch) {
        if (!seenTags.has(tag)) {
          seenTags.add(tag);
          hits.push({
            tag,
            matchedWord: kw.word,
            source: titleMatch ? "title" : "description",
            confidence: kw.confidence,
            reason: `${titleMatch ? "Title" : "Description"} mentions "${kw.word}": ${kw.reason}`,
          });
        }
        break;
      }
    }
  }

  return hits;
}

/**
 * Deterministic dietary suggestions based on keywords
 */
export function scanDietary(title: string, description = ""): DietRuleHit[] {
  const text = `${title} ${description}`.toLowerCase();
  const hits: DietRuleHit[] = [];

  const hasNonVeg = NON_VEG_WORDS.some((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(text));

  // Strip negated egg phrases so "eggless", "without eggs", "no egg" do not falsely mark hasEgg = true
  const sanitizedForEgg = text
    .replace(/\b(eggless|egg[ -]free)\b/gi, "")
    .replace(/\b(without|no|zero)\s+(eggs|egg)\b/gi, "")
    .trim();
  const hasEgg = /\b(egg|eggs|anda|baida|omelette)\b/i.test(sanitizedForEgg);
  
  // Allow "soy curd" or "bean curd" (tofu) without falsely triggering the dairy "curd" non-vegan match
  const sanitizedForVegan = text.replace(/\b(soy|bean)\s+curd\b/gi, "tofu");
  const hasNonVegan = NON_VEGAN_WORDS.some((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(sanitizedForVegan));
  
  // For Jain check, strip out negated root vegetable phrases like "no onion", "no garlic", "without onion", "without potato"
  const sanitizedForJain = text
    .replace(/\b(no|without|zero)\s+(onion|onions|garlic|potatoes|potato|root vegetables)\b/gi, "")
    .trim();
  const hasNonJain = NON_JAIN_WORDS.some((w) => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(sanitizedForJain));

  if (!hasNonVeg && !hasEgg) {
    hits.push({
      tag: "vegetarian",
      matchedWord: "veg ingredients",
      source: "title",
      confidence: "high",
      reason: "No meat or egg ingredients found in item name or description.",
    });
  }

  if (!hasNonVegan) {
    // Only suggest vegan when explicit vegan cues exist or cleanly plant based
    if (/\b(vegan|plant[ -]based|dairy[ -]free)\b/i.test(text)) {
      hits.push({
        tag: "vegan",
        matchedWord: "vegan",
        source: "title",
        confidence: "high",
        reason: "Item explicitly indicates plant-based/vegan preparation with no dairy.",
      });
    }
  }

  if (!hasEgg) {
    if (/\b(eggless|egg[ -]free)\b/i.test(text) || (!hasNonVeg && !hasEgg)) {
      hits.push({
        tag: "egg_free",
        matchedWord: "eggless",
        source: "title",
        confidence: "high",
        reason: "Contains no eggs.",
      });
    }
  }

  if (!hasNonJain && /\b(jain|no onion|no garlic)\b/i.test(text)) {
    hits.push({
      tag: "jain",
      matchedWord: "jain",
      source: "title",
      confidence: "high",
      reason: "Item explicitly marked Jain friendly (no root vegetables, onions, or garlic).",
    });
  }

  if (/\b(halal)\b/i.test(text)) {
    hits.push({
      tag: "halal",
      matchedWord: "halal",
      source: "title",
      confidence: "high",
      reason: "Item explicitly marked as Halal certified.",
    });
  }

  return hits;
}

/**
 * Contradiction check: ensures the vendor tags do not directly contradict the text.
 * Blocks confirmation until resolved.
 */
export function checkContradictions(
  title: string,
  description: string,
  confirmedDiet: DietaryTag[],
  confirmedAllergens: AllergenTag[],
): ContradictionCheckResult {
  const text = `${title} ${description}`.toLowerCase();
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  // Check 1: Vegan contradiction
  if (confirmedDiet.includes("vegan")) {
    const sanitizedForVegan = text.replace(/\b(soy|bean)\s+curd\b/gi, "tofu");
    const offendingWords: string[] = [];
    for (const word of NON_VEGAN_WORDS) {
      if (new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(sanitizedForVegan)) {
        offendingWords.push(word);
      }
    }
    if (offendingWords.length > 0) {
      const msg = `Cannot mark as "vegan" because description/title mentions ${offendingWords.slice(0, 3).map((w) => `"${w}"`).join(", ")}.`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
    if (confirmedAllergens.includes("milk") || confirmedAllergens.includes("egg") || confirmedAllergens.includes("fish") || confirmedAllergens.includes("shellfish")) {
      const msg = `Cannot mark as "vegan" while selecting allergens containing milk, egg, or seafood.`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
  }

  // Check 2: Vegetarian contradiction
  if (confirmedDiet.includes("vegetarian")) {
    const offendingWords: string[] = [];
    for (const word of NON_VEG_WORDS) {
      if (new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(text)) {
        offendingWords.push(word);
      }
    }
    if (offendingWords.length > 0) {
      const msg = `Cannot mark as "vegetarian" because description/title mentions ${offendingWords.slice(0, 3).map((w) => `"${w}"`).join(", ")}.`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
    if (confirmedAllergens.includes("fish") || confirmedAllergens.includes("shellfish")) {
      const msg = `Cannot mark as "vegetarian" while selecting seafood allergens.`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
  }

  // Check 3: Egg-Free contradiction
  if (confirmedDiet.includes("egg_free")) {
    const sanitizedForEgg = text
      .replace(/\b(eggless|egg[ -]free)\b/gi, "")
      .replace(/\b(without|no|zero)\s+(eggs|egg)\b/gi, "")
      .trim();
    if (/\b(egg|eggs|anda|baida|omelette)\b/i.test(sanitizedForEgg)) {
      const msg = `Cannot mark as "egg_free" because description/title mentions eggs.`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
    if (confirmedAllergens.includes("egg")) {
      const msg = `Cannot mark as "egg_free" while selecting egg under "Contains Allergens".`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
  }

  // Check 4: Jain contradiction
  if (confirmedDiet.includes("jain")) {
    const sanitizedForJain = text
      .replace(/\b(no|without|zero)\s+(onion|onions|garlic|potatoes|potato|root vegetables)\b/gi, "")
      .trim();
    const offendingWords: string[] = [];
    for (const word of NON_JAIN_WORDS) {
      if (new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(sanitizedForJain)) {
        offendingWords.push(word);
      }
    }
    if (offendingWords.length > 0) {
      const msg = `Cannot mark as "jain" because description/title mentions root vegetables or non-veg (${offendingWords.slice(0, 3).map((w) => `"${w}"`).join(", ")}).`;
      warnings.push(msg);
      blockingReasons.push(msg);
    }
  }

  // Check 5: Allergen omission warnings (if title mentions peanut, but peanut wasn't flagged in allergens)
  const hits = scanAllergens(title, description);
  for (const hit of hits) {
    if (!confirmedAllergens.includes(hit.tag)) {
      warnings.push(`Warning: Text mentions "${hit.matchedWord}", but "${hit.tag}" is not marked under allergens.`);
    }
  }

  return {
    hasContradiction: blockingReasons.length > 0,
    warnings,
    blockingReasons,
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
