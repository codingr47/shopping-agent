import { describe, it, expect, afterAll } from "vitest";
import { runEvalTurn } from "./lib/runEvalTurn.js";
import { EvaluationOutput, EvalExample, RunResult, EvaluatorResult } from "./lib/types.js";
import fs from "fs";
import path from "path";
import { getFilteredExamples } from "./lib/filterExamples.js";
import { journeyPassEvaluator, intentAccuracyEvaluator, completionEvaluator, forbiddenStepEvaluator } from "./evaluators/journey.js";
import {
  toolSelectionAccuracyEvaluator,
  unnecessaryToolCallEvaluator,
  forbiddenToolCallEvaluator,
  invalidToolArgumentEvaluator,
  toolArgumentMatchEvaluator,
} from "./evaluators/toolMetrics.js";
import { trajectoryMatchEvaluator } from "./evaluators/trajectory.js";
import { computeReliability } from "./evaluators/reliability.js";
import { generateHtmlReport } from "./report/generateReport.js";

const EVAL_REPETITIONS = 1;

interface CollectedRow {
  inputs: { prompt: string };
  outputs: EvaluationOutput;
}

const evaluators = [
  journeyPassEvaluator,
  intentAccuracyEvaluator,
  completionEvaluator,
  forbiddenStepEvaluator,
  toolSelectionAccuracyEvaluator,
  unnecessaryToolCallEvaluator,
  forbiddenToolCallEvaluator,
  invalidToolArgumentEvaluator,
  toolArgumentMatchEvaluator,
  trajectoryMatchEvaluator,
];

describe("shopping agent journeys", () => {
  const collected: CollectedRow[] = [];
  const runResults: RunResult[] = [];
  let reliabilitySnapshot: ReturnType<typeof computeReliability> | undefined;

  it(
    "passes journey/intent/tool checks and meets reliability thresholds",
    async () => {
      const numRepetitions = EVAL_REPETITIONS;
      const examples = getFilteredExamples();

      // Run each example numRepetitions times
      for (const example of examples) {
        for (let rep = 0; rep < numRepetitions; rep++) {
          const outputs = await runEvalTurn(example.inputs.prompt);
          collected.push({ inputs: example.inputs, outputs });

          const evaluatorResults: EvaluatorResult[] = [];

          // Run evaluators
          for (const evaluator of evaluators) {
            const result = evaluator.scorer({
              outputs,
              referenceOutputs: example.referenceOutputs,
            });
            evaluatorResults.push({
              evaluatorKey: evaluator.key,
              score: result.score,
              comment: result.comment,
            });
            if (result.score < 1) {
              console.warn(
                `❌ ${evaluator.key} failed for "${example.inputs.prompt.substring(0, 30)}...": ${result.comment}`,
              );
            }
          }

          runResults.push({
            name: example.name,
            prompt: example.inputs.prompt,
            repetition: rep,
            journey: outputs.journey,
            selectedIntent: outputs.selectedIntent,
            toolCalls: outputs.toolCalls,
            latencyMs: outputs.latencyMs,
            evaluatorResults,
            passed: evaluatorResults.every(r => r.score === 1),
          });
        }
      }

      const reliability = computeReliability(collected);
      reliabilitySnapshot = reliability;

      // Assertions
      expect(reliability.unstablePrompts, "Should have no unstable prompts").toEqual([]);
      expect(reliability.minModalConsistency, "Min consistency should be >= 0.8").toBeGreaterThanOrEqual(0.8);
      expect(reliability.meanModalConsistency, "Mean consistency should be > 0.7").toBeGreaterThan(0.7);

      console.log("\n✅ Reliability Summary:");
      console.log(`   Mean Modal Consistency: ${(reliability.meanModalConsistency * 100).toFixed(1)}%`);
      console.log(`   Min Modal Consistency: ${(reliability.minModalConsistency * 100).toFixed(1)}%`);
      console.log(`   P95 Latency: ${reliability.p95Latency}ms`);
      console.log(`   Unstable Prompts: ${reliability.unstablePrompts.length}`);

      for (const metric of reliability.perPrompt) {
        console.log(
          `   - "${metric.prompt.substring(0, 40)}..." (${metric.runs} runs): ${(metric.modalJourneyConsistency * 100).toFixed(0)}% consistent`,
        );
      }
    },
    300_000,
  );

  afterAll(() => {
    if (runResults.length === 0 || !reliabilitySnapshot) return;
    const html = generateHtmlReport(runResults, reliabilitySnapshot);
    const outDir = path.resolve(__dirname, "report-output");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `report_${Date.now()}.html`), html, "utf-8");
    console.log(`\n📊 Eval report written to ${path.join(outDir, "report.html")}`);
  });
});
