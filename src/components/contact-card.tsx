"use client";

import { useState } from "react";
import {
  type Contact,
  type Templates,
  renderTemplate,
  type ContactStatus,
} from "@/lib/types";

interface Props {
  contact: Contact;
  templates: Templates;
  canResolve: boolean;
  onResolve: () => void;
  onMarkSent: () => void;
  onMarkReplied: () => void;
  onMarkSkipped: () => void;
  onMarkFollowUpSent: () => void;
  onUpdate: (patch: Partial<Contact>) => void;
}

const STATUS_LABEL: Record<ContactStatus, string> = {
  Pending: "Ready to send",
  ResolvingLinkedIn: "Resolving LinkedIn…",
  NoLinkedIn: "No LinkedIn URL — paste below",
  Sent: "Sent · waiting for follow-up window",
  FollowUpDue: "Follow-up due",
  Replied: "Replied",
  Skipped: "Skipped",
};

const STATUS_COLOR: Record<ContactStatus, string> = {
  Pending: "var(--accent)",
  ResolvingLinkedIn: "#a1a1aa",
  NoLinkedIn: "#eab308",
  Sent: "#10b981",
  FollowUpDue: "#f97316",
  Replied: "#a1a1aa",
  Skipped: "#a1a1aa",
};

export function ContactCard({
  contact,
  templates,
  canResolve,
  onResolve,
  onMarkSent,
  onMarkReplied,
  onMarkSkipped,
  onMarkFollowUpSent,
  onUpdate,
}: Props) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(contact.linkedinUrl ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(contact.notes);

  const isFollowUp = contact.status === "FollowUpDue";
  const archived =
    contact.status === "Replied" || contact.status === "Skipped";
  const ready =
    contact.status === "Pending" || contact.status === "FollowUpDue";

  const ctx = {
    name: contact.name,
    firstName: contact.firstName,
    company: contact.company,
    role: contact.role,
    sender: templates.senderName || "Your name",
  };
  const renderedMessage = renderTemplate(
    isFollowUp ? templates.followUp : templates.message1,
    ctx
  );

  const linkedInSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `"${contact.name}" "${contact.company}" linkedin`
  )}`;

  return (
    <article
      className="rounded-xl p-4"
      style={{
        background: archived ? "var(--bg-surface)" : "var(--bg-elevated)",
        border: "1px solid var(--border-secondary)",
        opacity: archived ? 0.7 : 1,
      }}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h4
              className="font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {contact.name}
            </h4>
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {contact.role ? `${contact.role}, ` : ""}
              {contact.company}
            </span>
          </div>
          <p
            className="text-xs mt-1 font-medium"
            style={{ color: STATUS_COLOR[contact.status] }}
          >
            {STATUS_LABEL[contact.status]}
          </p>
        </div>
      </header>

      {!archived && (
        <pre
          className="px-3 py-2 rounded-lg text-sm whitespace-pre-wrap font-sans leading-relaxed mb-3"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-secondary)",
          }}
        >
          {renderedMessage}
        </pre>
      )}

      {/* LinkedIn URL */}
      <div className="mb-3 text-xs">
        {editingUrl ? (
          <div className="flex gap-2">
            <input
              type="url"
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://www.linkedin.com/in/…"
              className="flex-1 px-2.5 py-1.5 rounded-md text-xs focus:outline-none focus:ring-1"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-secondary)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = urlDraft.trim();
                onUpdate({
                  linkedinUrl: trimmed || null,
                  status:
                    trimmed && contact.status === "NoLinkedIn"
                      ? "Pending"
                      : contact.status,
                });
                setEditingUrl(false);
              }}
              className="px-3 py-1.5 text-white rounded-md font-medium"
              style={{ background: "var(--accent)" }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setUrlDraft(contact.linkedinUrl ?? "");
                setEditingUrl(false);
              }}
              className="px-3 py-1.5 rounded-md"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border-secondary)",
              }}
            >
              Cancel
            </button>
          </div>
        ) : contact.linkedinUrl ? (
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-muted)" }}>LinkedIn:</span>
            <a
              href={contact.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate flex-1"
              style={{ color: "var(--accent)" }}
            >
              {contact.linkedinUrl}
            </a>
            <button
              type="button"
              onClick={() => setEditingUrl(true)}
              style={{ color: "var(--text-muted)" }}
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: "var(--text-muted)" }}>
              No LinkedIn URL.
            </span>
            {contact.status !== "ResolvingLinkedIn" && canResolve && (
              <button
                type="button"
                onClick={onResolve}
                style={{ color: "var(--accent)" }}
              >
                Auto-find
              </button>
            )}
            <a
              href={linkedInSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Search Google
            </a>
            <button
              type="button"
              onClick={() => setEditingUrl(true)}
              style={{ color: "var(--accent)" }}
            >
              Paste URL
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      {!archived && (
        <div className="mb-3 text-xs">
          {editingNotes ? (
            <div>
              <textarea
                autoFocus
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-md text-xs focus:outline-none focus:ring-1"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-secondary)",
                  color: "var(--text-primary)",
                }}
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({ notes: notesDraft });
                    setEditingNotes(false);
                  }}
                  className="px-3 py-1 text-white rounded-md font-medium"
                  style={{ background: "var(--accent)" }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(contact.notes);
                    setEditingNotes(false);
                  }}
                  className="px-3 py-1 rounded-md"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="text-left"
              style={{ color: "var(--text-muted)" }}
            >
              {contact.notes ? `Notes: ${contact.notes}` : "+ Add note"}
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {ready && contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm text-white font-medium rounded-md transition-colors"
            style={{ background: "var(--accent)" }}
          >
            Open LinkedIn ↗
          </a>
        )}
        {ready && (
          <button
            type="button"
            onClick={isFollowUp ? onMarkFollowUpSent : onMarkSent}
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
            style={{
              color: "var(--text-primary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            {isFollowUp ? "Mark follow-up sent" : "Mark sent"}
          </button>
        )}
        {!archived && (
          <>
            <button
              type="button"
              onClick={onMarkReplied}
              className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border-secondary)",
              }}
            >
              Replied
            </button>
            <button
              type="button"
              onClick={onMarkSkipped}
              className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={{
                color: "var(--text-muted)",
                border: "1px solid var(--border-secondary)",
              }}
            >
              Skip
            </button>
          </>
        )}
        {archived && (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                status: contact.linkedinUrl ? "Pending" : "NoLinkedIn",
                repliedAt: null,
              })
            }
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            Restore
          </button>
        )}
      </div>
    </article>
  );
}
