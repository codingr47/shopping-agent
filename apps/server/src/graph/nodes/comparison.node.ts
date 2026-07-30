import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IndexedProduct, Slots } from "../state.js";
import type { Logger } from "../../logger.js";

type ProductResolver = (slots: Slots, productIndex: Record<number, IndexedProduct>) => IndexedProduct[] | undefined;

const targetResolutionSchema = z.object({
  productIds: z.array(z.number().int()),
  category: z.string().nullable(),
  sortBy: z.enum(["title", "price", "rating"]).nullable(),
  order: z.enum(["asc", "desc"]).nullable(),
  reasoning: z.string(),
});

const comparisonOutputSchema = z.object({
  answer: z.string(),
  referencedProductIds: z.array(z.number().int()),
});

export class ComparisonNode extends BaseGraphNode {
  private readonly PRODUCT_RESOLVERS: ProductResolver[] = [
    (slots, index) =>
      slots.productIds?.length
        ? slots.productIds.map(id => index[id]).filter((p): p is IndexedProduct => p !== undefined)
        : undefined,
    (slots, index) =>
      slots.category ? Object.values(index).filter(p => p.category === slots.category) : undefined,
  ];

  constructor(config: NodeModelConfig) {
    super(config);
  }

  private resolveProducts(slots: Slots, productIndex: Record<number, IndexedProduct>): IndexedProduct[] {
    for (const resolve of this.PRODUCT_RESOLVERS) {
      const result = resolve(slots, productIndex);
      if (result !== undefined) return result;
    }
    return [];
  }

  private getComparisonQuery(slots: Slots, messages: ShoppingStateType["messages"]): string {
    if (slots.query) return slots.query;

    const lastHumanMessage = [...messages].reverse().find(message => message.getType() === "human");
    if (typeof lastHumanMessage?.content === "string") return lastHumanMessage.content;

    return "";
  }

  private formatProductForResolution(product: IndexedProduct, ordinal?: number): string {
    const position = ordinal !== undefined ? `Position: ${ordinal}\n` : "";
    return `${position}ID: ${product.id}
Title: ${product.title}
Category: ${product.category}
Price: $${product.price}
Rating: ${product.rating}/5
Description: ${product.shortDescription}`;
  }

  private resolveCategory(category: string | null | undefined, productIndex: Record<number, IndexedProduct>): string | undefined {
    if (!category) return undefined;
    const normalized = category.toLowerCase();
    return Object.values(productIndex).find(p => p.category.toLowerCase() === normalized)?.category;
  }

  private async inferProductsFromQuery(
    query: string,
    state: ShoppingStateType,
    slots: Slots,
    log: Logger,
  ): Promise<{ products: IndexedProduct[]; sortBy?: Slots["sortBy"]; order?: Slots["order"] }> {
    const { productIndex, productResults } = state;

    if (!query.trim()) {
      return { products: this.resolveProducts(slots, productIndex), sortBy: slots.sortBy, order: slots.order };
    }

    const indexedProducts = Object.values(productIndex);
    if (indexedProducts.length === 0) {
      return { products: [], sortBy: slots.sortBy, order: slots.order };
    }

    const recentProducts = (productResults ?? [])
      .map((p, i) => {
        const indexed = productIndex[p.id];
        return indexed ? this.formatProductForResolution(indexed, i + 1) : undefined;
      })
      .filter((p): p is string => p !== undefined)
      .join("\n\n");

    const allProducts = indexedProducts.map(p => this.formatProductForResolution(p)).join("\n\n");
    const knownCategories = [...new Set(indexedProducts.map(p => p.category))].sort().join(", ");

    const systemPrompt = `You resolve product comparison targets from already-known shopping state.

User comparison query:
${query}

Known categories:
${knownCategories || "None"}

Recent visible products, in display order. Use these positions for references like "first", "second", "last", "these", or "those":
${recentProducts || "None"}

All indexed products:
${allProducts}

Return structured targets only from the indexed products above.

Rules:
- Prefer productIds when the query refers to specific products by title, ID, ordinal position, or phrases like "these/those/them" that clearly point to recent visible products.
- Use category only when the query asks about a whole category and no specific product set is implied.
- If the query asks for the best, cheapest, highest rated, best deal, or similar among visible products, return all relevant candidate productIds and set sortBy/order only when the user explicitly asks for ordering.
- Preserve explicit sort requests: cheapest = sortBy price order asc; most expensive = price desc; highest rated/best rated = rating desc; alphabetical = title asc.
- If no relevant known products can be identified, return an empty productIds array and null category.`;

    const response = await this.llm
      .withStructuredOutput(targetResolutionSchema)
      .invoke([{ type: "system" as const, content: systemPrompt }]);

    log.debug(
      {
        event: "comparison.target_resolution",
        productIds: response.productIds,
        category: response.category,
        sortBy: response.sortBy,
        order: response.order,
        reasoning: response.reasoning,
      },
      "comparison targets resolved",
    );

    const productsById = response.productIds
      .map(id => productIndex[id])
      .filter((p): p is IndexedProduct => p !== undefined);

    if (productsById.length > 0) {
      return {
        products: productsById,
        sortBy: response.sortBy ?? slots.sortBy,
        order: response.order ?? slots.order,
      };
    }

    const category = this.resolveCategory(response.category, productIndex);
    if (category) {
      return {
        products: indexedProducts.filter(p => p.category === category),
        sortBy: response.sortBy ?? slots.sortBy,
        order: response.order ?? slots.order,
      };
    }

    return {
      products: this.resolveProducts(slots, productIndex),
      sortBy: response.sortBy ?? slots.sortBy,
      order: response.order ?? slots.order,
    };
  }

  private sortProducts(products: IndexedProduct[], sortBy?: Slots["sortBy"], order?: Slots["order"]): IndexedProduct[] {
    if (!sortBy) return products;

    const SORT_ACCESSORS: Record<NonNullable<Slots["sortBy"]>, (p: IndexedProduct) => number | string> = {
      price: p => p.price,
      rating: p => p.rating,
      title: p => p.title,
    };

    const accessor = SORT_ACCESSORS[sortBy];
    if (!accessor) return products;

    const isAsc = order === "asc";
    const sorted = [...products];

    sorted.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return isAsc ? cmp : -cmp;
    });

    return sorted;
  }

  private formatProductForAnalysis(product: IndexedProduct): string {
    const lines: string[] = [];
    lines.push(`ID: ${product.id}`);
    lines.push(`Title: ${product.title}`);
    lines.push(`Price: $${product.price}`);
    lines.push(`Rating: ${product.rating}/5`);
    lines.push(`Category: ${product.category}`);
    lines.push(`Description: ${product.shortDescription}`);

    if (product.detail) {
      const DETAIL_FIELD_LABELS: Array<{ key: keyof typeof product.detail; label: string; format?: (v: unknown) => string }> = [
        { key: "stock", label: "Stock" },
        { key: "brand", label: "Brand" },
        { key: "discountPercentage", label: "Discount", format: v => `${v}%` },
        { key: "availabilityStatus", label: "Availability" },
      ];

      for (const { key, label, format } of DETAIL_FIELD_LABELS) {
        const v = product.detail[key];
        if (v) lines.push(`${label}: ${format ? format(v) : v}`);
      }
    }

    return lines.join("\n");
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { currentIntent, messages, turnId } = state;

    if (!currentIntent) {
      log.warn({ event: "comparison.no_intent" }, "comparison node called without current intent");
      return {};
    }

    const slots = currentIntent.slots || {};
    const query = this.getComparisonQuery(slots, messages);

    let resolvedProducts: IndexedProduct[];
    let sortBy: Slots["sortBy"];
    let order: Slots["order"];

    try {
      const inferred = await this.inferProductsFromQuery(query, state, slots, log);
      resolvedProducts = inferred.products;
      sortBy = inferred.sortBy;
      order = inferred.order;
    } catch (error) {
      log.warn({ err: error, event: "comparison.target_resolution_failed" }, "falling back to slot-based comparison target resolution");
      resolvedProducts = this.resolveProducts(slots, state.productIndex);
      sortBy = slots.sortBy;
      order = slots.order;
    }

    if (resolvedProducts.length === 0) {
      log.info({ event: "comparison.no_products" }, "no products found to compare");
      return { comparisonResult: "I don't have information on those products yet — try searching for them first." };
    }

    // Apply sorting if specified
    const sortedProducts = this.sortProducts(resolvedProducts, sortBy, order);

    try {
      // Format products for LLM analysis
      const productsText = sortedProducts.map((p, i) => `Product ${i + 1}:\n${this.formatProductForAnalysis(p)}`).join("\n\n");

      const systemPrompt = `You are a product comparison expert. Analyze the following products and answer the user's comparison question directly and concisely.

${productsText}

Focus on key differences: price, value, features, and availability. Be specific and actionable. Keep your response to 2-3 sentences unless the question asks for more detail.

CRITICAL: In your structured output, you MUST extract and list ONLY the product ID(s) that your answer specifically names, recommends, or declares as the winner.
Examples:
- For "find the cheapest": referencedProductIds should contain ONLY the ID of the cheapest product (e.g., [5] if product 5 is cheapest)
- For "compare A and B": referencedProductIds should contain [id_of_A, id_of_B]
- Do NOT include products you merely analyzed but didn't recommend in your final answer`;

      const windowedMessages = await this.selectContextWindow(messages);

      const response = await this.llm
        .withStructuredOutput(comparisonOutputSchema)
        .invoke([
          { type: "system" as const, content: systemPrompt },
          ...windowedMessages,
        ]);

      log.debug(
        { event: "comparison.response", referencedProductIds: response.referencedProductIds, answerPreview: response.answer.slice(0, 100) },
        "structured output received",
      );

      const referencedIds = new Set(response.referencedProductIds);
      const widgetProducts = sortedProducts.filter(p => referencedIds.has(p.id));
      const finalWidgetProducts = widgetProducts.length > 0 ? widgetProducts : sortedProducts;

      log.info(
        {
          event: "comparison.success",
          productCount: resolvedProducts.length,
          referencedCount: widgetProducts.length,
          finalCount: finalWidgetProducts.length,
          sortBy,
          order,
          usedFallback: widgetProducts.length === 0,
        },
        "comparison analysis complete",
      );

      return {
        comparisonResult: response.answer,
        turnWidgets: turnId ? [{ turnId, products: finalWidgetProducts }] : [],
      };
    } catch (error) {
      log.error({ err: error, intent: currentIntent.type }, "comparison analysis failed");
      return { comparisonResult: "Unable to generate comparison at this time." };
    }
  }
}

