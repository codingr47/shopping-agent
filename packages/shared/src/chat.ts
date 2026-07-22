import { ProductSummary, ProductDetail } from "./product.js";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type ChatMessageRole = "user" | "assistant";

export interface ChatMessagePart {
  type: "text";
  text: string;
}

export interface ProductWidgetPart {
  type: "tool-call";
  toolCallId: string;
  toolName: "render_products";
  args: Record<string, never>;
  result: {
    products: ProductSummary[] | null;
  };
}

export type ChatMessageContentPart = ChatMessagePart | ProductWidgetPart;

export interface ChatMessage {
  role: ChatMessageRole;
  content: ChatMessageContentPart[];
}

export interface ProductWidgetPayload {
  products: ProductSummary[];
  total?: number;
}

export interface ProductDetailPayload {
  product: ProductDetail;
}
