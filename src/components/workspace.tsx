"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState, statusPriority } from "@/lib/store";
import { type Campaign, type Contact } from "@/lib/types";
import { SignOutButton } from "@/components/sign-out-button";
import { EmptyState } from "@/components/empty-state";
import { TemplatesPanel } from "@/components/templates-panel";
import { AddContactsModal } from "@/components/add-contacts-modal";
import { ContactCard } from "@/components/contact-card";
import { ApiKeyPanel } from "@/components/api-key-panel";

export function Workspace({ user }: { user: { name: string } }) {
  const {
    state,
    ready,
    createCampaign,
    setActiveCampaign,
    deleteCampaign,
    updateTemplates,
    setByokKey,
    addContacts,
    updateContact,
    markSent,
    markReplied,
    markSkipped,
    markFollowUpSent,
  } = useAppState();

  const [showImport, setShowImport] = useState(false);
  const [showBookmarkHint, setShowBookmarkHint] = useState(false);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [resolveProgress, setResolveProgress] = useState<{
    done: number;
    total: number;
    currentName: string | null;
    startedAt: number;
  } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // tick state ticks every second while a batch is in flight, so the
  // elapsed/remaining display updates without re-rendering the whole tree.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!resolveProgress) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [resolveProgress]);
  // Mutable cancel flag — set true to interrupt an in-flight enrichment loop
  // after the current contact finishes. We pair this ref with a `cancelling`
  // state value: the ref gives the loop a synchronous read; the state value
  // drives the UI re-render so the Cancel button can flip its label.
  const cancelResolveRef = useRef(false);

  // Batch size: kept small while we're still tuning the enrichment loop.
  // Each contact takes ~10-15s with max_uses: 1, so a batch of 5 is ~1 min
  // wall time and ~$0.10-$0.25 spend ceiling — small enough that an
  // accidental mid-batch refresh costs almost nothing. Bump back up once
  // the per-contact behavior is reliable across many real-world inputs.
  const RESOLVE_BATCH_SIZE = 5;

  const firstName = user.name.split(" ")[0];

  // Sync activeCampaignId from ?campaign=… URL param so deep links work and
  // bookmarks restore the right campaign.
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("campaign");
    if (
      fromUrl &&
      state.campaigns.some((c) => c.id === fromUrl) &&
      state.activeCampaignId !== fromUrl
    ) {
      setActiveCampaign(fromUrl);
      return;
    }
    if (
      !fromUrl &&
      state.activeCampaignId &&
      state.campaigns.some((c) => c.id === state.activeCampaignId)
    ) {
      const url = new URL(window.location.href);
      url.searchParams.set("campaign", state.activeCampaignId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [ready, state.activeCampaignId, state.campaigns, setActiveCampaign]);

  const activeCampaign = useMemo<Campaign | null>(() => {
    if (!state.activeCampaignId) return null;
    return state.campaigns.find((c) => c.id === state.activeCampaignId) ?? null;
  }, [state]);

  const sortedContacts = useMemo<Contact[]>(() => {
    if (!activeCampaign) return [];
    return [...activeCampaign.contacts].sort((a, b) => {
      const diff = statusPriority(a.status) - statusPriority(b.status);
      if (diff !== 0) return diff;
      return a.createdAt - b.createdAt;
    });
  }, [activeCampaign]);

  const counts = useMemo(() => {
    if (!activeCampaign) return null;
    const c = activeCampaign.contacts;
    return {
      total: c.length,
      pending: c.filter((x) => x.status === "Pending").length,
      sent: c.filter((x) => x.status === "Sent").length,
      followUpDue: c.filter((x) => x.status === "FollowUpDue").length,
      noLinkedIn: c.filter((x) => x.status === "NoLinkedIn").length,
      replied: c.filter((x) => x.status === "Replied").length,
    };
  }, [activeCampaign]);

  const handleCreate = (name: string) => {
    const c = createCampaign(name);
    setShowBookmarkHint(true);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("campaign", c.id);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleSwitch = (id: string) => {
    setActiveCampaign(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("campaign", id);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this campaign and all its contacts?")) return;
    deleteCampaign(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("campaign");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Resolve missing LinkedIn URLs via the /api/enrich route. Sequential —
  // each contact runs its own multi-search loop on the server, so we'd hit
  // function timeouts if we batched too many. One row per request keeps each
  // request short and lets us update the UI per-row. Bounded by
  // RESOLVE_BATCH_SIZE so the user sees cost build incrementally.
  const runEnrichment = async (contactsToResolve: Contact[]) => {
    if (!activeCampaign) return;
    if (!state.byokKey) {
      setResolveError(
        "Add your API key in Settings before resolving LinkedIn URLs."
      );
      setShowKeyPanel(true);
      return;
    }
    if (contactsToResolve.length === 0) return;

    // Cap each click at RESOLVE_BATCH_SIZE so the user can stop and resume
    // between batches.
    const batch = contactsToResolve.slice(0, RESOLVE_BATCH_SIZE);

    setResolveError(null);
    cancelResolveRef.current = false;
    setCancelling(false);
    const batchStartedAt = Date.now();
    setResolveProgress({
      done: 0,
      total: batch.length,
      currentName: batch[0]?.name ?? null,
      startedAt: batchStartedAt,
    });

    for (let i = 0; i < batch.length; i++) {
      if (cancelResolveRef.current) break;
      const contact = batch[i];
      setResolveProgress({
        done: i,
        total: batch.length,
        currentName: contact.name,
        startedAt: batchStartedAt,
      });
      // Mark as resolving so the UI updates immediately
      updateContact(activeCampaign.id, contact.id, {
        status: "ResolvingLinkedIn",
      });

      // Hard 90s timeout per contact. If the server side hangs (e.g. an
      // upstream Claude/web_search hiccup), abort and move on — never let
      // a single bad contact block the whole batch.
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), 90_000);

      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            anthropicKey: state.byokKey,
            rows: [
              {
                id: contact.id,
                name: contact.name,
                company: contact.company,
                role: contact.role,
              },
            ],
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          updateContact(activeCampaign.id, contact.id, {
            status: contact.linkedinUrl ? "Pending" : "NoLinkedIn",
            notes: contact.notes
              ? `${contact.notes}\n[Enrichment error: ${data.error ?? res.status}]`
              : `[Enrichment error: ${data.error ?? res.status}]`,
          });
          if (res.status === 401 || res.status === 400) {
            setResolveError(
              data.error ?? "Enrichment failed. Check your API key."
            );
            break;
          }
        } else {
          const data = (await res.json()) as {
            results: Array<{
              id: string;
              linkedinUrl: string | null;
              notes: string;
              error?: string;
            }>;
          };
          const result = data.results[0];
          updateContact(activeCampaign.id, contact.id, {
            linkedinUrl: result?.linkedinUrl ?? null,
            status: result?.linkedinUrl ? "Pending" : "NoLinkedIn",
            notes: result?.notes
              ? contact.notes
                ? `${contact.notes}\n${result.notes}`
                : result.notes
              : contact.notes,
          });
        }
      } catch (err) {
        const isTimeout =
          err instanceof DOMException && err.name === "AbortError";
        const msg = isTimeout
          ? "timed out after 90s"
          : err instanceof Error
            ? err.message
            : "network error";
        updateContact(activeCampaign.id, contact.id, {
          status: contact.linkedinUrl ? "Pending" : "NoLinkedIn",
          notes: contact.notes
            ? `${contact.notes}\n[Enrichment error: ${msg}]`
            : `[Enrichment error: ${msg}]`,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const next = batch[i + 1];
      setResolveProgress({
        done: i + 1,
        total: batch.length,
        currentName: next?.name ?? null,
        startedAt: batchStartedAt,
      });
    }

    // Brief delay before clearing the progress so the user sees "done"
    setTimeout(() => setResolveProgress(null), 1500);
    cancelResolveRef.current = false;
    setCancelling(false);
  };

  const cancelEnrichment = () => {
    cancelResolveRef.current = true;
    setCancelling(true);
  };

  if (!ready) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{
          background: "var(--bg-surface)",
          color: "var(--text-muted)",
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 px-6 pb-12"
      style={{ background: "var(--bg-surface)" }}
    >
      <header className="w-full max-w-5xl mx-auto pt-8 pb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-1.5"
            style={{ color: "var(--accent)" }}
          >
            CRM;IN Workspace
          </p>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Hi, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKeyPanel(true)}
            className="text-sm rounded-md px-3 py-1.5 transition-colors"
            style={{
              color: state.byokKey
                ? "var(--text-secondary)"
                : "var(--accent)",
              border: state.byokKey
                ? "1px solid var(--border-secondary)"
                : "1px solid var(--accent)",
            }}
            title="Anthropic API key"
          >
            {state.byokKey ? "API key ✓" : "Add API key"}
          </button>
          <SignOutButton />
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto">
        {state.campaigns.length === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : !activeCampaign ? (
          <div className="text-center py-12">
            <p style={{ color: "var(--text-muted)" }}>
              Pick a campaign to keep working, or start a new one.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {state.campaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSwitch(c.id)}
                  className="px-3 py-1.5 text-sm rounded-md transition-colors"
                  style={{
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-secondary)",
                  }}
                >
                  {c.name} · {c.contacts.length}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const name = prompt("Campaign name?");
                  if (name?.trim()) handleCreate(name.trim());
                }}
                className="px-3 py-1.5 text-sm rounded-md text-white transition-colors"
                style={{ background: "var(--accent)" }}
              >
                + New
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Campaign switcher */}
            <div
              className="flex items-center gap-3 flex-wrap"
              style={{ color: "var(--text-secondary)" }}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Campaign:
              </span>
              <select
                value={activeCampaign.id}
                onChange={(e) => handleSwitch(e.target.value)}
                className="px-3 py-1.5 rounded-md text-sm focus:outline-none focus:ring-1"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                {state.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.contacts.length})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const name = prompt("Campaign name?");
                  if (name?.trim()) handleCreate(name.trim());
                }}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-secondary)",
                }}
              >
                + New
              </button>
              <button
                type="button"
                onClick={() => handleDelete(activeCampaign.id)}
                className="text-xs"
                style={{ color: "var(--text-faint)" }}
                title="Delete this campaign"
              >
                Delete campaign
              </button>
              {showBookmarkHint && (
                <span
                  className="text-xs ml-auto px-2 py-1 rounded"
                  style={{
                    background: "var(--accent-surface)",
                    color: "var(--accent)",
                  }}
                >
                  Tip: bookmark this URL to return to this campaign
                  <button
                    type="button"
                    onClick={() => setShowBookmarkHint(false)}
                    className="ml-2"
                    style={{ color: "var(--accent)" }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>

            {/* Counts strip */}
            {counts && counts.total > 0 && (
              <div
                className="flex flex-wrap gap-x-5 gap-y-1 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <span>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {counts.total}
                  </strong>{" "}
                  total
                </span>
                {counts.followUpDue > 0 && (
                  <span style={{ color: "#f97316" }}>
                    {counts.followUpDue} follow-up due
                  </span>
                )}
                <span>{counts.pending} ready</span>
                <span>{counts.sent} sent</span>
                {counts.noLinkedIn > 0 && (
                  <span>{counts.noLinkedIn} need URL</span>
                )}
                {counts.replied > 0 && (
                  <span>{counts.replied} replied</span>
                )}
              </div>
            )}

            <TemplatesPanel
              templates={activeCampaign.templates}
              sampleContact={activeCampaign.contacts[0] ?? null}
              onChange={(patch) =>
                updateTemplates(activeCampaign.id, patch)
              }
            />

            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h3
                className="text-base font-semibold pt-2"
                style={{ color: "var(--text-primary)" }}
              >
                Queue
              </h3>
              <div className="flex items-start gap-2 flex-wrap">
                {(() => {
                  const noLinkedIn = activeCampaign.contacts.filter(
                    (c) => c.status === "NoLinkedIn"
                  );
                  if (noLinkedIn.length === 0) return null;
                  const batchCount = Math.min(
                    noLinkedIn.length,
                    RESOLVE_BATCH_SIZE
                  );
                  return (
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={resolveProgress !== null}
                          onClick={() => runEnrichment(noLinkedIn)}
                          title="Charged directly to your provider account. We do not see or control this charge."
                          className="px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                          style={{
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-secondary)",
                          }}
                        >
                          {resolveProgress
                            ? `Resolving ${resolveProgress.done}/${resolveProgress.total}…`
                            : noLinkedIn.length > RESOLVE_BATCH_SIZE
                              ? `Resolve next ${batchCount} (${noLinkedIn.length} left)`
                              : `Resolve ${batchCount} missing URL${batchCount === 1 ? "" : "s"}`}
                        </button>
                        {resolveProgress !== null && (
                          <button
                            type="button"
                            onClick={cancelEnrichment}
                            disabled={cancelling}
                            className="px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                            style={{
                              color: "#ef4444",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            {cancelling ? "Cancelling…" : "Cancel"}
                          </button>
                        )}
                      </div>
                      {resolveProgress !== null ? (
                        (() => {
                          const elapsedMs = Date.now() - resolveProgress.startedAt;
                          const elapsedS = Math.round(elapsedMs / 1000);
                          // Avg ~12s per contact with max_uses: 1
                          const remaining = Math.max(
                            0,
                            (resolveProgress.total - resolveProgress.done) * 12
                          );
                          return (
                            <span
                              className="text-xs mt-1 text-right max-w-[18rem]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {resolveProgress.currentName ? (
                                <>
                                  Resolving:{" "}
                                  <span style={{ color: "var(--text-secondary)" }}>
                                    {resolveProgress.currentName}
                                  </span>
                                  <br />
                                </>
                              ) : null}
                              {elapsedS}s elapsed · ~{remaining}s remaining
                            </span>
                          );
                        })()
                      ) : (
                        <span
                          className="text-xs mt-1"
                          style={{ color: "var(--text-faint)" }}
                        >
                          ≈ ${(batchCount * 0.02).toFixed(2)}–${(batchCount * 0.05).toFixed(2)} estimated
                        </span>
                      )}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="px-4 py-2 text-sm text-white font-medium rounded-md transition-colors"
                  style={{ background: "var(--accent)" }}
                >
                  + Add contacts
                </button>
              </div>
            </div>

            {resolveError && (
              <div
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                }}
              >
                {resolveError}
              </div>
            )}

            {sortedContacts.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px dashed var(--border-secondary)",
                  color: "var(--text-muted)",
                }}
              >
                <p className="text-sm mb-3">
                  Empty queue. Add contacts to get started.
                </p>
                <button
                  type="button"
                  onClick={() => setShowImport(true)}
                  className="px-4 py-2 text-sm text-white font-medium rounded-md"
                  style={{ background: "var(--accent)" }}
                >
                  + Add contacts
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    templates={activeCampaign.templates}
                    canResolve={Boolean(state.byokKey)}
                    onResolve={() => runEnrichment([contact])}
                    onMarkSent={() => markSent(activeCampaign.id, contact.id)}
                    onMarkReplied={() =>
                      markReplied(activeCampaign.id, contact.id)
                    }
                    onMarkSkipped={() =>
                      markSkipped(activeCampaign.id, contact.id)
                    }
                    onMarkFollowUpSent={() =>
                      markFollowUpSent(activeCampaign.id, contact.id)
                    }
                    onUpdate={(patch) =>
                      updateContact(activeCampaign.id, contact.id, patch)
                    }
                  />
                ))}
              </div>
            )}

            <p
              className="text-xs text-center pt-4"
              style={{ color: "var(--text-faint)" }}
            >
              All sending is manual. CRM;IN never touches LinkedIn — that’s
              how you stay off the ban radar.
            </p>
          </div>
        )}
      </div>

      <AddContactsModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        byokKey={state.byokKey}
        onNeedKey={() => {
          setShowImport(false);
          setShowKeyPanel(true);
        }}
        onImport={(rows) => {
          if (!activeCampaign) return;
          addContacts(activeCampaign.id, rows);
        }}
      />

      <ApiKeyPanel
        isOpen={showKeyPanel}
        onClose={() => setShowKeyPanel(false)}
        currentKey={state.byokKey}
        onSave={(key) => {
          setByokKey(key);
          if (key) setResolveError(null);
        }}
      />
    </div>
  );
}
