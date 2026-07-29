import { AIMessage, RemoveMessage } from "@langchain/core/messages";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

interface ContextDescriptor {
  present(state: ShoppingStateType): boolean;
  describe(state: ShoppingStateType): string;
  extraInstruction?(state: ShoppingStateType): string;
}

export class SummarizerNode extends BaseGraphNode {
  private readonly CONTEXT_DESCRIPTORS: ContextDescriptor[] = [
    {
      present: s => !!s.comparisonResult,
      describe: s => `Comparison analysis: ${s.comparisonResult}`,
      extraInstruction: () =>
        "If a comparison analysis is provided above, you may include its key finding in your response — this overrides the 'no product detail' rule for that specific finding.",
    },
    {
      present: s => !!s.productResults?.length,
      describe: s => `Found ${s.productResults!.length} product(s). Here are the top matches:`,
    },
    {
      present: s => !!s.productDetail,
      describe: () => `Here are the details for the product:`,
    },
    {
      present: s => !!s.categories?.length,
      describe: s => `Available categories: ${s.categories!.join(", ")}`,
    },
  ];

  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { messages, turnId } = state;

    const activeDescriptors = this.CONTEXT_DESCRIPTORS.filter(d => d.present(state));
    const contextText = activeDescriptors.length > 0 ? activeDescriptors.map(d => d.describe(state)).join(" ") : "No results found.";
    const extraInstructions = activeDescriptors.map(d => d.extraInstruction?.(state)).filter(Boolean).join(" ");

    const systemPrompt = `You are a helpful shopping assistant. The user has just made a request.
Based on the context provided, generate a brief, friendly response (2-3 sentences max).
Suggest one natural next step they could take (e.g., "Would you like to see more options?" or "I can show you other items in this category").
Do NOT describe the products in detail — that's what the product cards are for. Just acknowledge the results and suggest a next action.
${extraInstructions ? extraInstructions : ""}

Context: ${contextText}`;

    const windowedMessages = await this.selectContextWindow(messages);

    const response = await this.llm.invoke([
      { type: "system" as const, content: systemPrompt },
      ...windowedMessages,
    ]);

    const finalMessage =
      typeof response.content === "string"
        ? response.content
        : "I found some results for you!";

    const toolArtifacts = messages.filter(
      m => (m.type === "ai" && ((m as AIMessage).tool_calls?.length ?? 0) > 0) || m.type === 'tool'
    );
    const removals = toolArtifacts.map(m => new RemoveMessage({ id: m.id! }));

    return {
      finalMessage,
      messages: [...removals, new AIMessage({ content: finalMessage, id: turnId })],
    };
  }
}
