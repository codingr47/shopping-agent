import { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

interface WindowCache {
  ids: string[];
  tokenCounts: number[];
  pointer: number;
  windowTotal: number;
}

const cache = new Map<string, WindowCache>();

export async function selectContextWindow(
  llm: ChatOpenAI,
  messages: BaseMessage[],
  maxTokens: number,
): Promise<BaseMessage[]> {
  if (messages.length === 0) return messages;

  const key = messages[0]?.id;
  if (!key) return messages;

  let entry = cache.get(key);

  if (!entry) {
    entry = { ids: [], tokenCounts: [], pointer: 0, windowTotal: 0 };
    cache.set(key, entry);
  }

  // Staleness check: if cached ids is not a prefix of current message ids,
  // the summarizer's RemoveMessage has shrunk the array — reset.
  const currentIds = messages.map(m => m.id).filter((id): id is string => !!id);
  const isStale = entry.ids.length > currentIds.length ||
    !entry.ids.every((id, i) => id === currentIds[i]);

  if (isStale) {
    entry.ids = [];
    entry.tokenCounts = [];
    entry.pointer = 0;
    entry.windowTotal = 0;
  }

  // Incremental tokenization: only tokenize messages not yet in the cache.
  const newMessages = messages.slice(entry.ids.length);
  if (newMessages.length > 0) {
    const { countPerMessage } = await llm.getNumTokensFromMessages(newMessages);
    const newIds = newMessages.map(m => m.id).filter((id): id is string => !!id);

    for (let i = 0; i < newMessages.length; i++) {
      entry.ids.push(newIds[i] || `unknown-${i}`);
      entry.tokenCounts.push(countPerMessage[i]);
      entry.windowTotal += countPerMessage[i];
    }
  }

  // Advance pointer to stay within token budget.
  while (entry.windowTotal > maxTokens && entry.pointer < entry.ids.length - 1) {
    entry.windowTotal -= entry.tokenCounts[entry.pointer];
    entry.pointer++;
  }

  // Tool-call pairing safety: if pointer lands on a ToolMessage,
  // walk back to include the preceding AIMessage(tool_calls).
  let effectivePointer = entry.pointer;
  while (effectivePointer > 0 && messages[effectivePointer]?.type === "tool") {
    effectivePointer--;
  }
  entry.pointer = effectivePointer;

  return messages.slice(effectivePointer);
}
