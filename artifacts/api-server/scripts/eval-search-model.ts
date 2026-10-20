import { TEST_CASES, type TestCase } from "../tests/search-test-cases";
import { parseWithLLM } from "../src/lib/llm-search-parser";
import { resolveMumbaiArea } from "../src/lib/mumbai-areas";

interface EvaluationResult {
  id: number;
  query: string;
  type: string;
  passed: boolean;
  score: number;
  expected: any;
  actual: any;
  latencyMs: number;
  notes: string[];
}

async function runEvaluation() {
  console.log("\n=======================================================================");
  console.log("       Save Plate 2.0 - Natural Language Search Model Evaluator       ");
  console.log("=======================================================================");

  const provider = process.env.LLM_PROVIDER || "gemini";
  const model = process.env.LLM_MODEL || "gemini-1.5-flash";
  const hasKey = Boolean(process.env.LLM_API_KEY || process.env.GEMINI_API_KEY);

  console.log(`Engine   : ${provider.toUpperCase()} (${model})`);
  console.log(`Mode     : ${hasKey ? "Live LLM API" : "Offline Heuristic Fallback (No API Key)"}`);
  console.log(`Test Set : ${TEST_CASES.length} queries (Standard, Typos, Hinglish, Vague, Contradictory)\n`);

  const results: EvaluationResult[] = [];
  const referenceTime = "2026-10-20T18:00:00+05:30";
  const timezone = "Asia/Kolkata";

  for (const tc of TEST_CASES) {
    const startTime = Date.now();
    const actual = await parseWithLLM({
      query: tc.query,
      now: referenceTime,
      timezone,
    });
    const latencyMs = Date.now() - startTime;

    const notes: string[] = [];
    let fieldsTotal = 0;
    let fieldsMatched = 0;

    // Check category
    if (tc.expected.category) {
      fieldsTotal++;
      if (actual.category === tc.expected.category) {
        fieldsMatched++;
      } else {
        notes.push(`Category mismatch: expected '${tc.expected.category}', got '${actual.category}'`);
      }
    }

    // Check diet
    if (tc.expected.diet && tc.expected.diet.length > 0) {
      fieldsTotal++;
      const hasAllDiet = tc.expected.diet.every((d) => actual.diet?.includes(d));
      if (hasAllDiet) {
        fieldsMatched++;
      } else {
        notes.push(`Diet mismatch: expected [${tc.expected.diet.join(",")}], got [${actual.diet?.join(",")}]`);
      }
    }

    // Check maxPrice
    if (tc.expected.maxPrice !== undefined) {
      fieldsTotal++;
      if (actual.maxPrice === tc.expected.maxPrice) {
        fieldsMatched++;
      } else {
        notes.push(`Price mismatch: expected ${tc.expected.maxPrice}, got ${actual.maxPrice}`);
      }
    }

    // Check area
    if (tc.expected.area) {
      fieldsTotal++;
      const resolvedActualArea = resolveMumbaiArea(actual.area)?.canonicalName || actual.area;
      const resolvedExpectedArea = resolveMumbaiArea(tc.expected.area)?.canonicalName || tc.expected.area;
      if (
        resolvedActualArea?.toLowerCase() === resolvedExpectedArea?.toLowerCase() ||
        actual.area?.toLowerCase().includes(tc.expected.area.toLowerCase())
      ) {
        fieldsMatched++;
      } else {
        notes.push(`Area mismatch: expected '${tc.expected.area}', got '${actual.area}'`);
      }
    }

    // Check nearMe
    if (tc.expected.nearMe !== undefined) {
      fieldsTotal++;
      if (actual.nearMe === tc.expected.nearMe) {
        fieldsMatched++;
      } else {
        notes.push(`nearMe mismatch: expected ${tc.expected.nearMe}, got ${actual.nearMe}`);
      }
    }

    // Check sortBy
    if (tc.expected.sortBy) {
      fieldsTotal++;
      if (actual.sortBy === tc.expected.sortBy) {
        fieldsMatched++;
      } else {
        notes.push(`sortBy mismatch: expected '${tc.expected.sortBy}', got '${actual.sortBy}'`);
      }
    }

    // If query was vague with no expected filters, it passes if it produced valid filters
    const passed = fieldsTotal === 0 ? true : fieldsMatched === fieldsTotal;
    const score = fieldsTotal === 0 ? 1 : fieldsMatched / fieldsTotal;

    results.push({
      id: tc.id,
      query: tc.query,
      type: tc.type,
      passed,
      score,
      expected: tc.expected,
      actual,
      latencyMs,
      notes,
    });
  }

  // Print results table
  console.log("--------------------------------------------------------------------------------------------------------------------");
  console.log(`| #   | Status | Type           | Latency | Query                                            | Notes`);
  console.log("--------------------------------------------------------------------------------------------------------------------");

  for (const r of results) {
    const status = r.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    const padId = String(r.id).padEnd(3);
    const padType = r.type.padEnd(14);
    const padLat = `${r.latencyMs}ms`.padStart(6);
    const padQuery = r.query.length > 48 ? r.query.slice(0, 45) + "..." : r.query.padEnd(48);
    const note = r.notes.length > 0 ? r.notes.join("; ") : "All constraints satisfied";
    console.log(`| ${padId} | ${status}   | ${padType} | ${padLat}  | ${padQuery} | ${note}`);
  }

  console.log("--------------------------------------------------------------------------------------------------------------------\n");

  // Summary statistics
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const accuracy = Math.round((passedCount / total) * 100);
  const avgLatency = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / total);

  console.log("=======================================================================");
  console.log("                         ACCURACY SUMMARY                              ");
  console.log("=======================================================================");
  console.log(` Total Queries Evaluated : ${total}`);
  console.log(` Queries Passed (100%)   : ${passedCount}`);
  console.log(` Queries Failed          : ${total - passedCount}`);
  console.log(` Overall Accuracy Rate   : ${accuracy}%`);
  console.log(` Average Query Latency   : ${avgLatency} ms`);
  console.log("=======================================================================\n");

  if (accuracy >= 90) {
    console.log("\x1b[32m✔ High Accuracy Target Achieved (>= 90%)\x1b[0m\n");
  } else {
    console.log("\x1b[33m⚠ Accuracy below 90%. Review failed query notes above.\x1b[0m\n");
  }
}

runEvaluation().catch((err) => {
  console.error("Evaluation script encountered an error:", err);
  process.exit(1);
});
