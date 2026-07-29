import { EvaluationOutput, EvalExample } from "../lib/types.js";

interface CollectedRow {
  inputs: { prompt: string };
  outputs: EvaluationOutput;
}

export interface PerPromptMetrics {
  prompt: string;
  runs: number;
  modalJourneyConsistency: number;
  modalJourney: string[];
}

export interface ReliabilitySummary {
  perPrompt: PerPromptMetrics[];
  meanModalConsistency: number;
  minModalConsistency: number;
  unstablePrompts: string[];
  p95Latency: number;
}

function mode(arr: string[]): string {
  if (arr.length === 0) return "";
  const counts = new Map<string, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  let maxItem = arr[0];
  let maxCount = 0;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }
  return maxItem;
}

export function computeReliability(
  rows: CollectedRow[],
): ReliabilitySummary {
  const grouped = new Map<string, CollectedRow[]>();

  for (const row of rows) {
    const key = row.inputs.prompt;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  }

  const perPrompt: PerPromptMetrics[] = [];
  let allLatencies: number[] = [];

  for (const [prompt, groupRows] of grouped) {
    const journeys = groupRows.map(row => JSON.stringify(row.outputs.journey));
    const modalJourney = JSON.parse(mode(journeys));
    const consistency = journeys.filter(j => j === mode(journeys)).length / journeys.length;

    perPrompt.push({
      prompt,
      runs: groupRows.length,
      modalJourneyConsistency: consistency,
      modalJourney,
    });

    allLatencies.push(...groupRows.map(row => row.outputs.latencyMs));
  }

  const meanConsistency = perPrompt.length > 0 ? perPrompt.reduce((sum, p) => sum + p.modalJourneyConsistency, 0) / perPrompt.length : 0;
  const minConsistency = perPrompt.length > 0 ? Math.min(...perPrompt.map(p => p.modalJourneyConsistency)) : 0;
  const unstablePrompts = perPrompt.filter(p => p.modalJourneyConsistency < 0.8).map(p => p.prompt);

  // Calculate p95 latency
  const sortedLatencies = allLatencies.sort((a, b) => a - b);
  const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
  const p95Latency = sortedLatencies[Math.max(0, p95Index)] || 0;

  return {
    perPrompt,
    meanModalConsistency: meanConsistency,
    minModalConsistency: minConsistency,
    unstablePrompts,
    p95Latency,
  };
}

export const reliabilitySummaryEvaluator = {
  key: "reliability_summary",
  scorer: (data: { inputs: EvalExample["inputs"][]; outputs: EvaluationOutput[] }) => {
    const { inputs, outputs } = data;
    const rows: CollectedRow[] = inputs.map((inp, i: number) => ({
      inputs: inp,
      outputs: outputs[i],
    }));

    const reliability = computeReliability(rows);

    return [
      {
        key: "reliability_mean_modal_consistency",
        score: reliability.meanModalConsistency,
      },
      {
        key: "reliability_min_modal_consistency",
        score: reliability.minModalConsistency,
      },
      {
        key: "reliability_unstable_prompts_count",
        score: reliability.unstablePrompts.length,
      },
      {
        key: "reliability_p95_latency_ms",
        score: reliability.p95Latency,
      },
    ];
  },
};

export const p95LatencySummaryEvaluator = {
  key: "p95_latency",
  scorer: (data: { outputs: EvaluationOutput[] }) => {
    const { outputs } = data;
    const latencies = outputs.map((out) => out.latencyMs);
    const sortedLatencies = latencies.sort((a: number, b: number) => a - b);
    const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
    const p95Latency = sortedLatencies[Math.max(0, p95Index)] || 0;

    return {
      key: "p95_latency",
      score: p95Latency,
    };
  },
};
