import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "@/lib/auth";
import {
  getSession,
  consumeScrapeQuota,
  refundScrapeQuota,
  appendUrlLog,
} from "@/lib/kv";
import { safeFetch } from "@/lib/ssrf";
import { extractCandidates } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  // Auth gate
  const sessionToken = await getSessionCookie();
  if (!sessionToken) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const session = await getSession(sessionToken);
  if (!session) {
    return NextResponse.json(
      { error: "Session expired." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { url, anthropicKey } = body as Partial<{
    url: string;
    anthropicKey: string;
  }>;

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json(
      { error: "url is required." },
      { status: 400 }
    );
  }
  if (typeof anthropicKey !== "string" || !anthropicKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "Anthropic API key is required (paste it in Settings)." },
      { status: 400 }
    );
  }

  // Daily rate limit, 5 scrapes / verified email / day.
  const quota = await consumeScrapeQuota(session.email);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Daily scrape limit reached (${quota.cap}/day). Larger batches? Email Angelina — we build bespoke versions for teams.`,
        code: "rate_limit",
        used: quota.used,
        cap: quota.cap,
      },
      { status: 429 }
    );
  }

  // SSRF-guarded fetch
  const fetched = await safeFetch(url.trim());
  if (!fetched.ok) {
    // Refund the quota slot — we never reached Claude.
    await refundScrapeQuota(session.email);
    return NextResponse.json({ error: fetched.error }, { status: 400 });
  }

  // Append to anonymous URL log (NOT keyed to user — see PROJECT.md privacy)
  try {
    await appendUrlLog(fetched.finalUrl);
  } catch (err) {
    console.error("[scrape] urllog append failed:", err);
  }

  // Extract candidates via Claude
  let result;
  try {
    result = await extractCandidates({
      apiKey: anthropicKey,
      source: "url",
      sourceLabel: fetched.finalUrl,
      rawContent: fetched.text,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "extraction failed";
    console.error("[scrape] extract error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  console.log(
    `[scrape] ${session.email.slice(0, 3)}… extracted ${result.candidates.length} from ${fetched.finalUrl}`
  );

  return NextResponse.json({
    candidates: result.candidates,
    notes: result.notes,
    quota: { used: quota.used, cap: quota.cap },
    finalUrl: fetched.finalUrl,
  });
}
