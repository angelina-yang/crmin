"use client";

import { SignOutButton } from "./sign-out-button";

interface HeaderProps {
  hasApiKey: boolean;
  onOpenApiKey: () => void;
}

/**
 * Sticky top nav for CRM;IN. Mirrors the Daily Brew pattern:
 * brand on the left, lightweight action icons on the right.
 *
 * The big API-key chip stays here (not buried in a settings modal)
 * because BYOK is the very first action a user takes; it needs to be
 * one click away from anywhere in the workspace.
 */
export function Header({ hasApiKey, onOpenApiKey }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
      style={{
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border-primary)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "var(--accent-surface)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Group-of-people glyph: signals contacts/CRM */}
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <span
          className="font-bold text-base"
          style={{ color: "var(--text-primary)" }}
        >
          CRM;IN
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenApiKey}
          className="text-sm rounded-md px-3 py-1.5 transition-colors"
          style={{
            color: hasApiKey ? "var(--text-secondary)" : "var(--accent)",
            border: hasApiKey
              ? "1px solid var(--border-secondary)"
              : "1px solid var(--accent)",
          }}
          title="Anthropic API key"
        >
          {hasApiKey ? "API key ✓" : "Add API key"}
        </button>

        {/* Buy me a coffee */}
        <a
          href="https://buymeacoffee.com/angelinayang"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg transition-colors hover:text-yellow-400"
          style={{ color: "var(--text-muted)" }}
          title="Buy me a coffee"
          aria-label="Buy me a coffee"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2 21h18v-2H2v2zM20 8h-2V5h2v3zm0-5H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-4 10c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V5h10v8zm4-5h-2V5h2v3z" />
          </svg>
        </a>

        <SignOutButton />
      </div>
    </header>
  );
}
