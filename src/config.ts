import "dotenv/config";

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

const rawGroqApiKey = envValue("GROQ_API_KEY");
const rawGroqModel = envValue("GROQ_MODEL");

export const config = {
  discordToken: envValue("DISCORD_TOKEN"),
  discordClientId: envValue("DISCORD_CLIENT_ID"),
  discordGuildId: envValue("DISCORD_GUILD_ID"),
  // Optional. Add this in .env if UEX requires a key for your chosen endpoints.
  uexApiKey: envValue("UEX_API_KEY"),
  // Optional. Needed for most StarCitizen-API public RSI endpoints.
  starCitizenApiKey: envValue("STAR_CITIZEN_API_KEY"),
  // Optional. Needed for AI-generated daily channel tips through Groq.
  groqApiKey: rawGroqApiKey,
  groqModel: rawGroqModel || "meta-llama/llama-4-scout-17b-16e-instruct",
  // Optional. Use one of these for web answers before Groq writes the reply.
  braveSearchApiKey: envValue("BRAVE_SEARCH_API_KEY"),
  tavilyApiKey: envValue("TAVILY_API_KEY"),
  webSearchProvider: envValue("WEB_SEARCH_PROVIDER") || "auto",
  // Optional calibration point for the executive hangar cycle.
  // This should be a UTC time when the cycle resets to the start of red phase.
  execHangarCycleResetUtc: process.env.EXEC_HANGAR_CYCLE_RESET_UTC ?? "2026-06-05T16:50:48Z",
  uexBaseUrl: "https://api.uexcorp.uk/2.0",
  wikiBaseUrl: "https://api.star-citizen.wiki/api",
  starCitizenApiBaseUrl: "https://api.starcitizen-api.com"
};

export function assertRuntimeConfig() {
  const missing = [];
  if (!config.discordToken) missing.push("DISCORD_TOKEN");
  if (!config.discordClientId) missing.push("DISCORD_CLIENT_ID");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
