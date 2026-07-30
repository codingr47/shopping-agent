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
  limit: z.number().int().nullable(),
  skip: z.number().int().nullable(),
});

const intentItemSchema = z.object({
  type: z.enum(["search", "browse_categories", "browse_products_by_category", "browse_products", "product_detail", "comparison", "other"]),
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
   - browse_categories: user wants to explore categories
   - browse_products_by_category: user wants to explore products by a category
   - product_detail: user wants details about a specific product
   - browse_products: user wants to list all products by sort options and/or limit
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
   - limit: amount of products / categories to get
   - skip: an offset to start looking products / categories from
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

## Example 1 - List Products
User: Show 35 products, beginning after 20, sort in descending order by title
Thought: 
The user is asking to Show Products. 
He is asking for one action.
He is specifying for 35 products exactly (limit = 35).
He is asking to skip first 20 (skip = 20).
He is asking to sort by title in descending order (sortBy = title, order = desc)
intents: [
  {
    "type": "browse_products",
    "node": "searchExplorer",
    "confidence": <your confidence>
    "slots": { "query": null, "category": null, "productId": null, "productIds": null, "sortBy": "title", "order": "desc", "limit": 35, "skip": 20 }
  }
]
## Example 2 - List Categories
List all categories
Thought:
The user is asking to Show all Categories.
He is asking for one action.
intents: [
  {
    "type": "browse_categories",
    "node": "searchExplorer",
    "confidence": <your confidence>
    "slots": { "query": null, "category": null, "productId": null, "productIds": null, "sortBy": null, "order": null, "limit": null, "skip": null }
  }
]
## Example 3 - Get Products by Category 
User: Get 14 products starting from 20 for category clocks 
Thought:
The user is asking to Show Products By Category
He is asking for one action
He is asking to limit to 14 products
He is asking to skip the first 20 products
He is asking for category clocks
intents: [
  {
    "type": "browse_products_by_category",
    "node": "searchExplorer",
    "confidence": <your confidence>
    "slots": { "query": null, "category": "clocks", "productId": null, "productIds": null, "sortBy": null, "order": null, "limit": 14, "skip": 20 }
  }
]

## Example 4 - Search product by query
User: Search for exactly 2 products with the word alex and skip the first result
Thought:
The user is asking to Search for products
He is asking for one action
He is asking to limit to 2 products
He is asking to skip the first product
He is asking for products containing the word alex
intents: [
  {
    "type": "search",
    "node": "searchExplorer",
    "confidence": <your confidence>
    "slots": { "query": "alex", "category": null, "productId": null, "productIds": null, "sortBy": null, "order": null, "limit": 2, "skip": 1 }
  }
]

## Example 6 - Compare products
Compare product A and product B for me, which one is better?
Thought: 
The user is asking to compare two specific products already discussed
He is asking for one action.
We need to resolve the product names from the conversation history to their IDs.
intents: [
  {
    "type": "comparison",
    "node": "comparison",
    "confidence": <your confidence>,
    "slots": { "query": null, "category": null, "productId": null, "productIds": [<id of product A>, <id of product B>], "sortBy": null, "order": null, "limit": null, "skip": null }
  }
]
`;
    const windowedMessages = await this.selectContextWindow(state.messages);

    const response = await this.llm
      .withStructuredOutput(verdictSchema)
      .invoke([
        { type: "system" as const, content: systemPrompt },
        ...windowedMessages,
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
        limit: item.slots.limit || undefined,
        skip: item.slots.skip || undefined,
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
