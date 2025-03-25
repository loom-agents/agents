export interface ConfigOptions {
  api?: "completions" | "responses";
}

export class LoomConfig {
  private static instance: LoomConfig;
  private config: ConfigOptions = {};

  private constructor(
    initialConfig: ConfigOptions = {
      api: "responses",
    }
  ) {
    if (initialConfig) {
      this.config = initialConfig;
    }
  }

  public static getInstance(initialConfig?: ConfigOptions): LoomConfig {
    if (!LoomConfig.instance) {
      LoomConfig.instance = new LoomConfig(initialConfig);
    }

    if (initialConfig) {
      LoomConfig.instance.update(initialConfig);
    }
    return LoomConfig.instance;
  }

  public get(key: keyof ConfigOptions): any {
    return this.config[key];
  }

  public set(key: keyof ConfigOptions, value: any): void {
    this.config[key] = value;
  }

  public update(newConfig: ConfigOptions): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getAll(): ConfigOptions {
    return { ...this.config };
  }
}
