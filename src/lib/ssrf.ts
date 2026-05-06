// SSRF guard for the URL scrape feature.
//
// Goal: only allow public, http(s) URLs. Block:
//   - non-http schemes (file://, ftp://, gopher://, javascript:, data:, …)
//   - hostnames that resolve to private/loopback/link-local IP ranges
//   - redirects whose final destination violates the above
//
// We resolve DNS (`dns.lookup`) and inspect every address. This is best-effort
// — a determined attacker could still TOCTOU us with DNS rebinding, but this
// closes the common cases (someone pasting `http://169.254.169.254` to scrape
// AWS metadata, `http://localhost:6379` to poke our own Redis, etc.).

import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import net from "node:net";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const MAX_FETCH_TIMEOUT_MS = 10_000;
const MAX_FETCH_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_REDIRECTS = 3;

export type SafeFetchResult =
  | { ok: true; finalUrl: string; contentType: string; text: string }
  | { ok: false; error: string };

function ipIsPrivate(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map((p) => Number(p));
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local (incl. AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("::ffff:")) {
      // IPv4-mapped — apply v4 rules
      return ipIsPrivate(lower.replace("::ffff:", ""));
    }
    return false;
  }
  // Not a literal IP — caller should have resolved DNS already.
  return true;
}

async function hostnameIsSafe(hostname: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  // If it's already an IP literal, validate directly.
  if (net.isIP(hostname) > 0) {
    return ipIsPrivate(hostname)
      ? { safe: false, reason: "URL resolves to a private IP." }
      : { safe: true };
  }

  // Block obvious internal-looking hostnames quickly.
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local") || lower.endsWith(".internal")) {
    return { safe: false, reason: "URL resolves to a private hostname." };
  }

  let addrs: LookupAddress[];
  try {
    addrs = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { safe: false, reason: "Could not resolve URL hostname." };
  }
  if (addrs.length === 0) {
    return { safe: false, reason: "Could not resolve URL hostname." };
  }
  for (const a of addrs) {
    if (ipIsPrivate(a.address)) {
      return { safe: false, reason: "URL resolves to a private IP." };
    }
  }
  return { safe: true };
}

export async function validateUrl(rawUrl: string): Promise<
  | { ok: true; url: URL }
  | { ok: false; error: string }
> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Not a valid URL." };
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      ok: false,
      error: "Only http:// and https:// URLs are supported.",
    };
  }
  const safety = await hostnameIsSafe(parsed.hostname);
  if (!safety.safe) {
    return { ok: false, error: safety.reason ?? "URL is not safe to fetch." };
  }
  return { ok: true, url: parsed };
}

export async function safeFetch(rawUrl: string): Promise<SafeFetchResult> {
  let currentUrl = rawUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const validation = await validateUrl(currentUrl);
    if (!validation.ok) return { ok: false, error: validation.error };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      MAX_FETCH_TIMEOUT_MS
    );

    let res: Response;
    try {
      res = await fetch(validation.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 CRMIN/1.0",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });
    } catch (err) {
      clearTimeout(timeout);
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "URL fetch timed out (10s)."
          : `URL fetch failed: ${err instanceof Error ? err.message : "unknown"}`;
      return { ok: false, error: msg };
    }
    clearTimeout(timeout);

    // Handle redirects manually so we can re-validate the destination.
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return { ok: false, error: "Redirect without Location." };
      currentUrl = new URL(next, validation.url).toString();
      continue;
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `URL returned HTTP ${res.status}.`,
      };
    }

    const contentType = (res.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (
      contentType &&
      !contentType.startsWith("text/") &&
      contentType !== "application/xhtml+xml" &&
      contentType !== "application/json"
    ) {
      return {
        ok: false,
        error: `URL returned non-HTML content (${contentType}).`,
      };
    }

    // Bounded read.
    if (!res.body) return { ok: false, error: "URL returned empty body." };
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FETCH_BYTES) {
        try {
          await reader.cancel();
        } catch {}
        return {
          ok: false,
          error: "URL response exceeds 5 MB cap.",
        };
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const text = buf.toString("utf8");
    return { ok: true, finalUrl: currentUrl, contentType, text };
  }
  return { ok: false, error: "Too many redirects." };
}
