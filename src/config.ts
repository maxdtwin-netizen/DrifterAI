import "dotenv/config";

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

export const config = {
  discordToken: envValue("DISCORD_TOKEN"),
  discordClientId: envValue("DISCORD_CLIENT_ID"),
  discordGuildId: envValue("DISCORD_GUILD_ID"),
  // Optional. Add this in .env if UEX requires a key for your chosen endpoints.
  uexApiKey: envValue("UEX_API_KEY"),
  // Optional. Needed for most StarCitizen-API public RSI endpoints.
  starCitizenApiKey: envValue("STAR_CITIZEN_API_KEY"),
  // Optional. Needed for AI-generated daily channel tips through Groq.
  groqApiKey: envValue("GROQ_API_KEY"),
  groqModel: envValue("GROQ_MODEL") || "llama-3.3-70b-versatile",
  // Optional. If set, DrifterAI uses Gemini with Google Search grounding for chat answers.
  geminiApiKey: envValue("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY"),
  geminiModel: envValue("GEMINI_MODEL") || "gemini-3.5-flash",
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
