import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IntentItem, INTENT_NODE_MAP } from "../state.js";
import type { Logger } from "../../logger.js";

const intentItemSchema = z.object({
  type: z.enum(["search", "browse_category", "product_detail", "other"]),
  confidence: z.number().min(0).max(1),
});

const verdictSchema = z.object({
  verdict: z.enum(["in_scope", "out_of_scope"]),
  intents: z.array(intentItemSchema).min(1).max(3),
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
        intents: [{ type: "other", node: "summarize", confidence: 1 }],
        intentCursor: 0,
        currentIntent: undefined,
      };
    }

    const userQuery = lastMessage.content;

    const systemPrompt = `You are a shopping assistant intent classifier. Analyze the user's query and determine:
1. Is it in-scope (related to shopping/product discovery)?
2. What intents does the query contain? A query may have multiple distinct intents (e.g., "show me headphones and tell me about product 5" contains both a search and a product detail lookup).
   - search: user wants to find/search for products by keyword
   - browse_category: user wants to explore a product category
   - product_detail: user wants details about a specific product
   - other: out-of-scope query (weather, politics, etc.)
3. For each intent, provide a confidence score (0-3 intents max per query).
4. Extract relevant slots that apply to the ENTIRE query:
   - query: the search term if user is searching for products
   - category: the category name if user is browsing by category
   - productId: the product ID if user is asking about a specific product
   - sortBy: how to sort results (title, price, rating) if mentioned
   - order: sort order (asc, desc) if mentioned

Be concise in your reasoning. Consider queries about products, categories, prices, features, availability as in-scope.
Set fields to null if they don't apply.

    # Examples:
    ## Example 1
    Fetch category A and get all its' products
    Thought: The user is asking to 'Fetch category A' and 'get all its' products. He is asking for two actions.
    intents: [
      {
        "type": "browse_category",
        "node": "searchExplorer",
        "confidence": <your confidence> 
      },
      {
        "type": "search",
        "node": "searchExplorer",
        "confidence": <your confidence>
      }
    ]
`;

    const userPrompt = `Classify this user query: "${userQuery}"`;

    const response = await this.llm
      .withStructuredOutput(verdictSchema)
      .invoke([
        { type: "system" as const, content: systemPrompt },
        new HumanMessage(userPrompt),
      ]);

    const intents: IntentItem[] = response.intents.map(item => ({
      type: item.type,
      node: INTENT_NODE_MAP[item.type],
      confidence: item.confidence,
    }));

    const slots = {
        query: response.query || undefined,
        category: response.category || undefined,
        productId: response.productId || undefined,
        sortBy: response.sortBy || undefined,
        order: response.order || undefined,
    };

    log.info(
      { event: "guardrail.verdict", verdict: response.verdict, intents, slots, },
      "guardrail classified query",
    );

    return {
      guardrailVerdict: response.verdict,
      intents,
      intentCursor: 0,
      currentIntent: undefined,
      slots,
    };
  }
}
