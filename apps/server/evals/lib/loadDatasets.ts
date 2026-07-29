/// <reference types="vite/client" />
import { EvalExample } from "./types.js";

const datasetModules = import.meta.glob<Record<string, EvalExample[]>>(
  "../datasets/**/*.ts",
  { eager: true },
);

export const allDatasetExamples: EvalExample[] = Object.values(datasetModules).flatMap(
  moduleExports => Object.values(moduleExports).flat(),
);
