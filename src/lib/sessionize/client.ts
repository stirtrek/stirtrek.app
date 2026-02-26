import type { SessionizeResponse } from "./types";

const SESSIONIZE_BASE_URL = "https://sessionize.com/api/v2";

export async function fetchSessionizeData(): Promise<SessionizeResponse> {
  const apiId = process.env.SESSIONIZE_API_ID;
  if (!apiId) {
    throw new Error("SESSIONIZE_API_ID environment variable is not set");
  }

  const response = await fetch(`${SESSIONIZE_BASE_URL}/${apiId}/view/All`, {
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(
      `Sessionize API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
