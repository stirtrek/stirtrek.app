import type { SessionizeResponse } from "./types";

const SESSIONIZE_BASE_URL = "https://sessionize.com/api/v2";

/**
 * Fetch data from the Sessionize API for the given API ID.
 */
export async function fetchSessionizeData(
  apiId: string,
): Promise<SessionizeResponse> {
  if (!apiId) {
    throw new Error("No Sessionize API ID provided");
  }

  const resolvedApiId = apiId;

  const response = await fetch(
    `${SESSIONIZE_BASE_URL}/${resolvedApiId}/view/All`,
    {
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Sessionize API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
