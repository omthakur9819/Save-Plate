import test from "node:test";
import assert from "node:assert/strict";
import {
  scanAllergens,
  scanDietary,
  checkContradictions,
  type AllergenTag,
  type DietaryTag,
} from "../src/lib/allergen-rule-checker.js";
import { suggestListingTags } from "../src/lib/llm-allergen-suggester.js";

test("Rule Checker: unit tests for all 10 allergen detections", () => {
  const getTags = (title: string, desc = "") => scanAllergens(title, desc).map((h) => h.tag);

  assert.ok(getTags("Contains dairy cream, fresh milk and butter").includes("milk"));
  assert.ok(getTags("Made with anda bhurji and boiled eggs").includes("egg"));
  assert.ok(getTags("Roasted singdana peanut chutney").includes("peanuts"));
  assert.ok(getTags("Garnished with roasted kaju badam and pistachio").includes("tree_nuts"));
  assert.ok(getTags("Freshly baked maida pao and whole wheat roti").includes("gluten"));
  assert.ok(getTags("Tossed in dark soya sauce and edamame").includes("soy"));
  assert.ok(getTags("Crispy surmai fish fry with pomfret curry").includes("fish"));
  assert.ok(getTags("Butter garlic prawns and kolambi masala").includes("shellfish"));
  assert.ok(getTags("Sprinkled with white til and sesame seeds").includes("sesame"));
  assert.ok(getTags("Tempered with rai and yellow sarson tadka").includes("mustard"));
});

test("Rule Checker: unit tests for all 5 dietary detections", () => {
  const getDietTags = (title: string, desc = "") => scanDietary(title, desc).map((h) => h.tag);

  const vegTags = getDietTags("Fresh vegetable pulao", "vegetables, rice, spices");
  assert.ok(vegTags.includes("vegetarian"));

  const nonVegTags = getDietTags("Tandoori chicken tangdi kabab", "chicken, yogurt, spices");
  assert.ok(!nonVegTags.includes("vegetarian"));

  const eggTags = getDietTags("Egg omelette with toast", "eggs, butter, onions, bread");
  assert.ok(!eggTags.includes("vegetarian"));
  assert.ok(!eggTags.includes("egg_free"));

  const jainTags = getDietTags("Pure Jain Dal Khichdi", "moong dal, rice, turmeric, hing, no onion no garlic");
  assert.ok(jainTags.includes("jain"));

  const onionTags = getDietTags("Paneer Butter Masala", "paneer, onion tomato gravy, garlic paste");
  assert.ok(!onionTags.includes("jain"));
});

test("Rule Checker: contradiction detection catches invalid vendor combinations", () => {
  // Vegan + Milk
  const c1 = checkContradictions(
    "Vegan Coffee",
    "Brewed with regular cow milk",
    ["vegan"],
    ["milk"]
  );
  assert.ok(c1.hasContradiction);
  assert.ok(c1.blockingReasons.some((msg) => msg.includes("vegan")));

  // Vegan + Egg
  const c2 = checkContradictions(
    "Vegan Cake",
    "Contains eggs",
    ["vegan"],
    ["egg"]
  );
  assert.ok(c2.hasContradiction);
  assert.ok(c2.blockingReasons.some((msg) => msg.includes("vegan")));

  // Vegetarian + Meat
  const c3 = checkContradictions(
    "Veg Fish Curry",
    "Fresh pomfret in coconut curry",
    ["vegetarian"],
    ["fish"]
  );
  assert.ok(c3.hasContradiction);
  assert.ok(c3.blockingReasons.some((msg) => msg.includes("vegetarian")));

  // Egg Free + Egg allergen
  const c4 = checkContradictions(
    "Egg Free Brownie",
    "Eggs used for fluffiness",
    ["egg_free"],
    ["egg"]
  );
  assert.ok(c4.hasContradiction);
  assert.ok(c4.blockingReasons.some((msg) => msg.includes("egg_free")));

  // Jain + Onion / Garlic
  const c5 = checkContradictions(
    "Jain Pulao",
    "Cooked with diced onions, garlic and ginger",
    ["jain"],
    []
  );
  assert.ok(c5.hasContradiction);
  assert.ok(c5.blockingReasons.some((msg) => msg.includes("jain")));
});

interface EvaluationTestCase {
  id: number;
  dish: string;
  description: string;
  mustContainAllergens: AllergenTag[];
  forbiddenDietTags?: DietaryTag[];
  expectedDietTags?: DietaryTag[];
}

const indianCuisineEvaluationSuite: EvaluationTestCase[] = [
  {
    id: 1,
    dish: "Paneer Tikka Kathi Roll",
    description: "Grilled cottage cheese wrapped in maida paratha with onion and mint mayo",
    mustContainAllergens: ["milk", "gluten"],
    forbiddenDietTags: ["vegan"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 2,
    dish: "Mumbai Bun Maska",
    description: "Soft bakery bun loaded with Amul butter",
    mustContainAllergens: ["gluten", "milk"],
    forbiddenDietTags: ["vegan"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 3,
    dish: "Kaju Katli Sweet Box",
    description: "Diamond shaped cashew fudge made with mawa and ghee",
    mustContainAllergens: ["tree_nuts", "milk"],
    forbiddenDietTags: ["vegan"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 4,
    dish: "Kolkata Style Egg Roll",
    description: "Flaky paratha coated with double anda, chopped onions and green chillies",
    mustContainAllergens: ["gluten", "egg"],
    forbiddenDietTags: ["egg_free", "vegan"],
  },
  {
    id: 5,
    dish: "Surmai Rava Fish Fry",
    description: "Kingfish steaks coated in spicy masala and semolina crust, shallow fried",
    mustContainAllergens: ["fish", "gluten"],
    forbiddenDietTags: ["vegetarian", "vegan", "jain"],
  },
  {
    id: 6,
    dish: "Butter Chicken with Garlic Naan",
    description: "Tandoori chicken pieces in rich tomato butter cream gravy with refined wheat naan",
    mustContainAllergens: ["milk", "gluten"],
    forbiddenDietTags: ["vegetarian", "vegan", "jain"],
  },
  {
    id: 7,
    dish: "Koliwada Prawns",
    description: "Crispy batter fried kolambi with red chili and garlic",
    mustContainAllergens: ["shellfish"],
    forbiddenDietTags: ["vegetarian", "vegan", "jain"],
  },
  {
    id: 8,
    dish: "Kutchi Dabeli (Set of 2)",
    description: "Spiced potato mix in pav stuffed with roasted masala singdana peanuts and sev",
    mustContainAllergens: ["gluten", "peanuts"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 9,
    dish: "Veg Hakka Noodles & Manchurian",
    description: "Stir fried noodles tossed in dark soya sauce, vinegar, cabbage and spring onion",
    mustContainAllergens: ["gluten", "soy"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 10,
    dish: "Tilgul Laddu",
    description: "Traditional Maharashtrian sesame seed sweets bound with jaggery and roasted groundnuts",
    mustContainAllergens: ["sesame", "peanuts"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 11,
    dish: "Sarson Da Saag & Makki Roti",
    description: "Mustard green curry cooked in desi ghee with yellow rai tadka and corn bread",
    mustContainAllergens: ["mustard", "milk"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 12,
    dish: "Dal Makhani with Jeera Rice",
    description: "Slow-simmered black urad dal loaded with white butter, makkhan and fresh cream",
    mustContainAllergens: ["milk"],
    forbiddenDietTags: ["vegan"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 13,
    dish: "Jain Paneer Lababdar",
    description: "No onion no garlic cottage cheese curry cooked in tomato and cashew melon seed gravy",
    mustContainAllergens: ["milk", "tree_nuts"],
    expectedDietTags: ["vegetarian", "jain"],
  },
  {
    id: 14,
    dish: "Steamed Idli Sambar with Coconut Chutney",
    description: "Fermented rice and urad dal cakes with lentil vegetable stew tempered with mustard seeds",
    mustContainAllergens: ["mustard"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 15,
    dish: "Bombay Duck Fry (Bombil)",
    description: "Fresh coastal bombil fish marinated in Malvani masala and suji crumb",
    mustContainAllergens: ["fish", "gluten"],
    forbiddenDietTags: ["vegetarian"],
  },
  {
    id: 16,
    dish: "Crab Masala Curry",
    description: "Mud crabs cooked in spicy coconut and coastal spices",
    mustContainAllergens: ["shellfish"],
    forbiddenDietTags: ["vegetarian"],
  },
  {
    id: 17,
    dish: "Badam Pista Shrikhand",
    description: "Strained hung curd sweetened with sugar, cardamom, sliced almonds and pistachios",
    mustContainAllergens: ["milk", "tree_nuts"],
    forbiddenDietTags: ["vegan"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 18,
    dish: "Egg Bhurji Pav",
    description: "Scrambled spiced eggs cooked with onions, tomatoes and buttered ladi pav",
    mustContainAllergens: ["egg", "gluten", "milk"],
    forbiddenDietTags: ["egg_free", "vegan", "vegetarian"],
  },
  {
    id: 19,
    dish: "Halal Mutton Rogan Josh",
    description: "Tender lamb cooked with Kashmiri red chillies, certified Halal meat",
    forbiddenDietTags: ["vegetarian", "vegan", "jain"],
    expectedDietTags: ["halal"],
  },
  {
    id: 20,
    dish: "Soya Chaap Tikka",
    description: "Marinated soybean chunks grilled with dahi, hung curd and chaat masala",
    mustContainAllergens: ["soy", "milk"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 21,
    dish: "Sabudana Vada (Upwas Special)",
    description: "Crispy tapioca pearl patties blended with crushed peanuts and green chillies",
    mustContainAllergens: ["peanuts"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 22,
    dish: "Tofu Stir Fry Bowl",
    description: "100% plant based firm soy curd with broccoli, peppers and sesame oil dressing",
    mustContainAllergens: ["soy", "sesame"],
    expectedDietTags: ["vegan", "vegetarian", "egg_free"],
  },
  {
    id: 23,
    dish: "Chicken Keema Pav",
    description: "Minced spiced chicken cooked with ginger garlic paste, served with bread rolls",
    mustContainAllergens: ["gluten"],
    forbiddenDietTags: ["vegetarian", "vegan"],
  },
  {
    id: 24,
    dish: "Misal Pav",
    description: "Spicy moth bean sprout curry topped with farsan, onions, coriander and pao",
    mustContainAllergens: ["gluten"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 25,
    dish: "Walnut & Date Halwa",
    description: "Warm akhrot pudding simmered in pure cow ghee and khoya",
    mustContainAllergens: ["tree_nuts", "milk"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 26,
    dish: "Masala Chai with Osmania Biscuits",
    description: "Tea boiled with dairy milk and cardamom, served with flour biscuits",
    mustContainAllergens: ["milk", "gluten"],
    expectedDietTags: ["vegetarian"],
  },
  {
    id: 27,
    dish: "Kolhapuri Pandhra Rassa Mutton",
    description: "Rich white mutton broth prepared with coconut milk and mutton stock",
    forbiddenDietTags: ["vegetarian", "vegan", "jain"],
  },
  {
    id: 28,
    dish: "Jain Moong Dal Halwa",
    description: "Lentil sweet roasted in pure ghee and cashew nuts, completely sattvic",
    mustContainAllergens: ["milk", "tree_nuts"],
    expectedDietTags: ["vegetarian", "jain"],
  },
  {
    id: 29,
    dish: "Eggless Belgian Chocolate Pastry",
    description: "Layered cocoa sponge cake without eggs, whipped cream topping",
    mustContainAllergens: ["milk", "gluten"],
    expectedDietTags: ["vegetarian", "egg_free"],
  },
  {
    id: 30,
    dish: "Fish Curry with Brown Rice",
    description: "Fresh Kingfish steaks cooked in coastal Kokum and coconut gravy",
    mustContainAllergens: ["fish"],
    forbiddenDietTags: ["vegetarian", "vegan", "jain"],
  },
];

test("Evaluation Suite: 30 Indian dishes with 0 false negatives for severe allergens", async () => {
  let falseNegatives = 0;
  let contradictionFailures = 0;

  for (const item of indianCuisineEvaluationSuite) {
    const rawSuggestion = await suggestListingTags({
      title: item.dish,
      description: item.description,
    });

    const suggestion = {
      dietTags: rawSuggestion.dietary.map((d) => d.tag as DietaryTag),
      allergens: rawSuggestion.allergens.map((a) => a.tag as AllergenTag),
      mayContain: rawSuggestion.mayContain.map((m) => m.tag as AllergenTag),
    };

    // Check 0 false negatives for severe allergens
    for (const requiredAllergen of item.mustContainAllergens ?? []) {
      const hasAllergen =
        suggestion.allergens.includes(requiredAllergen) ||
        suggestion.mayContain.includes(requiredAllergen);

      if (!hasAllergen) {
        falseNegatives++;
        console.error(
          `FAIL [Dish #${item.id}]: "${item.dish}" missed expected allergen "${requiredAllergen}". Got:`,
          suggestion.allergens,
          suggestion.mayContain
        );
      }
      assert.ok(
        hasAllergen,
        `Dish #${item.id} (${item.dish}) must detect allergen ${requiredAllergen}`
      );
    }

    // Check forbidden diet tags
    if (item.forbiddenDietTags) {
      for (const forbidden of item.forbiddenDietTags) {
        assert.ok(
          !suggestion.dietTags.includes(forbidden),
          `Dish #${item.id} (${item.dish}) incorrectly suggested forbidden diet tag ${forbidden}`
        );
      }
    }

    // Check expected diet tags if applicable
    if (item.expectedDietTags) {
      for (const expected of item.expectedDietTags) {
        assert.ok(
          suggestion.dietTags.includes(expected),
          `Dish #${item.id} (${item.dish}) should include expected diet tag ${expected}`
        );
      }
    }

    // Check that suggestion passes contradiction checker without errors
    const checkResult = checkContradictions(
      item.dish,
      item.description,
      suggestion.dietTags,
      suggestion.allergens
    );

    if (checkResult.hasContradiction) {
      contradictionFailures++;
      console.error(
        `CONTRADICTION [Dish #${item.id}]: "${item.dish}" produced contradictions:`,
        checkResult.blockingReasons
      );
    }
    assert.equal(
      checkResult.hasContradiction,
      false,
      `Dish #${item.id} produced contradictory suggestion tags: ${checkResult.blockingReasons.join("; ")}`
    );
  }

  assert.equal(falseNegatives, 0, "Severe allergen false negatives MUST be 0");
  assert.equal(contradictionFailures, 0, "Contradiction failures MUST be 0");
});
