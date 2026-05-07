"use client";

import { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string | null;
  onSave: (key: string | null) => void;
}

export function ApiKeyPanel({ isOpen, onClose, currentKey, onSave }: Props) {
  const [draft, setDraft] = useState(currentKey ?? "");
  const [reveal, setReveal] = useState(false);
  // Required financial-responsibility consent. Pre-acknowledge if user is
  // editing a key they already saved (they consented previously).
  const [acknowledged, setAcknowledged] = useState(currentKey !== null);

  if (!isOpen) return null;

  const masked = currentKey
    ? `${currentKey.slice(0, 7)}…${currentKey.slice(-4)}`
    : null;

  const handleSave = () => {
    if (!acknowledged) return;
    const trimmed = draft.trim();
    onSave(trimmed === "" ? null : trimmed);
    onClose();
  };

  const handleClear = () => {
    setDraft("");
    onSave(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "var(--bg-backdrop)" }}
        onClick={onClose}
      />
      <div
        className="relative rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        <header className="mb-4">
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Anthropic API key
          </h2>
          <p
            className="text-sm mt-2 leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            CRM;IN uses your Anthropic API key for data enrichment:
            finding LinkedIn profiles and extracting people from URLs
            you paste.
          </p>
        </header>

        {/* Spending-cap recommendation banner — shown above the input so
            users see it before pasting. */}
        <div
          className="rounded-lg px-3 py-2.5 mb-4 text-xs leading-relaxed"
          style={{
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            color: "var(--text-secondary)",
          }}
        >
          <strong style={{ color: "var(--text-primary)" }}>
            Set a hard spending cap first.
          </strong>{" "}
          CRM;IN does not enforce, monitor, or limit your provider charges.
          Set a monthly cap in your{" "}
          <a
            href="https://console.anthropic.com/settings/limits"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            Anthropic dashboard
          </a>{" "}
          before pasting your key.
        </div>

        {masked && (
          <div
            className="rounded-lg px-3 py-2 mb-4 text-xs flex items-center gap-2 flex-wrap"
            style={{
              background: "var(--accent-surface)",
              color: "var(--accent)",
              border: "1px solid var(--border-primary)",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>Saved:</span>
            <code>{masked}</code>
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="ml-auto"
              style={{ color: "var(--text-muted)" }}
            >
              {reveal ? "Hide" : "Reveal"}
            </button>
          </div>
        )}

        <label
          className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Anthropic API key
        </label>
        {/* Wrap in a form so Chrome stops complaining about an
            unwrapped password field. autoComplete="off" tells the
            browser not to save this and to skip 1Password/LastPass
            scanners. The form has no submit handler — Save is
            handled by the button onClick. */}
        <form
          onSubmit={(e) => e.preventDefault()}
          autoComplete="off"
        >
          <input
            type={reveal ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            name="anthropic-api-key"
            className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 mb-3 font-mono"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-secondary)",
              color: "var(--text-primary)",
            }}
          />
        </form>

        <p
          className="text-xs leading-relaxed mb-4"
          style={{ color: "var(--text-faint)" }}
        >
          Get a key at{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            console.anthropic.com
          </a>
          . Your key is saved on this device only, inside your browser.
          Clearing your browser data, signing out, or switching devices
          removes the saved key.
        </p>

        {/* Required financial-responsibility consent — checkbox must be
            ticked before Save activates. Click-time clickwrap. */}
        <label
          className="flex items-start gap-2.5 mb-5 cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded shrink-0"
            style={{ accentColor: "var(--accent)" }}
          />
          <span className="text-xs leading-relaxed">
            I understand that I am solely responsible for all charges
            incurred at my chosen API provider through CRM;IN, and that
            TwoSetAI cannot see, pause, refund, or limit those charges. I
            have set a hard spending cap in my provider account, or I
            accept full responsibility if I have not.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 font-medium rounded-lg transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            Cancel
          </button>
          {currentKey && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 font-medium rounded-lg transition-colors"
              style={{
                background: "var(--bg-input)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              !acknowledged ||
              draft.trim() === "" ||
              draft.trim() === currentKey
            }
            className="flex-1 py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
