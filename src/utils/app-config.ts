import fs from "node:fs";

export type AppConfig = {
  autoNews: boolean;
  autoStatus: boolean;
  autoTradeTips: boolean;
  autoAiTips: boolean;
};

const defaultConfig: AppConfig = {
  autoNews: true,
  autoStatus: true,
  autoTradeTips: false,
  autoAiTips: true
};

const configPath = "config.json";

export function loadAppConfig(): AppConfig {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<AppConfig>;
    return { ...defaultConfig, ...parsed };
  } catch {
    return defaultConfig;
  }
}
