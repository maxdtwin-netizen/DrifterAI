import { ApiError } from "./errors.js";

type JsonRequestOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: string;
};

const lastRequestByHost = new Map<string, number>();

function minDelayForHost(host: string) {
  if (host.includes("uexcorp")) return 550;
  if (host.includes("star-citizen.wiki")) return 1050;
  if (host.includes("starcitizen-api")) return 750;
  return 250;
}

async function respectRateLimit(url: URL) {
  const host = url.host;
  const delay = minDelayForHost(host);
  const lastRequestAt = lastRequestByHost.get(host) ?? 0;
  const waitMs = lastRequestAt + delay - Date.now();

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  lastRequestByHost.set(host, Date.now());
}

export async function fetchJson<T>(url: URL | string, options: JsonRequestOptions = {}): Promise<T> {
  const requestUrl = typeof url === "string" ? new URL(url) : url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);

  try {
    await respectRateLimit(requestUrl);

    const response = await fetch(requestUrl, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "StarCitizenOrgDiscordBot/1.0",
        ...options.headers
      },
      body: options.body,
      signal: controller.signal
    });

    if (response.status === 429) {
      throw new ApiError("Rate limited", response.status, true);
    }

    if (!response.ok) {
      throw new ApiError(response.statusText, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof Error ? error.message : "Request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(url: URL | string, options: JsonRequestOptions = {}): Promise<string> {
  const requestUrl = typeof url === "string" ? new URL(url) : url;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);

  try {
    await respectRateLimit(requestUrl);

    const response = await fetch(requestUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, text/plain",
        "User-Agent": "DrifterAI-StarCitizenOrgBot/1.0",
        ...options.headers
      },
      signal: controller.signal
    });

    if (response.status === 429) {
      throw new ApiError("Rate limited", response.status, true);
    }

    if (!response.ok) {
      throw new ApiError(response.statusText, response.status);
    }

    return response.text();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error instanceof Error ? error.message : "Request failed");
  } finally {
    clearTimeout(timeout);
  }
}
