import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

const verdictSchema = z.object({
  verdict: z.enum(["in_scope", "out_of_scope"]),
  intent: z.enum(["search", "browse_category", "product_detail", "other"]),
  reasoning: z.string(),
  query: z.string().nullable(),
  category: z.string().nullable(),
  productId: z.number().int().nullable(),
  sortBy: z.enum(["title", "price", "rating"]).nullable(),
  order: z.enum(["asc", "desc"]).nullable(),
});

export class GuardrailIntentClassifierNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const lastMessage = state.messages[state.messages.length - 1];

    if (!lastMessage || lastMessage.getType() !== "human") {
      return {
        guardrailVerdict: "out_of_scope",
        intent: "other",
      };
    }

    const userQuery = lastMessage.content;

    const systemPrompt = `You are a shopping assistant intent classifier. Analyze the user's query and determine:
1. Is it in-scope (related to shopping/product discovery)?
2. What is the primary intent? (search, browse_category, product_detail, or other)
3. Extract relevant slots:
   - query: the search term if user is searching for products
   - category: the category name if user is browsing by category
   - productId: the product ID if user is asking about a specific product
   - sortBy: how to sort results (title, price, rating) if mentioned
   - order: sort order (asc, desc) if mentioned

Be concise in your reasoning. Consider queries about products, categories, prices, features, availability as in-scope.
Consider weather, politics, sports, or completely unrelated topics as out-of-scope.
Set fields to null if they don't apply to this query.`;

    const userPrompt = `Classify this user query: "${userQuery}"`;

    const response = await this.llm
      .withStructuredOutput(verdictSchema)
      .invoke([
        { type: "system" as const, content: systemPrompt },
        new HumanMessage(userPrompt),
      ]);
    log.debug(
      { event: "guardrail.verdict", verdict: response.verdict, intent: response.intent },
      "guardrail classified query",
    );

    return {
      guardrailVerdict: response.verdict,
      intent: response.intent,
      slots: {
        query: response.query || undefined,
        category: response.category || undefined,
        productId: response.productId || undefined,
        sortBy: response.sortBy || undefined,
        order: response.order || undefined,
      },
    };
  }
}
