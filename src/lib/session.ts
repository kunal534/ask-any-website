/**
 * Canonical sessionId <-> URL mapping.
 *
 * Historical code reconstructed the URL from the sessionId with fragile
 * string replaces (`_` -> `.`), which breaks for paths, dashes, ports, etc.
 * The canonical mapping is one-way:
 *   sessionId = `session_${url.replace(/[^a-zA-Z0-9]/g, '_')}`
 * and the reverse lookup MUST go through the `indexed-urls` Redis set.
 */

export function sessionIdForUrl(url: string): string {
  return `session_${url.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export function resolveUrlFromSessionId(
  sessionId: string,
  indexedUrls: string[] | null | undefined
): string | null {
  if (!sessionId.startsWith("session_")) return null;
  if (!indexedUrls || indexedUrls.length === 0) return null;

  for (const url of indexedUrls) {
    if (sessionIdForUrl(url) === sessionId) return url;
  }
  return null;
}
