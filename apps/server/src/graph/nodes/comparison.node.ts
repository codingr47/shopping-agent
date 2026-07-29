import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IndexedProduct, Slots } from "../state.js";
import type { Logger } from "../../logger.js";

type ProductResolver = (slots: Slots, productIndex: Record<number, IndexedProduct>) => IndexedProduct[] | undefined;

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
    const { currentIntent, messages, productIndex, turnId } = state;

    if (!currentIntent) {
      log.warn({ event: "comparison.no_intent" }, "comparison node called without current intent");
      return {};
    }

    const slots = currentIntent.slots || {};

    // Resolve target products using priority-ordered resolver chain
    const resolvedProducts = this.resolveProducts(slots, productIndex);

    if (resolvedProducts.length === 0) {
      log.info({ event: "comparison.no_products" }, "no products found to compare");
      return { comparisonResult: "I don't have information on those products yet — try searching for them first." };
    }

    // Apply sorting if specified
    const sortedProducts = this.sortProducts(resolvedProducts, slots.sortBy, slots.order);

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
          sortBy: slots.sortBy,
          order: slots.order,
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
