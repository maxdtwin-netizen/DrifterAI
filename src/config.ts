import "dotenv/config";

export const config = {
  discordToken: process.env.DISCORD_TOKEN ?? "",
  discordClientId: process.env.DISCORD_CLIENT_ID ?? "",
  discordGuildId: process.env.DISCORD_GUILD_ID ?? "",
  // Optional. Add this in .env if UEX requires a key for your chosen endpoints.
  uexApiKey: process.env.UEX_API_KEY ?? "",
  // Optional. Needed for most StarCitizen-API public RSI endpoints.
  starCitizenApiKey: process.env.STAR_CITIZEN_API_KEY ?? "",
  // Optional. Needed for AI-generated daily channel tips through Groq.
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
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
