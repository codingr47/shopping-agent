import { EvalExample } from "./types.js";
import { allDatasetExamples } from "./loadDatasets.js";

function parseExamplesFilter(): string[] | null {
  const envValue = process.env.EVAL_EXAMPLES;
  if (!envValue) {
    return null;
  }
  return envValue.split(",").map(s => s.trim()).filter(Boolean);
}

export function getFilteredExamples(): EvalExample[] {
  const filter = parseExamplesFilter();
  if (!filter) {
    return allDatasetExamples;
  }
  const filterSet = new Set(filter);
  const filtered = allDatasetExamples.filter(ex => filterSet.has(ex.name));
  if (filtered.length === 0) {
    console.warn(`⚠️  No examples matched filter: ${filter.join(", ")}`);
    return allDatasetExamples;
  }
  console.log(`📋 Running ${filtered.length} filtered example(s): ${filtered.map(e => e.name).join(", ")}`);
  return filtered;
}
