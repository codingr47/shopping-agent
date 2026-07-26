import { ChatOpenAI } from "@langchain/openai";
import { ShoppingStateType } from "./state.js";
import { logger, type Logger } from "../logger.js";
import type { RunnableConfig } from "@langchain/core/runnables";

export interface NodeModelConfig {
  model: string;
  temperature?: number;
  topP?: number;
  seed?: number;
  topK?: number;
}

export abstract class BaseGraphNode<TState = ShoppingStateType> {
  protected readonly config: NodeModelConfig;
  protected readonly llm: ChatOpenAI;
  private readonly logger: Logger;

  constructor(config: NodeModelConfig) {
    this.config = config;

    if (config.topK !== undefined) {
      logger.warn(
        { node: this.constructor.name },
        "topK is not supported by OpenAI chat completions; ignored",
      );
    }

    const modelKwargs: any = {};
    if (config.seed !== undefined) {
      modelKwargs.seed = config.seed;
    }

    this.llm = new ChatOpenAI({
      model: config.model,
      temperature: config.temperature ?? 0.7,
      topP: config.topP,
      modelKwargs: Object.keys(modelKwargs).length > 0 ? modelKwargs : undefined,
    });

    this.logger = logger;
  }

  abstract run(state: TState, log: Logger): Promise<Partial<TState>>;

  toNodeFn() {
    return async (state: TState, config?: RunnableConfig) => {
      const requestId = config?.configurable?.requestId as string | undefined;
      const threadId = config?.configurable?.thread_id as string | undefined;
      const nodeName = this.constructor.name;
      const log = logger.child({ requestId, threadId, node: nodeName });

      const start = performance.now();
      log.debug({ event: "node.start" }, `${nodeName} started`);

      try {
        const result = await this.run(state, log);
        const duration = Math.round(performance.now() - start);
        log.debug(
          {
            event: "node.end",
            durationMs: duration,
            outputKeys: Object.keys(result ?? {}),
          },
          `${nodeName} completed`,
        );
        log.debug({ event: "node.output", output: this.summarizeState(result) }, `${nodeName} output detail`);
        return result;
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        log.error(
          { event: "node.error", durationMs: duration, err },
          `${nodeName} failed`,
        );
        throw err;
      }
    };
  }

  private info(msg: any) {
    this.logger.info(msg);
  }

  private summarizeState(partial: Partial<TState> | undefined): Record<string, unknown> {
    if (!partial) return {};
    const summary: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(partial)) {
      if (key === "messages" && Array.isArray(value)) {
        summary[key] = {
          count: value.length,
          lastPreview:
            value.length > 0 && typeof value[value.length - 1].content === "string"
              ? (value[value.length - 1].content as string).slice(0, 120)
              : undefined,
        };
      } else if (key === "productResults" && Array.isArray(value)) {
        summary[key] = { count: value.length };
      } else if (key === "categories" && Array.isArray(value)) {
        summary[key] = { count: value.length };
      } else if (key === "turnWidgets" && Array.isArray(value)) {
        summary[key] = { count: value.length };
      } else if (
        key === "intents" ||
        key === "currentIntent" ||
        key === "route" ||
        key === "guardrailVerdict" ||
        key === "finalMessage" ||
        key === "productDetail"
      ) {
        summary[key] = value;
      }
    }

    return summary;
  }
}
