// LinkedIn URL enrichment via Claude + built-in web_search.
//
// Adapted from podcast-crm/src/lib/enricher.ts. Differences:
//   - BYOK: caller passes the Anthropic key in per call (no env fallback).
//   - The AI-company classifier is removed. We only resolve LinkedIn URLs.
//   - Search budget tightened to 3 lookups per contact.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a research assistant resolving LinkedIn profile URLs for a contact list.

For each person you receive (name + company, optionally role), use the web_search tool exactly ONCE to find their personal LinkedIn profile URL.

Search strategy:
1. Search for "{name}" "{company}" linkedin
2. From the single set of results, find the personal LinkedIn profile URL that best matches the provided name AND company (and role if given).
3. If no confident match appears in this single search, set linkedin_url to null. Do not search again. Do not guess.

You have ONE search per contact. Speed and a low false-positive rate matter more than coverage. If the first result does not give you a confident match, returning null is the correct answer.

Call record_findings exactly once with your conclusion. Return personal profile URLs only — they look like https://www.linkedin.com/in/<slug>. Company pages (linkedin.com/company/...) are NOT acceptable. If you cannot find a personal profile URL with confidence, set linkedin_url to null rather than guess.`;

const RECORD_FINDINGS_TOOL: Anthropic.Tool = {
  name: "record_findings",
  description:
    "Record the final research findings for this contact. Call exactly once after you have completed your research.",
  input_schema: {
    type: "object",
    properties: {
      linkedin_url: {
        type: ["string", "null"],
        description:
          "Personal LinkedIn profile URL (https://www.linkedin.com/in/...). Null if not found with confidence.",
      },
      notes: {
        type: "string",
        description:
          "Optional 1-sentence note: why this URL is the right match, or why it was hard to find.",
      },
    },
    required: ["linkedin_url", "notes"],
  },
};

export type EnrichInput = {
  name: string;
  company: string;
  role?: string | null;
};

export type EnrichResult = {
  linkedinUrl: string | null;
  notes: string;
};

function buildUserMessage(input: EnrichInput): string {
  return [
    `Name: ${input.name}`,
    `Company: ${input.company}`,
    input.role ? `Role: ${input.role}` : null,
    "",
    "Resolve their LinkedIn profile URL per your instructions and call record_findings with the result.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function enrichOne(
  input: EnrichInput,
  apiKey: string
): Promise<EnrichResult> {
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserMessage(input) },
  ];

  const tools: Anthropic.ToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      // ONE search per contact. Speed and predictable cost (~$0.05 per
      // contact ceiling) over coverage. Null result is fine — user falls
      // back to Search Google or Paste URL on missed rows.
      max_uses: 1,
    } as Anthropic.ToolUnion,
    RECORD_FINDINGS_TOOL,
  ];

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  for (let iter = 0; iter < 8; iter++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemBlocks,
      tools,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      const recordBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === "tool_use" && b.name === "record_findings"
      );
      if (recordBlock) {
        const out = recordBlock.input as Partial<EnrichResult> & {
          linkedin_url?: string | null;
        };
        return {
          linkedinUrl: normalizeLinkedIn(out.linkedin_url ?? null),
          notes: out.notes ?? "",
        };
      }
      // Other tool_use (web_search) is server-side; resume by re-sending the
      // assistant turn back to the model.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "pause_turn") {
      // web_search hit its iteration limit; resume by re-sending.
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    if (response.stop_reason === "end_turn") {
      // Model returned text without calling record_findings — nudge it.
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content:
          "Call record_findings now with your conclusion, even if uncertain. Set linkedin_url to null if you cannot find a personal profile URL with confidence.",
      });
      continue;
    }

    if (response.stop_reason === "refusal") {
      return {
        linkedinUrl: null,
        notes: "model declined to research this contact",
      };
    }

    // max_tokens or other — bail
    break;
  }

  return {
    linkedinUrl: null,
    notes: "enrichment loop exhausted without record_findings",
  };
}

function normalizeLinkedIn(url: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (!/linkedin\.com\/in\//i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}
