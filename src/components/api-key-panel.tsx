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

  if (!isOpen) return null;

  const masked = currentKey
    ? `${currentKey.slice(0, 7)}…${currentKey.slice(-4)}`
    : null;

  const handleSave = () => {
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
        className="relative rounded-2xl w-full max-w-md p-6"
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
            CRM;IN uses Claude to find LinkedIn URLs from name + company.
            Bring your own Anthropic key — it&apos;s stored only in this
            browser, never sent to our server beyond proxying the call.
          </p>
        </header>

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
        <input
          type={reveal ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-…"
          className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 mb-4 font-mono"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-secondary)",
            color: "var(--text-primary)",
          }}
        />

        <p
          className="text-xs leading-relaxed mb-5"
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
          . Keys you paste here go into localStorage. Clearing your browser
          data clears the key.
        </p>

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
            disabled={draft.trim() === currentKey}
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
