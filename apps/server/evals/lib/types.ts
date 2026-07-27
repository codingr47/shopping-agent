export interface EvaluationOutput {
  finalResponse: string;
  journey: string[];
  selectedIntent: string | undefined;
  toolCalls: Array<{ name: string; args: unknown }>;
  latencyMs: number;
}

export interface EvalExample {
  inputs: { prompt: string };
  referenceOutputs: {
    expectedJourney: string[];
    expectedFinalIntent: string | undefined;
    requiredTools?: string[];
    forbiddenTools?: string[];
    forbiddenSteps?: string[];
  };
}
