import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IntentItem, INTENT_NODE_MAP } from "../state.js";
import type { Logger } from "../../logger.js";

const slotsSchema = z.object({
  query: z.string().nullable(),
  category: z.string().nullable(),
  productId: z.number().int().nullable(),
  productIds: z.array(z.number().int()).nullable(),
  sortBy: z.enum(["title", "price", "rating"]).nullable(),
  order: z.enum(["asc", "desc"]).nullable(),
});

const intentItemSchema = z.object({
  type: z.enum(["search", "browse_category", "product_detail", "comparison", "other"]),
  confidence: z.number().min(0).max(1),
  slots: slotsSchema,
});

const verdictSchema = z.object({
  verdict: z.enum(["in_scope", "out_of_scope"]),
  intents: z.array(intentItemSchema).min(1).max(3),
  reasoning: z.string(),
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

    const knownStateParts: string[] = [];

    // Cap productIndex listing to ~20 most recent ids to avoid unbounded prompt growth
    const indexIds = Object.keys(state.productIndex).map(Number).sort((a, b) => b - a).slice(0, 20);
    if (indexIds.length > 0) {
      const indexEntries = indexIds
        .map(id => {
          const p = state.productIndex[id];
          return `  id=${id}, "${p.title}", category=${p.category}, $${p.price}`;
        })
        .join("\n");
      knownStateParts.push(`Recently discussed products:\n${indexEntries}`);
    }

    if (state.categories && state.categories.length > 0) {
      knownStateParts.push(`Known categories: ${state.categories.join(", ")}`);
    }

    const knownStateContext = knownStateParts.length > 0 ? knownStateParts.join("\n") : "None.";

    const systemPrompt = `You are a shopping assistant intent classifier. Analyze the user's query and determine:
1. Is it in-scope (related to shopping/product discovery)?
2. What intents does the query contain? A query may have multiple distinct intents (e.g., "show me headphones and tell me about product 5" contains both a search and a product detail lookup).
   - search: user wants to find/search for products by keyword
   - browse_category: user wants to explore a product category
   - product_detail: user wants details about a specific product
   - comparison: user wants to compare specific products already discussed, or all products in a known category (e.g., "find the best deal"), without fetching new data
   - other: out-of-scope query (weather, politics, etc.)
3. For each intent, provide a confidence score (0-3 intents max per query).
4. For EACH intent, extract the slots that apply to THAT SPECIFIC intent only (not the whole query):
   - query: the search term, if this intent is a search
   - category: the category name, if this intent is a category browse
   - productId: the product ID, if this intent is a product detail lookup
   - productIds: array of product IDs, if this intent is a comparison (resolve names from conversation history to IDs)
   - sortBy: how to sort results (title, price, rating), if mentioned for this intent
   - order: sort order (asc, desc), if mentioned for this intent
   Slots for one intent must NOT leak into another intent's slots.

   Slot values may be derived from:
   - The current user message (explicit values)
   - The conversation history below (e.g. resolving "that product" / "it" to a product mentioned earlier)
   - The currently known agent state below (e.g. carrying forward a category or product id from a prior turn when the user says "sort those by price" or "tell me more about it")

Be concise in your reasoning. Consider queries about products, categories, prices, features, availability as in-scope.
Set slot fields to null if they don't apply to that intent.

# Currently known state:
${knownStateContext}

    # Examples:
    ## Example 1 - search category and its products
    Fetch category A and get all its' products
    Thought: The user is asking to 'Fetch category A' and 'get all its' products. He is asking for two actions.
    intents: [
      {
        "type": "browse_category",
        "node": "searchExplorer",
        "confidence": <your confidence>,
        "slots": { "query": null, "category": "A", "productId": null, "productIds": null, "sortBy": null, "order": null }
      },
      {
        "type": "search",
        "node": "searchExplorer",
        "confidence": <your confidence>,
        "slots": { "query": null, "category": "A", "productId": null, "productIds": null, "sortBy": null, "order": null }
      }
    ]
    ## Example 2 - Multi Products Search
    Fetch details of:
    Squishy Pigeon Doll
    iPhone 15 Plus
    Thought: The user is asking to 'Fetch details' of 'Squishy Pigeon Doll', 'iPhone 15 Plus'. He is querying for 2 products.
    intents:
    intents: [
      {
        "type": "product_detail",
        "node": "searchExplorer",
        "confidence": <your confidence>,
        "slots": { "query": null, "category": null, "productId": <id resolved from "Squishy Pigeon Doll">, "productIds": null, "sortBy": null, "order": null }
      },
      {
        "type": "product_detail",
        "node": "searchExplorer",
        "confidence": <your confidence>,
        "slots": { "query": null, "category": null, "productId": <id resolved from "iPhone 15 Plus">, "productIds": null, "sortBy": null, "order": null }
      }
    ]
    ## Example 3 - Compare products
    Compare product A and product B for me, which one is better?
    Thought: The user is asking to compare two specific products already discussed. Resolve the product names from the conversation history to their IDs.
    intents: [
      {
        "type": "comparison",
        "node": "comparison",
        "confidence": <your confidence>,
        "slots": { "query": null, "category": null, "productId": null, "productIds": [<id of product A>, <id of product B>], "sortBy": null, "order": null }
      }
    ]
`;

    const response = await this.llm
      .withStructuredOutput(verdictSchema)
      .invoke([
        { type: "system" as const, content: systemPrompt },
        ...state.messages,
      ]);

    const intents: IntentItem[] = response.intents.map(item => ({
      type: item.type,
      node: INTENT_NODE_MAP[item.type],
      confidence: item.confidence,
      slots: {
        query: item.slots.query || undefined,
        category: item.slots.category || undefined,
        productId: item.slots.productId || undefined,
        productIds: item.slots.productIds?.length ? item.slots.productIds : undefined,
        sortBy: item.slots.sortBy || undefined,
        order: item.slots.order || undefined,
      },
    }));

    log.info(
      { event: "guardrail.verdict", verdict: response.verdict, intents },
      "guardrail classified query",
    );

    return {
      guardrailVerdict: response.verdict,
      intents,
      intentCursor: 0,
      currentIntent: undefined,
    };
  }
}
