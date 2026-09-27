/**
 * SSRF / input guard for user-supplied website URLs.
 * Blocks non-http(s), localhost, private networks, and non-standard ports.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  return false;
}

export function isAllowedUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return false;
  if (host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isPrivateIPv4(host)) return false;

  // Only allow default ports to avoid probing internal services
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") return false;

  return true;
}

export function normalizeCrawlOptions(options?: {
  maxDepth?: number;
  maxPages?: number;
  useJavaScript?: boolean;
}): { maxDepth: number; maxPages: number; useJavaScript: boolean } {
  const maxDepth = Math.min(
    Math.max(options?.maxDepth ?? 3, 0),
    5
  );
  const maxPages = Math.min(
    Math.max(options?.maxPages ?? 100, 1),
    200
  );
  return {
    maxDepth,
    maxPages,
    useJavaScript: options?.useJavaScript ?? false,
  };
}
