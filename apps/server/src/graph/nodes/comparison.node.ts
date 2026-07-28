import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IndexedProduct } from "../state.js";
import type { Logger } from "../../logger.js";

const comparisonOutputSchema = z.object({
  answer: z.string(),
  referencedProductIds: z.array(z.number().int()),
});

export class ComparisonNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  private sortProducts(products: IndexedProduct[], sortBy?: string, order?: string): IndexedProduct[] {
    if (!sortBy) return products;

    const sorted = [...products];
    const isAsc = order === "asc";

    if (sortBy === "price") {
      sorted.sort((a, b) => (isAsc ? a.price - b.price : b.price - a.price));
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => (isAsc ? a.rating - b.rating : b.rating - a.rating));
    } else if (sortBy === "title") {
      sorted.sort((a, b) => (isAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)));
    }

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
      const detail = product.detail;
      if (detail.stock) lines.push(`Stock: ${detail.stock}`);
      if (detail.brand) lines.push(`Brand: ${detail.brand}`);
      if (detail.discountPercentage) lines.push(`Discount: ${detail.discountPercentage}%`);
      if (detail.availabilityStatus) lines.push(`Availability: ${detail.availabilityStatus}`);
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

    // Resolve target products
    let resolvedProducts: IndexedProduct[] = [];

    if (slots.productIds && slots.productIds.length > 0) {
      // Direct product ID lookup
      resolvedProducts = slots.productIds
        .map(id => productIndex[id])
        .filter((p): p is IndexedProduct => p !== undefined);
    } else if (slots.category) {
      // Filter by category
      resolvedProducts = Object.values(productIndex).filter(p => p.category === slots.category);
    }

    if (resolvedProducts.length === 0) {
      log.info({ event: "comparison.no_products" }, "no products found to compare");
      return { comparisonResult: "I don't have information on those products yet — try searching for them first." };
    }

    // Apply sorting if specified
    resolvedProducts = this.sortProducts(resolvedProducts, slots.sortBy, slots.order);

    try {
      // Format products for LLM analysis
      const productsText = resolvedProducts.map((p, i) => `Product ${i + 1}:\n${this.formatProductForAnalysis(p)}`).join("\n\n");

      const systemPrompt = `You are a product comparison expert. Analyze the following products and answer the user's comparison question directly and concisely.

${productsText}

Focus on key differences: price, value, features, and availability. Be specific and actionable. Keep your response to 2-3 sentences unless the question asks for more detail.

CRITICAL: In your structured output, you MUST extract and list ONLY the product ID(s) that your answer specifically names, recommends, or declares as the winner.
Examples:
- For "find the cheapest": referencedProductIds should contain ONLY the ID of the cheapest product (e.g., [5] if product 5 is cheapest)
- For "compare A and B": referencedProductIds should contain [id_of_A, id_of_B]
- Do NOT include products you merely analyzed but didn't recommend in your final answer`;

      const response = await this.llm
        .withStructuredOutput(comparisonOutputSchema)
        .invoke([
          { type: "system" as const, content: systemPrompt },
          ...messages,
        ]);

      log.debug(
        { event: "comparison.response", referencedProductIds: response.referencedProductIds, answerPreview: response.answer.slice(0, 100) },
        "structured output received",
      );

      const referencedIds = new Set(response.referencedProductIds);
      const widgetProducts = resolvedProducts.filter(p => referencedIds.has(p.id));
      const finalWidgetProducts = widgetProducts.length > 0 ? widgetProducts : resolvedProducts;

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
