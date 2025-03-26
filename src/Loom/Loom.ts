import OpenAI, { ClientOptions } from "openai";

export interface ConfigOptions {
  api?: "completions" | "responses";
  openai_config?: ClientOptions;
}

const config: ConfigOptions = {
  api: "responses",
  openai_config: {},
};

let openaiInstance = new OpenAI(config.openai_config);

export const Loom = {
  get api(): ConfigOptions["api"] {
    return config.api;
  },
  set api(value: ConfigOptions["api"]) {
    config.api = value;
  },
  get openai_config(): ConfigOptions["openai_config"] {
    return config.openai_config;
  },
  set openai_config(value: ConfigOptions["openai_config"]) {
    config.openai_config = value;
    openaiInstance = new OpenAI(value);
  },
  update(newConfig: ConfigOptions): void {
    Object.assign(config, newConfig);
    if (newConfig.openai_config) {
      openaiInstance = new OpenAI(newConfig.openai_config);
    }
  },
  getAll(): ConfigOptions {
    return { ...config };
  },
  get openai() {
    return openaiInstance;
  },
};
