export interface EvaluationOutput {
  finalResponse: string;
  journey: string[];
  selectedIntent: string | undefined;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  latencyMs: number;
}

export interface EvalExample {
  name: string;
  inputs: { prompt: string };
  referenceOutputs: {
    expectedJourney: string[];
    expectedFinalIntent: string | undefined;
    requiredTools?: string[];
    forbiddenTools?: string[];
    forbiddenSteps?: string[];
    expectedToolArgs?: Array<{ tool: string; args: Record<string, unknown> }>;
  };
}

export interface EvaluatorResult {
  evaluatorKey: string;
  score: number;
  comment: string;
}

export interface RunResult {
  name: string;
  prompt: string;
  repetition: number;
  journey: string[];
  selectedIntent: string | undefined;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  latencyMs: number;
  evaluatorResults: EvaluatorResult[];
  passed: boolean;
}
