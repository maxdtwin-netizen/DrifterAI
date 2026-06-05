import { EmbedBuilder } from "discord.js";

export const embedColor = 0xb92727;
export const sourceFooter = "Data from public/community sources; verify in-game.";

export function baseEmbed(title: string) {
  return new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(title)
    .setFooter({ text: sourceFooter })
    .setTimestamp();
}

export function fieldValue(value: unknown, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return String(value);
}

export function numberValue(value: unknown, suffix = "") {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return "Unknown";
  return `${parsed.toLocaleString()}${suffix}`;
}

export function trimText(value: unknown, max = 900) {
  const text = fieldValue(value, "");
  if (!text) return "No public briefing available.";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function relativeTime(dateLike: unknown) {
  if (!dateLike) return "Unknown";
  const date = new Date(String(dateLike));
  if (Number.isNaN(date.getTime())) return String(dateLike);
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

export function validUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
