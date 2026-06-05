import { cache, ttl } from "../utils/cache.js";
import { fetchText } from "../utils/http.js";
import { config } from "../config.js";

export type ExecutiveHangarStatus = {
  source: string;
  status: string;
  timer?: string;
  nextChange?: string;
  summary: string;
};

const minute = 60 * 1000;
const redMs = 120 * minute;
const greenMs = 60 * minute;
const blackMs = 5 * minute;
const cycleMs = redMs + greenMs + blackMs;

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

function calculateExecutiveHangarStatus(): ExecutiveHangarStatus {
  const anchor = new Date(config.execHangarCycleResetUtc).getTime();
  const now = Date.now();
  const elapsed = ((now - anchor) % cycleMs + cycleMs) % cycleMs;

  if (elapsed < redMs) {
    const opensIn = redMs - elapsed;
    return {
      source: "https://contestedzonetimers.com/",
      status: "Hangar Closed",
      timer: formatDuration(opensIn),
      nextChange: `Opens in ${formatDuration(opensIn)}`,
      summary: `Executive hangar is **closed**. Opens in **${formatDuration(opensIn)}**.\nhttps://contestedzonetimers.com/`
    };
  }

  if (elapsed < redMs + greenMs) {
    const resetsIn = redMs + greenMs - elapsed;
    return {
      source: "https://contestedzonetimers.com/",
      status: "Hangar Open",
      timer: formatDuration(resetsIn),
      nextChange: `Resets in ${formatDuration(resetsIn)}`,
      summary: `Executive hangar is **open**. Resets in **${formatDuration(resetsIn)}**.\nhttps://contestedzonetimers.com/`
    };
  }

  const resetIn = cycleMs - elapsed;
  const opensIn = resetIn + redMs;
  return {
    source: "https://contestedzonetimers.com/",
    status: "Blackout / Resetting",
    timer: formatDuration(resetIn),
    nextChange: `Cycle resets in ${formatDuration(resetIn)}`,
    summary: `Executive hangar is in **blackout/reset**. Cycle resets in **${formatDuration(resetIn)}**; next opening in **${formatDuration(opensIn)}**.\nhttps://contestedzonetimers.com/`
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseCzTimer(html: string): ExecutiveHangarStatus | undefined {
  const text = stripHtml(html);
  const statusMatch = text.match(/\b(GREEN PHASE|RED PHASE|Hangar Open|Hangar Closed)[\s\S]{0,160}/i);
  const timerMatch = text.match(/\b\d{1,2}:\d{2}:\d{2}\b/);
  const opensAt = text.match(/\b(Opens at|Closes at|Resets in|Time Until Opening|Time Until Closing)\s*([^\n]+)/i);

  if (!statusMatch && !timerMatch) return undefined;

  const statusText = statusMatch?.[0] ?? "Executive Hangar timer found";
  const status = /green|open/i.test(statusText) ? "Hangar Open" : /red|closed/i.test(statusText) ? "Hangar Closed" : statusText;

  return {
    source: "https://cztimer.com/",
    status,
    timer: timerMatch?.[0],
    nextChange: opensAt ? `${opensAt[1]} ${opensAt[2]}`.trim() : undefined,
    summary:
      `${status}${timerMatch ? `, timer ${timerMatch[0]}` : ""}${opensAt ? `, ${opensAt[1]} ${opensAt[2]}` : ""}. ` +
      "This is a community timer; verify in-game before committing cards."
  };
}

function parseContestedZoneTimers(html: string): ExecutiveHangarStatus | undefined {
  const text = stripHtml(html);
  const timerMatch = text.match(/Executive Hangar Timer\s*(\d{1,2}:\d{2}:\d{2})/i);
  const patchMatch = text.match(/Timer is updated for ([^\n]+)/i);

  if (!timerMatch) return undefined;

  if (timerMatch[1] === "00:00:00") {
    return {
      source: "https://contestedzonetimers.com/",
      status: "Browser-rendered timer",
      summary:
        `contestedzonetimers.com is reachable${patchMatch ? ` (${patchMatch[1].trim()})` : ""}, but the exact open/closed state is rendered in the browser and was not present in the static fetch. ` +
        "Use the live page for the visual timer and light status: https://contestedzonetimers.com/"
    };
  }

  return {
    source: "https://contestedzonetimers.com/",
    status: "Timer page reachable",
    timer: timerMatch[1],
    summary:
      `contestedzonetimers.com reports timer ${timerMatch[1]}${patchMatch ? ` (${patchMatch[1].trim()})` : ""}. ` +
      "Open the live page for the visual light/open status: https://contestedzonetimers.com/"
  };
}

export async function getExecutiveHangarStatus() {
  return cache.remember("exec-hangar:status", ttl.minutes(1), async () => {
    const calculated = calculateExecutiveHangarStatus();
    const sources = [
      { url: "https://contestedzonetimers.com/", parser: parseContestedZoneTimers },
      { url: "https://cztimer.com/", parser: parseCzTimer }
    ];

    const results: ExecutiveHangarStatus[] = [];
    for (const source of sources) {
      try {
        const html = await fetchText(source.url, { timeoutMs: 15000 });
        const parsed = source.parser(html);
        if (parsed) results.push(parsed);
      } catch {
        continue;
      }
    }

    const precise = results.find((result) => /open|closed/i.test(result.status) && result.source.includes("cztimer"));
    if (precise?.timer && precise.timer !== "00:00:00") return precise;
    return calculated;

  });
}
