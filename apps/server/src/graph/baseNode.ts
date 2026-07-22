import { ChatOpenAI } from "@langchain/openai";
import { ShoppingStateType } from "./state.js";

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

  constructor(config: NodeModelConfig) {
    this.config = config;

    if (config.topK !== undefined) {
      console.warn(
        `[${this.constructor.name}] topK is not supported by OpenAI chat completions; ignored.`,
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
  }

  abstract run(state: TState): Promise<Partial<TState>>;

  toNodeFn() {
    return (state: TState) => this.run(state);
  }
}
