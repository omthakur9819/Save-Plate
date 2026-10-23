import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import { resolveMumbaiArea } from "../src/lib/mumbai-areas";
import {
  buildSafeFallback,
  checkRateLimit,
  heuristicExtract,
  parseWithLLM,
} from "../src/lib/llm-search-parser";
import {
  checkChatRateLimit,
  chatWithAssistant,
  type ActiveListingSummary,
} from "../src/lib/llm-chat-assistant";
import { TEST_CASES } from "./search-test-cases";

describe("Natural Language Search Unit Tests", () => {
  describe("Mumbai Area Fuzzy Resolution", () => {
    it("resolves exact area names", () => {
      assert.equal(resolveMumbaiArea("Bandra")?.canonicalName, "Bandra");
      assert.equal(resolveMumbaiArea("BKC")?.canonicalName, "BKC");
      assert.equal(resolveMumbaiArea("Andheri")?.canonicalName, "Andheri");
      assert.equal(resolveMumbaiArea("Powai")?.canonicalName, "Powai");
      assert.equal(resolveMumbaiArea("Colaba")?.canonicalName, "Colaba");
      assert.equal(resolveMumbaiArea("Lower Parel")?.canonicalName, "Lower Parel");
      assert.equal(resolveMumbaiArea("Juhu")?.canonicalName, "Juhu");
      assert.equal(resolveMumbaiArea("Dadar")?.canonicalName, "Dadar");
      assert.equal(resolveMumbaiArea("Worli")?.canonicalName, "Worli");
      assert.equal(resolveMumbaiArea("Vashi")?.canonicalName, "Navi Mumbai/Vashi");
      assert.equal(resolveMumbaiArea("Panvel")?.canonicalName, "Panvel");
    });

    it("resolves area aliases and sub-localities", () => {
      assert.equal(resolveMumbaiArea("bandra west")?.canonicalName, "Bandra");
      assert.equal(resolveMumbaiArea("pali hill")?.canonicalName, "Bandra");
      assert.equal(resolveMumbaiArea("lokhandwala")?.canonicalName, "Andheri");
      assert.equal(resolveMumbaiArea("hiranandani")?.canonicalName, "Powai");
      assert.equal(resolveMumbaiArea("cuffe parade")?.canonicalName, "Colaba");
    });

    it("resolves typos and misspellings", () => {
      assert.equal(resolveMumbaiArea("bndra")?.canonicalName, "Bandra");
      assert.equal(resolveMumbaiArea("powey")?.canonicalName, "Powai");
      assert.equal(resolveMumbaiArea("colba")?.canonicalName, "Colaba");
      assert.equal(resolveMumbaiArea("juhu bech")?.canonicalName, "Juhu");
    });

    it("returns null for non-Mumbai or empty inputs", () => {
      assert.equal(resolveMumbaiArea(""), null);
      assert.equal(resolveMumbaiArea(null), null);
      assert.equal(resolveMumbaiArea("New York"), null);
    });
  });

  describe("Safe Fallback and Heuristics", () => {
    it("splits query into keywords on fallback", () => {
      const fb = buildSafeFallback("fresh bread sandwich");
      assert.deepEqual(fb.keywords, ["fresh", "bread", "sandwich"]);
      assert.deepEqual(fb.diet, []);
      assert.equal(fb.nearMe, false);
      assert.equal(fb.sortBy, "distance");
    });

    it("extracts dietary constraints correctly", () => {
      const resVeg = heuristicExtract("veg dinner in Bandra", "2026-10-20T18:00:00Z");
      assert.deepEqual(resVeg.diet, ["veg"]);

      const resVegan = heuristicExtract("vegan bakery", "2026-10-20T18:00:00Z");
      assert.deepEqual(resVegan.diet, ["vegan"]);

      const resEggless = heuristicExtract("eggless pastry", "2026-10-20T18:00:00Z");
      assert.deepEqual(resEggless.diet, ["egg_free"]);

      const resNutFree = heuristicExtract("nut free cookies", "2026-10-20T18:00:00Z");
      assert.deepEqual(resNutFree.diet, ["nut_free"]);
    });

    it("extracts price ceilings correctly", () => {
      assert.equal(heuristicExtract("under 150 rs", "2026-10-20T18:00:00Z").maxPrice, 150);
      assert.equal(heuristicExtract("below ₹200", "2026-10-20T18:00:00Z").maxPrice, 200);
      assert.equal(heuristicExtract("less than 99 rupees", "2026-10-20T18:00:00Z").maxPrice, 99);
    });

    it("identifies Hinglish vocabulary correctly", () => {
      const hinglish = heuristicExtract("sasta veg khana Andheri mein", "2026-10-20T18:00:00Z");
      assert.equal(hinglish.category, "meals");
      assert.deepEqual(hinglish.diet, ["veg"]);
      assert.equal(hinglish.sortBy, "price");
      assert.equal(hinglish.area, "Andheri");
    });
  });

  describe("Rate Limiting", () => {
    it("allows up to 30 requests per minute and throttles thereafter", () => {
      const testKey = `test-user-${Date.now()}`;
      for (let i = 0; i < 30; i++) {
        assert.equal(checkRateLimit(testKey), true);
      }
      // 31st request should be rejected
      assert.equal(checkRateLimit(testKey), false);
    });
  });

  describe("LLM Mocking and Error Resilience", () => {
    it("handles mock LLM responses via parseWithLLM", async () => {
      const originalFetch = globalThis.fetch;
      try {
        // Mock global fetch to simulate Gemini JSON response
        globalThis.fetch = async () => {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          keywords: ["dinner"],
                          category: "meals",
                          diet: ["veg"],
                          maxPrice: 150,
                          area: "Bandra",
                          nearMe: false,
                          sortBy: "distance",
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        };

        const oldApiKey = process.env.LLM_API_KEY;
        process.env.LLM_API_KEY = "mock-key";

        const result = await parseWithLLM({
          query: "veg dinner under 150 near Bandra",
          now: "2026-10-20T18:00:00+05:30",
          timezone: "Asia/Kolkata",
        });

        assert.equal(result.category, "meals");
        assert.deepEqual(result.diet, ["veg"]);
        assert.equal(result.maxPrice, 150);
        assert.equal(result.area, "Bandra");

        process.env.LLM_API_KEY = oldApiKey;
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("falls back gracefully on mock LLM timeout or error", async () => {
      const originalFetch = globalThis.fetch;
      try {
        // Mock error response
        globalThis.fetch = async () => {
          throw new Error("Connection timeout");
        };

        const oldApiKey = process.env.LLM_API_KEY;
        process.env.LLM_API_KEY = "mock-key";

        const fallback = await parseWithLLM({
          query: "random query with no crash",
          now: "2026-10-20T18:00:00+05:30",
          timezone: "Asia/Kolkata",
        });

        assert.ok(fallback);
        assert.ok(Array.isArray(fallback.keywords));
        assert.equal(fallback.sortBy, "distance");

        process.env.LLM_API_KEY = oldApiKey;
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("27 Query Evaluation Suite", () => {
    it(`evaluates all ${TEST_CASES.length} test queries without throwing`, () => {
      for (const tc of TEST_CASES) {
        const extracted = heuristicExtract(tc.query, "2026-10-20T18:00:00+05:30");
        assert.ok(extracted, `Query ${tc.id} failed to extract`);

        if (tc.expected.category) {
          assert.equal(
            extracted.category,
            tc.expected.category,
            `Query #${tc.id} ("${tc.query}") expected category ${tc.expected.category}`,
          );
        }
        if (tc.expected.diet && tc.expected.diet.length > 0) {
          assert.ok(
            tc.expected.diet.some((d) => extracted.diet?.includes(d)),
            `Query #${tc.id} ("${tc.query}") expected diet ${tc.expected.diet}`,
          );
        }
        if (tc.expected.maxPrice) {
          assert.equal(
            extracted.maxPrice,
            tc.expected.maxPrice,
            `Query #${tc.id} ("${tc.query}") expected maxPrice ${tc.expected.maxPrice}`,
          );
        }
        if (tc.expected.sortBy) {
          assert.equal(
            extracted.sortBy,
            tc.expected.sortBy,
            `Query #${tc.id} ("${tc.query}") expected sortBy ${tc.expected.sortBy}`,
          );
        }
      }
    });
  });

  describe("Enhanced Search Heuristics (Feature B)", () => {
    it("extracts INR ₹ symbol prices correctly", () => {
      const res = heuristicExtract("₹175 dinner box", "2026-10-20T18:00:00Z");
      assert.equal(res.maxPrice, 175);
    });

    it("extracts allergen exclusions properly", () => {
      const dairyFree = heuristicExtract("no dairy snack", "2026-10-20T18:00:00Z");
      assert.ok(dairyFree.excludeAllergens?.includes("milk"));

      const nutFree = heuristicExtract("nut free cake without peanuts", "2026-10-20T18:00:00Z");
      assert.ok(nutFree.excludeAllergens?.includes("peanuts"));
      assert.ok(nutFree.excludeAllergens?.includes("tree_nuts"));

      const eggless = heuristicExtract("eggless pastry", "2026-10-20T18:00:00Z");
      assert.ok(eggless.excludeAllergens?.includes("egg"));
      assert.ok(eggless.diet?.includes("egg_free"));
    });

    it("extracts min discount percentage correctly", () => {
      const res = heuristicExtract("50% off or more bakery deals", "2026-10-20T18:00:00Z");
      assert.equal(res.minDiscountPercent, 50);
    });

    it("detects multi-area search correctly", () => {
      const multi = heuristicExtract("dinner in Bandra ya BKC", "2026-10-20T18:00:00Z");
      assert.ok(multi.areas?.includes("Bandra"));
      assert.ok(multi.areas?.includes("BKC"));
      assert.equal(multi.area, "Bandra");
    });

    it("detects popular sorting", () => {
      const popular = heuristicExtract("most rescued food in Powai", "2026-10-20T18:00:00Z");
      assert.equal(popular.sortBy, "popular");
    });

    it("does not tag non-veg queries as vegetarian", () => {
      const nonVegRes = heuristicExtract("non-veg dinner in Bandra", "2026-10-20T18:00:00Z");
      assert.ok(!nonVegRes.diet?.includes("veg"), "Should not contain 'veg' diet tag for non-veg query");
      assert.equal(nonVegRes.area, "Bandra");
    });

    it("detects Hinglish terms: nashta, meetha, kadak chai, tikha", () => {
      const chai = heuristicExtract("kadak chai and nashta", "2026-10-20T18:00:00Z");
      assert.equal(chai.category, "cafe");
      assert.ok(chai.keywords?.includes("tea") || chai.keywords?.includes("chai"));

      const sweet = heuristicExtract("meetha khana", "2026-10-20T18:00:00Z");
      assert.ok(sweet.keywords?.includes("dessert") || sweet.keywords?.includes("sweets"));
    });
  });

  describe("AI Rescue Chat Assistant (Feature A)", () => {
    const mockListings: ActiveListingSummary[] = [
      {
        id: "list-1",
        name: "Butter Croissant Box",
        vendor: "Subko Coffee",
        category: "bakery",
        price: 99,
        originalPrice: 280,
        area: "Bandra",
        pickupWindow: "6:00 PM – 8:30 PM",
        quantity: 3,
        dietaryTags: ["veg"],
        allergens: ["gluten", "milk"],
        description: "Freshly baked morning croissants",
      },
      {
        id: "list-2",
        name: "Veg Biryani Meal Box",
        vendor: "Bombay Canteen",
        category: "meals",
        price: 150,
        originalPrice: 420,
        area: "Lower Parel",
        pickupWindow: "7:00 PM – 9:00 PM",
        quantity: 2,
        dietaryTags: ["veg"],
        allergens: ["dairy"],
        description: "Fragrant spiced dum biryani",
      },
    ];

    it("enforces rate limit of 20 requests per minute", () => {
      const chatKey = `chat-rate-test-${Date.now()}`;
      for (let i = 0; i < 20; i++) {
        assert.equal(checkChatRateLimit(chatKey), true);
      }
      assert.equal(checkChatRateLimit(chatKey), false);
    });

    it("returns friendly fallback response when no LLM key is configured", async () => {
      const oldApiKey = process.env.LLM_API_KEY;
      const oldGeminiKey = process.env.GEMINI_API_KEY;
      delete process.env.LLM_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        const res = await chatWithAssistant({
          messages: [{ role: "user", content: "Any bakery croissant deals?" }],
          listings: mockListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
          userArea: "Bandra",
        });

        assert.ok(res.reply);
        assert.ok(res.listingIds.includes("list-1"));
        assert.equal(res.intent, "search");
      } finally {
        process.env.LLM_API_KEY = oldApiKey;
        process.env.GEMINI_API_KEY = oldGeminiKey;
      }
    });

    it("processes mocked LLM chat completions and filters invalid IDs", async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async () => {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          reply: "Subko Coffee in Bandra has fresh croissants for just ₹99!",
                          listingIds: ["list-1", "hallucinated-id-999"],
                          intent: "search",
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        };

        const oldApiKey = process.env.LLM_API_KEY;
        process.env.LLM_API_KEY = "mock-key";

        const res = await chatWithAssistant({
          messages: [{ role: "user", content: "croissant in Bandra" }],
          listings: mockListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
          userArea: "Bandra",
        });

        assert.equal(res.reply, "Subko Coffee in Bandra has fresh croissants for just ₹99!");
        // The hallucinated ID should be pruned
        assert.deepEqual(res.listingIds, ["list-1"]);
        assert.equal(res.intent, "search");

        process.env.LLM_API_KEY = oldApiKey;
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("strictly respects budget ceilings and never returns items above user limit", async () => {
      const oldApiKey = process.env.LLM_API_KEY;
      const oldGeminiKey = process.env.GEMINI_API_KEY;
      delete process.env.LLM_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const testListings: ActiveListingSummary[] = [
        {
          id: "subko-cruffin",
          name: "Coorg Cardamom Sourdough Cruffin",
          vendor: "Subko Specialty Coffee & Bakehouse",
          category: "bakery",
          price: 99,
          originalPrice: 220,
          area: "Bandra West",
          pickupWindow: "5:00-7:00 PM",
          quantity: 2,
          dietaryTags: ["veg"],
          allergens: [],
          description: "Fresh cruffin",
        },
        {
          id: "bbr-surprise-bag",
          name: "Surprise bakery bag",
          vendor: "Bandra Bread Room",
          category: "bakery",
          price: 149,
          originalPrice: 399,
          area: "Bandra West",
          pickupWindow: "5:30-6:30 PM",
          quantity: 4,
          dietaryTags: ["veg"],
          allergens: [],
          description: "Extra sourdough & croissants",
        },
        {
          id: "bbr-pastry-box",
          name: "Assorted pastry box",
          vendor: "Bandra Bread Room",
          category: "bakery",
          price: 199,
          originalPrice: 549,
          area: "Bandra West",
          pickupWindow: "6:00-7:00 PM",
          quantity: 2,
          dietaryTags: ["veg"],
          allergens: [],
          description: "Assorted tarts & eclairs",
        },
      ];

      try {
        const res = await chatWithAssistant({
          messages: [{ role: "user", content: "🥐 Bakery under ₹100" }],
          listings: testListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
          userArea: "Bandra West",
        });

        // MUST only return the 99 Rs cruffin, NEVER the 149 or 199 Rs items
        assert.deepEqual(res.listingIds, ["subko-cruffin"]);
        assert.ok(res.reply.includes("Coorg Cardamom Sourdough Cruffin"));
        assert.ok(!res.reply.includes("Surprise bakery bag"));
        assert.ok(!res.reply.includes("149"));

        // Test with "bakery under 100rs"
        const res2 = await chatWithAssistant({
          messages: [{ role: "user", content: "bakery under 100rs" }],
          listings: testListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
          userArea: "Bandra West",
        });

        assert.deepEqual(res2.listingIds, ["subko-cruffin"]);

        // Test with budget lower than any item (e.g. ₹50)
        const res3 = await chatWithAssistant({
          messages: [{ role: "user", content: "bakery under ₹50" }],
          listings: testListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
          userArea: "Bandra West",
        });

        assert.ok(res3.reply.includes("No bakery items available under ₹50"));
        assert.ok(res3.reply.includes("₹99"));
      } finally {
        process.env.LLM_API_KEY = oldApiKey;
        process.env.GEMINI_API_KEY = oldGeminiKey;
      }
    });

    it("strictly separates veg from non-veg requests and never returns veg dishes for non-veg", async () => {
      const oldApiKey = process.env.LLM_API_KEY;
      const oldGeminiKey = process.env.GEMINI_API_KEY;
      delete process.env.LLM_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const mixedListings: ActiveListingSummary[] = [
        {
          id: "dc-veg-tiffin",
          name: "Tonight's veg tiffin",
          vendor: "Dabba & Co.",
          category: "meals",
          price: 189,
          originalPrice: 480,
          area: "Bandra West",
          pickupWindow: "6:30-7:30 PM",
          quantity: 2,
          dietaryTags: ["veg"],
          allergens: [],
          description: "Paneer butter masala, dal, rice, phulkas",
        },
        {
          id: "dc-biryani-box",
          name: "Dum Hyderabadi Veg Biryani Box",
          vendor: "Dabba & Co.",
          category: "meals",
          price: 199,
          originalPrice: 499,
          area: "Bandra West",
          pickupWindow: "7:00-8:00 PM",
          quantity: 3,
          dietaryTags: ["veg"],
          allergens: [],
          description: "Marinated vegetables with saffron basmati rice",
        },
        {
          id: "kyani-mutton-kheema",
          name: "Spiced Mutton Kheema Pao Box",
          vendor: "Kyani & Co. Irani Cafe",
          category: "meals",
          price: 99,
          originalPrice: 240,
          area: "Marine Drive",
          pickupWindow: "5:00-6:30 PM",
          quantity: 4,
          dietaryTags: [],
          allergens: [],
          description: "Slow-braised spiced minced mutton with ladi pavs",
        },
        {
          id: "theo-chicken-puff",
          name: "Chicken & Jalapeño Cheese Puff Trio",
          vendor: "Theobroma Colaba",
          category: "cafe",
          price: 135,
          originalPrice: 350,
          area: "Colaba",
          pickupWindow: "4:30-6:00 PM",
          quantity: 3,
          dietaryTags: [],
          allergens: [],
          description: "Flaky puff pastry stuffed with spiced roast chicken and cheddar",
        },
      ];

      try {
        // 1. User asks for "Non-veg"
        const nonVegRes = await chatWithAssistant({
          messages: [{ role: "user", content: "Non-veg" }],
          listings: mixedListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
          userArea: "Bandra West",
        });

        // MUST contain non-veg dishes, NEVER veg tiffin or veg biryani
        assert.ok(!nonVegRes.listingIds.includes("dc-veg-tiffin"), "Must NOT include veg tiffin");
        assert.ok(!nonVegRes.listingIds.includes("dc-biryani-box"), "Must NOT include veg biryani");
        assert.ok(
          nonVegRes.listingIds.includes("kyani-mutton-kheema") ||
            nonVegRes.listingIds.includes("theo-chicken-puff"),
          "Must include non-veg dishes",
        );
        assert.ok(!nonVegRes.reply.includes("veg tiffin"));

        // 2. User asks for "chicken"
        const chickenRes = await chatWithAssistant({
          messages: [{ role: "user", content: "chicken dishes" }],
          listings: mixedListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
        });

        assert.deepEqual(chickenRes.listingIds, ["theo-chicken-puff"]);

        // 3. User asks for "veg food"
        const vegRes = await chatWithAssistant({
          messages: [{ role: "user", content: "pure veg food" }],
          listings: mixedListings,
          now: "2026-10-20T18:00:00Z",
          timezone: "Asia/Kolkata",
        });

        assert.ok(!vegRes.listingIds.includes("kyani-mutton-kheema"), "Must NOT include mutton kheema");
        assert.ok(!vegRes.listingIds.includes("theo-chicken-puff"), "Must NOT include chicken puff");
        assert.ok(vegRes.listingIds.includes("dc-veg-tiffin") || vegRes.listingIds.includes("dc-biryani-box"));
      } finally {
        process.env.LLM_API_KEY = oldApiKey;
        process.env.GEMINI_API_KEY = oldGeminiKey;
      }
    });
  });
});
