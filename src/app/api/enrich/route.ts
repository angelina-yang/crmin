import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "@/lib/auth";
import { getSession } from "@/lib/kv";
import { enrichOne, type EnrichInput } from "@/lib/enricher";

// Cap the function lifetime at 60s. The enricher does up to 3 web_search
// rounds + model turns per contact, so a single contact can take 30-50s
// in the worst case; 60s keeps us bounded and lets the client's
// 90s AbortController catch any pathological hang cleanly.
export const maxDuration = 60;

const MAX_BATCH = 20;

export async function POST(req: NextRequest) {
  // Gate behind a verified session — the server doesn't store user campaigns,
  // but we still don't want anonymous users hammering the function and our
  // egress bandwidth.
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

  const { anthropicKey, rows } = body as Partial<{
    anthropicKey: string;
    rows: Array<{ id: string; name: string; company: string; role?: string | null }>;
  }>;

  if (typeof anthropicKey !== "string" || !anthropicKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "Anthropic API key is required (paste it in Settings)." },
      { status: 400 }
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "rows is required and must be a non-empty array." },
      { status: 400 }
    );
  }

  if (rows.length > MAX_BATCH) {
    return NextResponse.json(
      {
        error: `Batch too large. Max ${MAX_BATCH} rows per request — split into smaller batches.`,
      },
      { status: 400 }
    );
  }

  // Resolve sequentially. Each contact runs its own multi-step web_search
  // loop, so even at 20 rows the total wall time stays manageable while we
  // avoid concurrent API rate-limit pressure.
  const results: Array<{
    id: string;
    linkedinUrl: string | null;
    notes: string;
    error?: string;
  }> = [];

  for (const row of rows) {
    if (!row?.id || !row?.name || !row?.company) {
      results.push({
        id: row?.id ?? "",
        linkedinUrl: null,
        notes: "",
        error: "missing id/name/company",
      });
      continue;
    }
    const input: EnrichInput = {
      name: row.name,
      company: row.company,
      role: row.role ?? null,
    };
    try {
      const result = await enrichOne(input, anthropicKey);
      results.push({
        id: row.id,
        linkedinUrl: result.linkedinUrl,
        notes: result.notes,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "enrichment failed";
      console.error(
        `[enrich] ${row.name} <${row.company}> failed:`,
        message
      );
      results.push({
        id: row.id,
        linkedinUrl: null,
        notes: "",
        error: message,
      });
    }
  }

  return NextResponse.json({ results });
}
