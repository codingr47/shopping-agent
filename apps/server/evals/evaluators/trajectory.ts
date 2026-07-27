import { createTrajectoryMatchEvaluator } from "agentevals";
import { EvaluationOutput, EvalExample } from "../lib/types.js";

// Convert EvaluationOutput to FlexibleChatCompletionMessage format for AgentEvals
function toTrajectoryFormat(toolCalls: Array<{ name: string; args: unknown }>) {
  return toolCalls.map(tc => ({
    role: "assistant" as const,
    tool_calls: [
      {
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      },
    ],
  }));
}

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

    try {
      const predicatedTrajectory = toTrajectoryFormat(outputs.toolCalls);
      const expectedToolNames = requiredTools;
      const calledNames = outputs.toolCalls.map(tc => tc.name);

      // Check if all expected tools were called in any order
      const allCalled = expectedToolNames.every(tool => calledNames.includes(tool));
      const score = allCalled ? 1 : 0;

      return {
        key: "trajectory_match",
        score,
        comment: `Expected tools: ${expectedToolNames.join(", ")}, called: ${calledNames.join(", ")}`,
      };
    } catch (error) {
      return {
        key: "trajectory_match",
        score: 0,
        comment: `Error evaluating trajectory: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};
