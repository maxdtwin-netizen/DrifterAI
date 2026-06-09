import fs from "node:fs";

export type AppConfig = {
  autoNews: boolean;
  autoStatus: boolean;
  autoTradeTips: boolean;
  autoAiTips: boolean;
  autoWebIntel: boolean;
  autoPatchNotes: boolean;
};

const defaultConfig: AppConfig = {
  autoNews: false,
  autoStatus: true,
  autoTradeTips: false,
  autoAiTips: false,
  autoWebIntel: true,
  autoPatchNotes: true
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
