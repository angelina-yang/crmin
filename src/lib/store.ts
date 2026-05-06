"use client";

import { useEffect, useState, useCallback } from "react";
import {
  type AppState,
  type Campaign,
  type Contact,
  type Templates,
  type ContactStatus,
  emptyAppState,
  DEFAULT_TEMPLATES,
  deriveFirstName,
} from "./types";

const STORAGE_KEY = "crmin:state:v1";

// Generate a short id. Using crypto.randomUUID where available, falling back
// to a Math.random base36 string for very old browsers.
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readStorage(): AppState {
  if (typeof window === "undefined") return emptyAppState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAppState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== "object") return emptyAppState();
    return {
      byokKey: typeof parsed.byokKey === "string" ? parsed.byokKey : null,
      activeCampaignId:
        typeof parsed.activeCampaignId === "string"
          ? parsed.activeCampaignId
          : null,
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    };
  } catch {
    return emptyAppState();
  }
}

function writeStorage(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("[store] write failed:", err);
  }
}

// Page-load reconciliation: applies on mount only, never during an active
// session. Two flips:
//   1. Sent → FollowUpDue when followUpAt has elapsed
//   2. ResolvingLinkedIn → NoLinkedIn (stale state from a previous tab
//      that was closed mid-batch; the enrichment loop runs in the page,
//      so a reload means nothing's actually in flight anymore)
function applyFollowUpFlips(state: AppState): AppState {
  const now = Date.now();
  let mutated = false;
  const campaigns = state.campaigns.map((c) => {
    const contacts = c.contacts.map((contact) => {
      if (contact.status === "ResolvingLinkedIn") {
        mutated = true;
        return { ...contact, status: "NoLinkedIn" as ContactStatus };
      }
      if (
        contact.status === "Sent" &&
        contact.followUpAt !== null &&
        contact.followUpAt <= now &&
        contact.followUpSentAt === null
      ) {
        mutated = true;
        return { ...contact, status: "FollowUpDue" as ContactStatus };
      }
      return contact;
    });
    return mutated ? { ...c, contacts } : c;
  });
  return mutated ? { ...state, campaigns } : state;
}

// React hook: load state on mount, expose a dispatch surface that persists
// every mutation. Re-reads on storage events so multiple tabs stay in sync.
export function useAppState(): {
  state: AppState;
  ready: boolean;
  setByokKey: (key: string | null) => void;
  setActiveCampaign: (id: string | null) => void;
  createCampaign: (name: string) => Campaign;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  updateTemplates: (id: string, patch: Partial<Templates>) => void;
  deleteCampaign: (id: string) => void;
  addContacts: (
    campaignId: string,
    contacts: Array<Omit<Contact, "id" | "createdAt" | "status" | "sentAt" | "followUpAt" | "followUpSentAt" | "repliedAt" | "firstName"> & {
      firstName?: string;
    }>
  ) => void;
  updateContact: (
    campaignId: string,
    contactId: string,
    patch: Partial<Contact>
  ) => void;
  markSent: (campaignId: string, contactId: string) => void;
  markReplied: (campaignId: string, contactId: string) => void;
  markSkipped: (campaignId: string, contactId: string) => void;
  markFollowUpSent: (campaignId: string, contactId: string) => void;
} {
  const [state, setState] = useState<AppState>(emptyAppState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = applyFollowUpFlips(readStorage());
    setState(initial);
    writeStorage(initial);
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setState(applyFollowUpFlips(readStorage()));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: AppState) => {
    setState(next);
    writeStorage(next);
  }, []);

  const setByokKey = useCallback(
    (key: string | null) => persist({ ...state, byokKey: key }),
    [state, persist]
  );

  const setActiveCampaign = useCallback(
    (id: string | null) => persist({ ...state, activeCampaignId: id }),
    [state, persist]
  );

  const createCampaign = useCallback(
    (name: string): Campaign => {
      const now = Date.now();
      const campaign: Campaign = {
        id: newId(),
        name: name.trim() || "Untitled campaign",
        createdAt: now,
        updatedAt: now,
        templates: { ...DEFAULT_TEMPLATES },
        contacts: [],
      };
      persist({
        ...state,
        campaigns: [...state.campaigns, campaign],
        activeCampaignId: campaign.id,
      });
      return campaign;
    },
    [state, persist]
  );

  const updateCampaign = useCallback(
    (id: string, patch: Partial<Campaign>) => {
      persist({
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c
        ),
      });
    },
    [state, persist]
  );

  const updateTemplates = useCallback(
    (id: string, patch: Partial<Templates>) => {
      persist({
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === id
            ? {
                ...c,
                templates: { ...c.templates, ...patch },
                updatedAt: Date.now(),
              }
            : c
        ),
      });
    },
    [state, persist]
  );

  const deleteCampaign = useCallback(
    (id: string) => {
      persist({
        ...state,
        campaigns: state.campaigns.filter((c) => c.id !== id),
        activeCampaignId:
          state.activeCampaignId === id ? null : state.activeCampaignId,
      });
    },
    [state, persist]
  );

  const addContacts = useCallback(
    (
      campaignId: string,
      contacts: Array<
        Omit<
          Contact,
          | "id"
          | "createdAt"
          | "status"
          | "sentAt"
          | "followUpAt"
          | "followUpSentAt"
          | "repliedAt"
          | "firstName"
        > & { firstName?: string }
      >
    ) => {
      const now = Date.now();
      const fresh: Contact[] = contacts.map((c) => ({
        id: newId(),
        name: c.name,
        firstName: c.firstName ?? deriveFirstName(c.name),
        company: c.company,
        role: c.role ?? null,
        linkedinUrl: c.linkedinUrl ?? null,
        notes: c.notes ?? "",
        status: c.linkedinUrl ? "Pending" : "NoLinkedIn",
        sentAt: null,
        followUpAt: null,
        followUpSentAt: null,
        repliedAt: null,
        createdAt: now,
      }));
      persist({
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                contacts: [...c.contacts, ...fresh],
                updatedAt: now,
              }
            : c
        ),
      });
    },
    [state, persist]
  );

  const updateContact = useCallback(
    (campaignId: string, contactId: string, patch: Partial<Contact>) => {
      persist({
        ...state,
        campaigns: state.campaigns.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                contacts: c.contacts.map((contact) =>
                  contact.id === contactId
                    ? { ...contact, ...patch }
                    : contact
                ),
                updatedAt: Date.now(),
              }
            : c
        ),
      });
    },
    [state, persist]
  );

  const markSent = useCallback(
    (campaignId: string, contactId: string) => {
      const campaign = state.campaigns.find((c) => c.id === campaignId);
      if (!campaign) return;
      const delay = campaign.templates.followUpDelayDays;
      const now = Date.now();
      updateContact(campaignId, contactId, {
        status: "Sent",
        sentAt: now,
        followUpAt: now + delay * 86_400_000,
      });
    },
    [state, updateContact]
  );

  const markReplied = useCallback(
    (campaignId: string, contactId: string) => {
      updateContact(campaignId, contactId, {
        status: "Replied",
        repliedAt: Date.now(),
      });
    },
    [updateContact]
  );

  const markSkipped = useCallback(
    (campaignId: string, contactId: string) => {
      updateContact(campaignId, contactId, { status: "Skipped" });
    },
    [updateContact]
  );

  const markFollowUpSent = useCallback(
    (campaignId: string, contactId: string) => {
      updateContact(campaignId, contactId, {
        status: "Sent", // back to Sent (no further follow-ups in V1)
        followUpSentAt: Date.now(),
      });
    },
    [updateContact]
  );

  return {
    state,
    ready,
    setByokKey,
    setActiveCampaign,
    createCampaign,
    updateCampaign,
    updateTemplates,
    deleteCampaign,
    addContacts,
    updateContact,
    markSent,
    markReplied,
    markSkipped,
    markFollowUpSent,
  };
}

// Sort priority for queue display.
export function statusPriority(status: ContactStatus): number {
  switch (status) {
    case "FollowUpDue":
      return 0;
    case "Pending":
      return 1;
    case "ResolvingLinkedIn":
      return 2;
    case "NoLinkedIn":
      return 3;
    case "Sent":
      return 4;
    case "Replied":
      return 5;
    case "Skipped":
      return 6;
  }
}
