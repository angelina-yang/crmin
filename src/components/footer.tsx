"use client";

import { SupportLinks } from "./support-links";

/**
 * Bottom nav for CRM;IN. Mirrors the Daily Brew footer:
 * credits on the left, support links + coffee CTA on the right.
 *
 * The "manual sending" line carries our key value prop and lives
 * here so it's visible from any screen in the workspace, not just
 * the empty-state copy at the bottom of the queue.
 */
export function Footer() {
  return (
    <footer
      className="px-4 py-4 flex items-center justify-between gap-3 flex-wrap"
      style={{ borderTop: "1px solid var(--border-primary)" }}
    >
      {/* Left: credits + reassurance line */}
      <div
        className="text-xs leading-relaxed flex items-center gap-1.5 flex-wrap"
        style={{ color: "var(--text-muted)" }}
      >
        <span>Made with ☕ by</span>
        <a
          href="https://twosetai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold transition-colors hover:underline"
          style={{ color: "var(--accent)" }}
        >
          TwoSetAI
        </a>
        <span style={{ color: "var(--text-faint)" }}>·</span>
        <span>All sending is manual. CRM;IN never touches LinkedIn.</span>
      </div>

      {/* Right: support links + coffee button */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <SupportLinks appName="CRM;IN" />
        <span style={{ color: "var(--text-faint)" }}>·</span>
        <a
          href="https://buymeacoffee.com/angelinayang"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--accent-surface)",
            color: "var(--accent-text, var(--accent))",
            border: "1px solid var(--accent)",
          }}
        >
          Buy me a coffee
        </a>
      </div>
    </footer>
  );
}
