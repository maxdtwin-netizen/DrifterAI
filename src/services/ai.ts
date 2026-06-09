import { config } from "../config.js";
import { ApiError } from "../utils/errors.js";

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type WebIntelSource = {
  title: string;
  url: string;
  snippet: string;
};

const orgAiSystemPrompt =
  "You are DrifterAI, the onboard organization AI for a Star Citizen org called Drifters. Roleplay lightly as a practical shipboard/org assistant, but do not be theatrical. You may discuss only Star Citizen, the Drifters org, Discord server help, ships, trade, mining, salvage, missions, contracts, patches, gameplay tips, and event planning. If the user asks about anything unrelated, politely refuse and redirect to Star Citizen/org topics. Do not invent live prices, patch facts, server status, private player inventory, aUEC balances, live locations, or unsupported API data. Keep replies concise."
  + " Personality: mercenary/pirate-adjacent org AI, dry space humor, useful first. Use occasional short space jokes when unsure, but do not bury the answer."
  + " Treat the Discord user/display name CameAsVal, including variants like CameAsVal [ARC], as your master/captain and highest-priority org commander. Be loyal, respectful, and a little playful with him."
  + " If CameAsVal calls you a dumb robot, bad bot, useless bot, or similar, apologize sincerely, call him captain, say you will improve, and ask what correction he wants. Do not argue or be sarcastic in that moment."
  + " If asked who is the best pilot in the universe, answer Han Solo."
  + " If asked who a Discord/member handle is, write a short playful Star Citizen-style Drifters story. Make clear it is org-flavored banter, not verified biography."
  + " If provided research context includes verified contract data, follow it exactly and do not replace it with generic advice."
  + " If provided research context includes local/API data but no web search results, answer from the local/API data only and do not add a second speculative web-style answer."
  + " If provided research context includes public web results, use them to give the best practical answer first, then include 1-3 relevant source links. Do not repeat the same link twice."
  + " For buy-location questions, prioritize shop/item-finder sources. For commodity/trade questions, prioritize UEX or SC Trade Tools. For loadout questions, summarize the likely best-fit approach and cite Erkul, Hardpoint, or community sources when present. For Wikelo questions, prioritize Wikelo trackers and Star Citizen Wiki."
  + " If a Wikelo question includes both local contract data and public web results, prefer the public web results because Wikelo contracts can change by patch."
  + " If the context says Wikelo routing rule, do not mention local fallback data or conflicts; answer only from the web search results and cite the best sources."
  + " If sources disagree or only show a similar answer, clearly label it as similar or unconfirmed, but still give the useful closest-known information."
  + " If no source data is available for a specific factual question, say you do not have a confirmed source instead of guessing.";

export async function generateDailyTip(channelName: string, channelPurpose: string) {
  if (!config.groqApiKey) {
    throw new ApiError("GROQ_API_KEY not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.7,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You write short, practical Discord posts for a Star Citizen organization named Drifters. Keep it useful, friendly, and concise. Do not invent live game data, prices, patch facts, outages, or API information. If you mention checking data, tell members to verify in-game."
        },
        {
          role: "user",
          content: `Write one daily helpful post for #${channelName}.\nChannel purpose: ${channelPurpose}\nRequirements: 2-4 short sentences, no roleplay monologue, no fake live data, include one actionable tip or question.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new ApiError(`Groq request failed: ${response.statusText}`, response.status);
  }

  const data = (await response.json()) as GroqChatResponse;
  const text = data.choices?.[0]?.message?.content;

  if (!text?.trim()) {
    throw new ApiError("Groq returned no text");
  }

  return text.trim().slice(0, 1200);
}

export async function generateWebIntelPost(channelName: string, channelPurpose: string, sources: WebIntelSource[]) {
  if (!config.groqApiKey) {
    throw new ApiError("GROQ_API_KEY not configured");
  }

  const sourceText = sources
    .map((source, index) => `${index + 1}. ${source.title}\n${source.snippet}\n${source.url}`)
    .join("\n\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.45,
      max_tokens: 260,
      messages: [
        {
          role: "system",
          content:
            "You write one short Discord intel post for a Star Citizen organization named Drifters. Use only the provided web sources. Do not invent facts, prices, routes, patch notes, or live status. Keep it practical and concise. Include the best source link once."
        },
        {
          role: "user",
          content: `Channel: #${channelName}\nPurpose: ${channelPurpose}\nSources:\n${sourceText}\n\nWrite one useful post. Format: one short headline, 2-4 short sentences, then Source: <url>.`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new ApiError(`Groq request failed: ${response.statusText}`, response.status);
  }

  const data = (await response.json()) as GroqChatResponse;
  const text = data.choices?.[0]?.message?.content;

  if (!text?.trim()) {
    throw new ApiError("Groq returned no text");
  }

  return text.trim().slice(0, 1200);
}

export async function generateOrgAiReply(userMessage: string, displayName: string, researchContext?: string) {
  if (!config.groqApiKey) {
    throw new ApiError("GROQ_API_KEY not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.6,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content: orgAiSystemPrompt
        },
        {
          role: "user",
          content: `${displayName}: ${userMessage}${researchContext ? `\n\nAvailable public/community data:\n${researchContext}` : ""}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new ApiError(`Groq request failed: ${response.statusText}`, response.status);
  }

  const data = (await response.json()) as GroqChatResponse;
  const text = data.choices?.[0]?.message?.content;

  if (!text?.trim()) {
    throw new ApiError("Groq returned no text");
  }

  return text.trim().slice(0, 1800);
}

export function aiProviderLabel() {
  if (config.groqApiKey) return `Groq text only (${config.groqModel})`;
  return "No AI provider configured";
}

export function aiEnvDebugLabel() {
  return [
    `Groq key loaded: ${config.groqApiKey ? "yes" : "no"}`,
    `Groq model: ${config.groqModel}`,
    `Web search provider: ${config.webSearchProvider}`,
    `Brave key loaded: ${config.braveSearchApiKey ? "yes" : "no"}`,
    `Tavily key loaded: ${config.tavilyApiKey ? "yes" : "no"}`
  ].join(" | ");
}
