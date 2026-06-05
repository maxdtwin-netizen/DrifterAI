export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly rateLimited = false
  ) {
    super(message);
  }
}

export class NoResultsError extends Error {}

export class AmbiguousResultError extends Error {
  constructor(public readonly names: string[]) {
    super(`Multiple matches: ${names.join(", ")}`);
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof NoResultsError) {
    return "No target found. Check the name and try again.";
  }

  if (error instanceof AmbiguousResultError) {
    return `Too many possible targets. Try one of: ${error.names.slice(0, 8).join(", ")}`;
  }

  if (error instanceof ApiError) {
    if (error.message.includes("not configured")) return "API key not configured.";
    if (error.rateLimited) return "Source is rate-limiting us. Hold position and try again shortly.";
    return `Source is unavailable right now${error.status ? ` (${error.status})` : ""}.`;
  }

  return "Something jammed in the airlock. Try again in a moment.";
}
