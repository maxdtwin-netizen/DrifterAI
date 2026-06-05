import { cache, ttl } from "../utils/cache.js";
import { fetchText } from "../utils/http.js";

export type NewsItem = {
  title: string;
  link: string;
  description?: string;
  publishedAt?: string;
};

const rsiCommLinkRss = "https://robertsspaceindustries.com/en/comm-link/rss";
const rsiBaseUrl = "https://robertsspaceindustries.com";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function tagValue(itemXml: string, tag: string) {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : undefined;
}

function parseRss(xml: string): NewsItem[] {
  const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => match[0]);

  const rssItems = items
    .map((item) => ({
      title: tagValue(item, "title") ?? "RSI Comm-Link",
      link: tagValue(item, "link") ?? "https://robertsspaceindustries.com/en/comm-link",
      description: tagValue(item, "description"),
      publishedAt: tagValue(item, "pubDate")
    }))
    .filter((item) => item.link);

  if (rssItems.length > 0) return rssItems;

  return parseCommLinkHtml(xml);
}

function parseCommLinkHtml(html: string): NewsItem[] {
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  const anchorMatches = html.matchAll(/<a\b[^>]*href=["']([^"']*\/comm-link\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const match of anchorMatches) {
    const rawHref = match[1];
    const body = decodeXml(match[2]).replace(/\s+/g, " ").trim();
    if (!body || /^(all|transmission|engineering|citizens|spectrum dispatch|serialized fiction)$/i.test(body)) continue;

    const link = rawHref.startsWith("http") ? rawHref : `${rsiBaseUrl}${rawHref}`;
    if (seen.has(link)) continue;
    seen.add(link);

    const title = body
      .replace(/\b(post|video|slideshow|poll)\b/gi, "")
      .replace(/\b\d+\b\s*Posted:.*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || title.length < 4) continue;

    const postedMatch = body.match(/Posted:\s*([^\.]+?)(?=\s[A-Z0-9]|\s*$)/i);
    const description = body
      .replace(title, "")
      .replace(/\b(post|video|slideshow|poll)\b/gi, "")
      .replace(/\b\d+\b/g, "")
      .replace(/Posted:\s*[^\.]+/i, "")
      .replace(/\s+/g, " ")
      .trim();

    items.push({
      title,
      link,
      description: description || "Official RSI Comm-Link post.",
      publishedAt: postedMatch?.[1]
    });
  }

  if (items.length > 0) return items.slice(0, 20);

  const text = decodeXml(html).replace(/\s+/g, " ");
  const fallbackMatches = text.matchAll(/\b(post|video)\s+(.+?)\s+\d+\s+Posted:\s+(.+?)(?=\s+\b(post|video)\b|$)/gi);
  for (const match of fallbackMatches) {
    const titleAndDescription = match[2].trim();
    const [title, ...rest] = titleAndDescription.split(/(?<=\.)\s+/);
    const slug = title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    items.push({
      title: title.trim(),
      link: `${rsiBaseUrl}/en/comm-link`,
      description: rest.join(" ") || "Official RSI Comm-Link post.",
      publishedAt: match[3].trim()
    });
    if (!slug && items.length > 0) break;
  }

  return items.slice(0, 20);
}

export async function getLatestNews(limit = 5) {
  return cache.remember("rsi:comm-link:rss", ttl.minutes(30), async () => {
    const xml = await fetchText(rsiCommLinkRss);
    return parseRss(xml);
  }).then((items) => items.slice(0, limit));
}

export async function getLatestPatchNotes(limit = 3) {
  const items = await getLatestNews(25);
  const patchItems = items.filter((item) =>
    /patch|release notes|alpha|live deployment|ptu/i.test(`${item.title} ${item.description ?? ""}`)
  );
  return (patchItems.length ? patchItems : items).slice(0, limit);
}

export const newsSourceUrl = rsiCommLinkRss;
