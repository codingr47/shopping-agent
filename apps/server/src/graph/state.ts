import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ProductSummary, ProductDetail } from "@shopping-agent/shared";

export type GuardrailVerdict = "in_scope" | "out_of_scope" | undefined;
export type Intent = "search" | "browse_category" | "product_detail" | "comparison" | "other" | undefined;
export type Route = "searchExplorer" | "comparison" | "summarize" | undefined;

export interface Slots {
  query?: string;
  category?: string;
  productId?: number;
  productIds?: number[];
  sortBy?: "title" | "price" | "rating";
  order?: "asc" | "desc";
}

export interface IntentItem {
  type: Intent;
  node: "searchExplorer" | "comparison" | "summarize";
  confidence: number;
  slots?: Slots;
}

export const INTENT_NODE_MAP: Record<NonNullable<Intent>, IntentItem["node"]> = {
  search: "searchExplorer",
  browse_category: "searchExplorer",
  product_detail: "searchExplorer",
  comparison: "comparison",
  other: "summarize",
};

export interface IndexedProduct extends ProductSummary {
  detail?: ProductDetail;
}

export interface TurnWidget {
  turnId: string;
  products: ProductSummary[];
}

export const ShoppingState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  guardrailVerdict: Annotation<GuardrailVerdict>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  intents: Annotation<IntentItem[]>({
    reducer: (_, r) => r,
    default: () => [],
  }),

  intentCursor: Annotation<number>({
    reducer: (_, r) => r,
    default: () => 0,
  }),

  currentIntent: Annotation<IntentItem | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  productResults: Annotation<ProductSummary[] | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  productDetail: Annotation<ProductDetail | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  categories: Annotation<string[] | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  route: Annotation<Route>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  finalMessage: Annotation<string | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  turnId: Annotation<string | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  turnWidgets: Annotation<TurnWidget[]>({
    reducer: (left, right) => [...(left ?? []), ...(right ?? [])],
    default: () => [],
  }),

  productIndex: Annotation<Record<number, IndexedProduct>>({
    reducer: (left, right) => {
      const merged = { ...(left ?? {}) };
      for (const [id, incoming] of Object.entries(right ?? {})) {
        merged[Number(id)] = { ...(merged[Number(id)] ?? {}), ...incoming };
      }
      return merged;
    },
    default: () => ({}),
  }),

  comparisonResult: Annotation<string | undefined>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),
});

export type ShoppingStateType = typeof ShoppingState.State;
