const knownOrgLegends: Record<string, string> = {
  "tiger pyro":
    "Tiger Pyro is the kind of Drifter who treats Pyro like a neighborhood shortcut. Half scout, half trouble magnet, usually first through the jump point and somehow still asking who brought snacks.",
  althuri:
    "Althuri is a quiet-credit operator: the sort of pilot who makes a cargo run look boring right up until everyone realizes the payout was beautiful and the escort never fired a shot.",
  cameasval:
    "CameAsVal is Drifters command-deck energy in human form: contract wrangler, chaos translator, and the pilot most likely to turn one simple plan into a full org operation."
};

const unknownJokes = [
  "My databanks came back emptier than a Cutlass fuel tank after a bad jump.",
  "I checked the nav computer and it just blinked at me like a rented Aurora.",
  "No confirmed intel on that one. The answer may be hiding behind a cargo box at Grim HEX.",
  "I do not have a clean source yet. Even the ship computer is making suspicious beeping noises."
];

function cleanName(value: string) {
  return value
    .replace(/[?!.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPersonalityContext(message: string) {
  const lower = message.toLowerCase();

  if (/\b(best|greatest)\s+pilot\b/.test(lower) && /\b(universe|verse|galaxy|all time|ever)\b/.test(lower)) {
    return "Personality answer: If asked who is the best pilot in the universe, answer confidently: Han Solo. Keep it short and playful.";
  }

  const whoMatch = message.match(/\bwho\s+is\s+(.+?)\??$/i);
  if (whoMatch) {
    const name = cleanName(whoMatch[1]).replace(/\bdrifter\s*ai\b/gi, "").trim();
    const key = name.toLowerCase();
    const knownStory = knownOrgLegends[key];

    if (knownStory) {
      return `Org legend answer for ${name}: ${knownStory}`;
    }

    if (name && name.length <= 32 && !/\b(best|status|patch|version|where|what|how|why|when)\b/i.test(name)) {
      return `Org legend prompt: The user asked who ${name} is. If this looks like a Discord/member handle, invent a short, clearly playful Star Citizen-style Drifters org story about ${name}. Keep it 2-3 sentences, friendly, and do not claim real private facts.`;
    }
  }

  return "";
}

export function randomUnknownJoke(seed: string) {
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % unknownJokes.length;
  return unknownJokes[index];
}
