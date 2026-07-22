import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ProductSummary, ProductDetail } from "@shopping-agent/shared";

export type GuardrailVerdict = "in_scope" | "out_of_scope" | undefined;
export type Intent = "search" | "browse_category" | "product_detail" | "other" | undefined;
export type Route = "search" | "category" | "detail" | "summarize" | "off_topic" | "end" | undefined;

export interface Slots {
  query?: string;
  category?: string;
  productId?: number;
  sortBy?: "title" | "price" | "rating";
  order?: "asc" | "desc";
}

export interface TurnWidget {
  turnIndex: number;
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

  intent: Annotation<Intent>({
    reducer: (_, r) => r,
    default: () => undefined,
  }),

  slots: Annotation<Slots | undefined>({
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

  turnWidgets: Annotation<TurnWidget[]>({
    reducer: (left, right) => [...(left ?? []), ...(right ?? [])],
    default: () => [],
  }),
});

export type ShoppingStateType = typeof ShoppingState.State;
