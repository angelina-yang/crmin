// Client-side data model for CRM;IN. Everything in this file lives in
// localStorage — campaigns, contacts, message templates. The server only
// holds auth state and the aggregate URL log.

export type ContactStatus =
  | "Pending" // never sent
  | "ResolvingLinkedIn" // enrichment in flight (Stage 3)
  | "NoLinkedIn" // enrichment couldn't find a URL
  | "Sent" // first message sent, follow-up window not yet elapsed
  | "FollowUpDue" // follow-up window has elapsed
  | "Replied" // user marked Replied — archived
  | "Skipped"; // user skipped — archived

export type Contact = {
  id: string;
  name: string;
  firstName: string; // derived from name
  company: string;
  role: string | null;
  linkedinUrl: string | null;
  notes: string;
  status: ContactStatus;
  sentAt: number | null;
  followUpAt: number | null; // sentAt + followUpDelayDays * 86400000
  followUpSentAt: number | null;
  repliedAt: number | null;
  createdAt: number;
};

export type Templates = {
  message1: string;
  followUp: string;
  followUpDelayDays: number;
  senderName: string;
};

export type Campaign = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  templates: Templates;
  contacts: Contact[];
};

export type AppState = {
  byokKey: string | null; // Anthropic API key, used for Stage 3+ enrichment
  activeCampaignId: string | null;
  campaigns: Campaign[];
};

export const DEFAULT_TEMPLATES: Templates = {
  message1:
    "Hi {first_name}, I came across {company} and wanted to say hi.\n\n— {sender}",
  followUp:
    "Hi {first_name}, just bumping this up in case it got buried.\n\n— {sender}",
  followUpDelayDays: 5,
  senderName: "",
};

export function emptyAppState(): AppState {
  return {
    byokKey: null,
    activeCampaignId: null,
    campaigns: [],
  };
}

export function deriveFirstName(full: string): string {
  const cleaned = full.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").trim();
  const first = cleaned.split(/\s+/)[0];
  return first || full;
}

// Render a template by substituting placeholders with contact + sender values.
// Unknown placeholders pass through unchanged so the user notices typos.
export function renderTemplate(
  template: string,
  ctx: {
    name: string;
    firstName: string;
    company: string;
    role: string | null;
    sender: string;
  }
): string {
  return template
    .replaceAll("{name}", ctx.name)
    .replaceAll("{first_name}", ctx.firstName)
    .replaceAll("{company}", ctx.company)
    .replaceAll("{role}", ctx.role ?? "")
    .replaceAll("{sender}", ctx.sender);
}
