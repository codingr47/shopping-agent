import { EvaluationOutput, EvalExample } from "../lib/types.js";
import { deepEqual } from "../lib/deepEqual.js";

export const journeyPassEvaluator = {
  key: "journey_pass",
  scorer: ({ outputs, referenceOutputs }: { outputs: EvaluationOutput; referenceOutputs: EvalExample["referenceOutputs"] }) => {
    const score = deepEqual(outputs.journey, referenceOutputs.expectedJourney) ? 1 : 0;
    return {
      key: "journey_pass",
      score,
      comment: `Expected: ${JSON.stringify(referenceOutputs.expectedJourney)}, Got: ${JSON.stringify(outputs.journey)}`,
    };
  },
};

export const intentAccuracyEvaluator = {
  key: "intent_accuracy",
  scorer: ({ outputs, referenceOutputs }: { outputs: EvaluationOutput; referenceOutputs: EvalExample["referenceOutputs"] }) => {
    const score = outputs.selectedIntent === referenceOutputs.expectedFinalIntent ? 1 : 0;
    return {
      key: "intent_accuracy",
      score,
      comment: `Expected: ${referenceOutputs.expectedFinalIntent}, Got: ${outputs.selectedIntent}`,
    };
  },
};

export const completionEvaluator = {
  key: "completion",
  scorer: ({ outputs, referenceOutputs }: { outputs: EvaluationOutput; referenceOutputs: EvalExample["referenceOutputs"] }) => {
    const hasResponse = outputs.finalResponse.length > 0;
    const endsWithRespond =
      outputs.journey.length > 0 &&
      (outputs.journey[outputs.journey.length - 1] === "respond" ||
        outputs.journey[outputs.journey.length - 1] === "respond_off_topic");
    const score = hasResponse && endsWithRespond ? 1 : 0;
    return {
      key: "completion",
      score,
      comment: `Response length: ${outputs.finalResponse.length}, ends with respond: ${endsWithRespond}`,
    };
  },
};

export const forbiddenStepEvaluator = {
  key: "forbidden_step_clean",
  scorer: ({
    outputs,
    referenceOutputs,
  }: {
    outputs: EvaluationOutput;
    referenceOutputs: EvalExample["referenceOutputs"];
  }) => {
    const forbiddenSteps = referenceOutputs.forbiddenSteps || [];
    const forbiddenTools = referenceOutputs.forbiddenTools || [];

    let violatedSteps: string[] = [];
    for (const step of forbiddenSteps) {
      if (outputs.journey.includes(step)) {
        violatedSteps.push(step);
      }
    }

    let violatedTools: string[] = [];
    const calledToolNames = outputs.toolCalls.map(tc => tc.name);
    for (const tool of forbiddenTools) {
      if (calledToolNames.includes(tool)) {
        violatedTools.push(tool);
      }
    }

    const score = violatedSteps.length === 0 && violatedTools.length === 0 ? 1 : 0;
    const violations = [...violatedSteps, ...violatedTools];
    return {
      key: "forbidden_step_clean",
      score,
      comment: violations.length > 0 ? `Violations: ${violations.join(", ")}` : "No violations",
    };
  },
};
