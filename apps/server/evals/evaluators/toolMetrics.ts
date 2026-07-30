import { z } from "zod";
import {
  searchProductsInput,
  listProductsInput,
  getProductByIdInput,
  listCategoriesInput,
  getProductsByCategoryInput,
} from "@shopping-agent/shared";
import { EvaluationOutput, EvalExample } from "../lib/types.js";
import { deepEqual } from "../lib/deepEqual.js";

const toolSchemas: Record<string, z.ZodTypeAny> = {
  search_products: searchProductsInput,
  list_products: listProductsInput,
  get_product_by_id: getProductByIdInput,
  list_categories: listCategoriesInput,
  get_products_by_category: getProductsByCategoryInput,
};

export const toolSelectionAccuracyEvaluator = {
  key: "tool_selection_accuracy",
  scorer: ({
    outputs,
    referenceOutputs,
  }: {
    outputs: EvaluationOutput;
    referenceOutputs: EvalExample["referenceOutputs"];
  }) => {
    const requiredTools = referenceOutputs.requiredTools || [];
    if (requiredTools.length === 0) {
      return { key: "tool_selection_accuracy", score: 1, comment: "No required tools" };
    }

    const calledNames = outputs.toolCalls.map(tc => tc.name);
    const allRequired = requiredTools.every(tool => calledNames.includes(tool));
    const score = allRequired ? 1 : 0;
    return {
      key: "tool_selection_accuracy",
      score,
      comment: `Required: ${requiredTools.join(", ")}, Called: ${calledNames.join(", ")}`,
    };
  },
};

export const unnecessaryToolCallEvaluator = {
  key: "unnecessary_tool_call_rate",
  scorer: ({
    outputs,
    referenceOutputs,
  }: {
    outputs: EvaluationOutput;
    referenceOutputs: EvalExample["referenceOutputs"];
  }) => {
    const requiredTools = referenceOutputs.requiredTools || [];
    if (outputs.toolCalls.length === 0) {
      return { key: "unnecessary_tool_call_rate", score: 1, comment: "No tool calls made" };
    }

    const unnecessary = outputs.toolCalls.filter(tc => !requiredTools.includes(tc.name));
    const rate = unnecessary.length / outputs.toolCalls.length;
    return {
      key: "unnecessary_tool_call_rate",
      score: 1 - rate,
      comment: `${unnecessary.length}/${outputs.toolCalls.length} calls were unnecessary`,
    };
  },
};

export const forbiddenToolCallEvaluator = {
  key: "forbidden_tool_call_rate",
  scorer: ({
    outputs,
    referenceOutputs,
  }: {
    outputs: EvaluationOutput;
    referenceOutputs: EvalExample["referenceOutputs"];
  }) => {
    const forbiddenTools = referenceOutputs.forbiddenTools || [];
    if (outputs.toolCalls.length === 0) {
      return { key: "forbidden_tool_call_rate", score: 1, comment: "No tool calls made" };
    }

    const forbidden = outputs.toolCalls.filter(tc => forbiddenTools.includes(tc.name));
    const rate = forbidden.length / outputs.toolCalls.length;
    return {
      key: "forbidden_tool_call_rate",
      score: 1 - rate,
      comment: `${forbidden.length}/${outputs.toolCalls.length} calls were forbidden`,
    };
  },
};

export const invalidToolArgumentEvaluator = {
  key: "invalid_tool_argument_rate",
  scorer: ({
    outputs,
  }: {
    outputs: EvaluationOutput;
  }) => {
    if (outputs.toolCalls.length === 0) {
      return { key: "invalid_tool_argument_rate", score: 1, comment: "No tool calls made" };
    }

    let invalid = 0;
    const issues: string[] = [];

    for (const toolCall of outputs.toolCalls) {
      const schema = toolSchemas[toolCall.name];
      if (!schema) {
        issues.push(`Unknown tool: ${toolCall.name}`);
        invalid++;
        continue;
      }

      const result = schema.safeParse(toolCall.args);
      if (!result.success) {
        issues.push(`${toolCall.name}: ${result.error.issues.map((i: z.ZodIssue) => i.message).join("; ")}`);
        invalid++;
      }
    }

    const rate = invalid / outputs.toolCalls.length;
    return {
      key: "invalid_tool_argument_rate",
      score: 1 - rate,
      comment: issues.length > 0 ? issues.slice(0, 3).join(" | ") : "All arguments valid",
    };
  },
};

export const toolArgumentMatchEvaluator = {
  key: "tool_argument_match",
  scorer: ({
    outputs,
    referenceOutputs,
  }: {
    outputs: EvaluationOutput;
    referenceOutputs: EvalExample["referenceOutputs"];
  }) => {
    const expectedToolArgs = referenceOutputs.expectedToolArgs || [];
    if (expectedToolArgs.length === 0) {
      return { key: "tool_argument_match", score: 1, comment: "No expected tool arguments to check" };
    }

    const failures: string[] = [];
    for (const expected of expectedToolArgs) {
      const candidates = outputs.toolCalls.filter(tc => tc.name === expected.tool);
      const matched = candidates.some(tc => deepEqual(expected.args, tc.args));
      if (!matched) {
        failures.push(
          candidates.length === 0
            ? `${expected.tool} was never called`
            : `${expected.tool} called but args didn't match ${JSON.stringify(expected.args)} (got ${candidates.map(c => JSON.stringify(c.args)).join(" | ")})`,
        );
      }
    }

    const score = (expectedToolArgs.length - failures.length) / expectedToolArgs.length;
    return {
      key: "tool_argument_match",
      score,
      comment: failures.length > 0 ? failures.join(" | ") : "All expected tool arguments matched",
    };
  },
};
