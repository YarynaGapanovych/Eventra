/** Long enough for a free-tier server to wake from sleep. */
export const API_REQUEST_TIMEOUT_MS = 60_000;

export class ApiTimeoutError extends Error {
  constructor() {
    super(
      "The server didn't respond. It may be waking up or unavailable — try again in a minute.",
    );
    this.name = "ApiTimeoutError";
  }
}

export function isApiTimeoutError(error: unknown): error is ApiTimeoutError {
  return error instanceof ApiTimeoutError;
}

/** fetch() that gives up after API_REQUEST_TIMEOUT_MS instead of hanging forever. */
export async function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiTimeoutError();
    }
    throw error;
  }
}
