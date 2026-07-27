import { EvaluationOutput, EvalExample } from "../lib/types.js";

export const trajectoryMatchEvaluator = {
  key: "trajectory_match",
  scorer: ({
    outputs,
    referenceOutputs,
  }: {
    outputs: EvaluationOutput;
    referenceOutputs: EvalExample["referenceOutputs"];
  }) => {
    const requiredTools = referenceOutputs.requiredTools || [];
    if (requiredTools.length === 0) {
      return { key: "trajectory_match", score: 1, comment: "No trajectory to match" };
    }

    const calledNames = outputs.toolCalls.map(tc => tc.name);
    const allCalled = requiredTools.every(tool => calledNames.includes(tool));
    const score = allCalled ? 1 : 0;

    return {
      key: "trajectory_match",
      score,
      comment: `Expected tools: ${requiredTools.join(", ")}, called: ${calledNames.join(", ")}`,
    };
  },
};
