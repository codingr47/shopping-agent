import { describe, it, expect } from "vitest";
import { runEvalTurn } from "./lib/runEvalTurn.js";
import { EvaluationOutput, EvalExample } from "./lib/types.js";
import { shoppingJourneys } from "./datasets/shoppingJourneys.js";
import { journeyPassEvaluator, intentAccuracyEvaluator, completionEvaluator, forbiddenStepEvaluator } from "./evaluators/journey.js";
import {
  toolSelectionAccuracyEvaluator,
  unnecessaryToolCallEvaluator,
  forbiddenToolCallEvaluator,
  invalidToolArgumentEvaluator,
} from "./evaluators/toolMetrics.js";
import { trajectoryMatchEvaluator } from "./evaluators/trajectory.js";
import { computeReliability } from "./evaluators/reliability.js";

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
  trajectoryMatchEvaluator,
];

describe("shopping agent journeys", () => {
  it(
    "passes journey/intent/tool checks and meets reliability thresholds",
    async () => {
      const collected: CollectedRow[] = [];
      const numRepetitions = 2;

      // Run each example numRepetitions times
      for (const example of shoppingJourneys) {
        for (let rep = 0; rep < numRepetitions; rep++) {
          const outputs = await runEvalTurn(example.inputs.prompt);
          collected.push({ inputs: example.inputs, outputs });

          // Run evaluators
          for (const evaluator of evaluators) {
            const result = evaluator.scorer({
              outputs,
              referenceOutputs: example.referenceOutputs,
            });
            if (result.score < 1) {
              console.warn(
                `❌ ${evaluator.key} failed for "${example.inputs.prompt.substring(0, 30)}...": ${result.comment}`,
              );
            }
          }
        }
      }

      const reliability = computeReliability(collected);

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
});
