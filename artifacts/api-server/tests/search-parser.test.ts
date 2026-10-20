import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import { resolveMumbaiArea } from "../src/lib/mumbai-areas";
import {
  buildSafeFallback,
  checkRateLimit,
  heuristicExtract,
  parseWithLLM,
} from "../src/lib/llm-search-parser";
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
});
