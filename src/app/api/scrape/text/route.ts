import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "@/lib/auth";
import { getSession, consumeScrapeQuota, refundScrapeQuota } from "@/lib/kv";
import { extractCandidates } from "@/lib/scraper";

const MAX_PASTE_BYTES = 100_000; // 100 KB

// Paste-text fallback for the URL scrape feature. Used when fetch returns
// nothing usable (e.g. JS-rendered page). The user pastes the visible text
// of the page directly. NO URL is logged here — the input is private to
// the user; we only log public URLs they ask us to fetch.

export async function POST(req: NextRequest) {
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

  const { text, anthropicKey } = body as Partial<{
    text: string;
    anthropicKey: string;
  }>;

  if (typeof text !== "string" || text.trim().length < 10) {
    return NextResponse.json(
      { error: "Paste at least a few lines of page text." },
      { status: 400 }
    );
  }
  if (text.length > MAX_PASTE_BYTES) {
    return NextResponse.json(
      {
        error: `Pasted text exceeds 100 KB. Trim it down to the part of the page that lists people.`,
      },
      { status: 400 }
    );
  }
  if (typeof anthropicKey !== "string" || !anthropicKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "Anthropic API key is required (paste it in Settings)." },
      { status: 400 }
    );
  }

  // Same daily cap as the URL scrape route.
  const quota = await consumeScrapeQuota(session.email);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Daily scrape limit reached (${quota.cap}/day). Larger batches? Email Angelina — we build bespoke versions for teams.`,
        code: "rate_limit",
      },
      { status: 429 }
    );
  }

  let result;
  try {
    result = await extractCandidates({
      apiKey: anthropicKey,
      source: "paste",
      sourceLabel: "(pasted page text)",
      rawContent: text,
    });
  } catch (err) {
    await refundScrapeQuota(session.email);
    const message =
      err instanceof Error ? err.message : "extraction failed";
    console.error("[scrape:text] extract error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  console.log(
    `[scrape:text] ${session.email.slice(0, 3)}… extracted ${result.candidates.length} from paste`
  );

  return NextResponse.json({
    candidates: result.candidates,
    notes: result.notes,
    quota: { used: quota.used, cap: quota.cap },
  });
}
