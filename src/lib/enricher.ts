// LinkedIn URL enrichment via Claude + built-in web_search.
//
// Adapted from podcast-crm/src/lib/enricher.ts. Differences:
//   - BYOK: caller passes the Anthropic key in per call (no env fallback).
//   - The AI-company classifier is removed. We only resolve LinkedIn URLs.
//   - Search budget tightened to 3 lookups per contact.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a research assistant resolving LinkedIn profile URLs for a contact list.

For each person you receive (name + company, optionally role), use the web_search tool to find their personal LinkedIn profile URL.

Search strategy:
1. First search: use a LinkedIn-constrained query to focus results on profile pages.
   Format: "{name}" "{company}" site:linkedin.com/in
2. From the results, find the personal LinkedIn profile URL that matches the provided name AND company.
3. TRUST the top result when it clearly matches: if a result on linkedin.com/in/ has the person's name in the page title or URL slug and the company appears in the snippet, ACCEPT it as the answer. The URL slug does not need to perfectly match the name spelling — LinkedIn slugs vary (e.g. "shuffman56" for Steve Huffman).
4. Only if the first search returns truly ambiguous results (e.g. multiple people with the same name and you cannot tell from the snippets which one is at the right company), perform ONE more search with a refined query: include the role, or use a different phrasing.
5. If after these two searches you still cannot identify a confident match, set linkedin_url to null.

You have at most 2 web searches per contact. Use them efficiently. Returning null is the correct answer when you genuinely cannot find a match — but do not return null when the top result of the first search clearly matches the name and company.

Call record_findings exactly once with your conclusion. Return personal profile URLs only — they look like https://www.linkedin.com/in/<slug>. Company pages (linkedin.com/company/...) are NOT acceptable.`;

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
      // Up to 2 searches per contact: one LinkedIn-constrained search,
      // optional refinement with role if the first is ambiguous.
      // Per-contact cost ~$0.04-0.08, wall time ~15-25s, well under
      // the 60s server timeout.
      max_uses: 2,
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
