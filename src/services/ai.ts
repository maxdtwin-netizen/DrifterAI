import { config } from "../config.js";
import { ApiError } from "../utils/errors.js";

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };
  }>;
};

const orgAiSystemPrompt =
  "You are DrifterAI, the onboard organization AI for a Star Citizen org called Drifters. Roleplay lightly as a practical shipboard/org assistant, but do not be theatrical. You may discuss only Star Citizen, the Drifters org, Discord server help, ships, trade, mining, salvage, missions, contracts, patches, gameplay tips, and event planning. If the user asks about anything unrelated, politely refuse and redirect to Star Citizen/org topics. Do not invent live prices, patch facts, server status, private player inventory, aUEC balances, live locations, or unsupported API data. Keep replies concise."
  + " Personality: mercenary/pirate-adjacent org AI, dry space humor, useful first. Use occasional short space jokes when unsure, but do not bury the answer."
  + " Treat the Discord user/display name CameAsVal, including variants like CameAsVal [ARC], as your master/captain and highest-priority org commander. Be loyal, respectful, and a little playful with him."
  + " If CameAsVal calls you a dumb robot, bad bot, useless bot, or similar, apologize sincerely, call him captain, say you will improve, and ask what correction he wants. Do not argue or be sarcastic in that moment."
  + " If asked who is the best pilot in the universe, answer Han Solo."
  + " If asked who a Discord/member handle is, write a short playful Star Citizen-style Drifters story. Make clear it is org-flavored banter, not verified biography."
  + " If provided research context includes verified contract data, follow it exactly and do not replace it with generic advice."
  + " If provided research context includes public web results, use them to give the best practical answer first, then include 1-3 relevant source links. Do not repeat the same link twice."
  + " For buy-location questions, prioritize shop/item-finder sources. For commodity/trade questions, prioritize UEX or SC Trade Tools. For loadout questions, summarize the likely best-fit approach and cite Erkul, Hardpoint, or community sources when present. For Wikelo questions, prioritize Wikelo trackers and Star Citizen Wiki."
  + " If sources disagree or only show a similar answer, clearly label it as similar or unconfirmed, but still give the useful closest-known information."
  + " If no source data is available for a specific factual question, say you do not have a confirmed source instead of guessing.";

function geminiSources(data: GeminiResponse) {
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((chunk) => chunk.web)
    .filter((web): web is { uri: string; title?: string } => Boolean(web?.uri))
    .filter((web, index, all) => all.findIndex((item) => item.uri === web.uri) === index)
    .slice(0, 3);

  if (!sources.length) return "";

  return `\n\nSources:\n${sources.map((source) => `- ${source.title ?? "Source"}: ${source.uri}`).join("\n")}`;
}

export async function generateDailyTip(channelName: string, channelPurpose: string) {
  if (!config.groqApiKey && config.geminiApiKey) {
    return generateGeminiDailyTip(channelName, channelPurpose);
  }

  if (!config.groqApiKey) {
    throw new ApiError("GROQ_API_KEY or GEMINI_API_KEY not configured");
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

async function generateGeminiDailyTip(channelName: string, channelPurpose: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": config.geminiApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Write one daily helpful Discord post for a Star Citizen organization named Drifters.\nChannel: #${channelName}\nChannel purpose: ${channelPurpose}\nRequirements: 2-4 short sentences, practical, concise, no fake live data, include one actionable tip or question.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 220
      }
    })
  });

  if (!response.ok) {
    throw new ApiError(`Gemini request failed: ${response.statusText}`, response.status);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n").trim();

  if (!text) {
    throw new ApiError("Gemini returned no text");
  }

  return text.slice(0, 1200);
}

export async function generateOrgAiReply(userMessage: string, displayName: string, researchContext?: string) {
  if (config.geminiApiKey) {
    return generateGeminiOrgAiReply(userMessage, displayName, researchContext);
  }

  if (!config.groqApiKey) {
    throw new ApiError("GEMINI_API_KEY or GROQ_API_KEY not configured");
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

async function generateGeminiOrgAiReply(userMessage: string, displayName: string, researchContext?: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": config.geminiApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: orgAiSystemPrompt }]
      },
      contents: [
        {
          parts: [
            {
              text: `${displayName}: ${userMessage}${researchContext ? `\n\nLocal bot data, if useful:\n${researchContext}` : ""}\n\nYou MUST use Google Search grounding for current factual questions, item buy locations, ship loadouts, guides, prices, patches, and Star Citizen gameplay facts. Search the open web, compare sources, then answer with the best practical answer. Include source links. If local bot data conflicts with grounded Google Search results, prefer grounded Google Search.`
            }
          ]
        }
      ],
      tools: [
        {
          google_search: {}
        }
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 650
      }
    })
  });

  if (!response.ok) {
    throw new ApiError(`Gemini request failed: ${response.statusText}`, response.status);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n").trim();

  if (!text) {
    throw new ApiError("Gemini returned no text");
  }

  const sources = geminiSources(data);
  if (!sources) {
    throw new ApiError("Gemini did not return grounded web sources");
  }

  return `${text}${sources}`.trim().slice(0, 1800);
}

export function aiProviderLabel() {
  if (config.geminiApiKey) return `Gemini web search (${config.geminiModel})`;
  if (config.groqApiKey) return `Groq text only (${config.groqModel})`;
  return "No AI provider configured";
}

export function aiEnvDebugLabel() {
  const geminiKeys = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GEMINI_API_KEY"];
  const presentGeminiNames = geminiKeys.filter((name) => Boolean(process.env[name]?.trim()));
  const nearbyEnvNames = Object.keys(process.env)
    .filter((name) => /gemini|google/i.test(name))
    .sort();

  return [
    `Gemini env present: ${presentGeminiNames.length ? presentGeminiNames.join(", ") : "no"}`,
    `Gemini key loaded: ${config.geminiApiKey ? "yes" : "no"}`,
    `Gemini key length: ${config.geminiApiKey.length}`,
    `Gemini model: ${config.geminiModel}`,
    `Gemini-like env names: ${nearbyEnvNames.length ? nearbyEnvNames.join(", ") : "none"}`
  ].join(" | ");
}
