"use client";

import { WelcomeModal } from "@/components/welcome-modal";

export function Landing() {
  return (
    <div
      className="flex flex-col flex-1 items-center justify-center px-6"
      style={{ background: "var(--bg-surface)" }}
    >
      <main className="w-full max-w-2xl py-16 sm:py-24">
        <div className="text-center sm:text-left">
          <p
            className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: "var(--accent)" }}
          >
            CRM;IN · TwoSetAI Lab
          </p>
          <h1
            className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-5"
            style={{ color: "var(--text-primary)" }}
          >
            Run your LinkedIn outreach like a CRM, not a spam bot.
          </h1>
          <p
            className="text-lg leading-relaxed max-w-xl mb-8"
            style={{ color: "var(--text-secondary)" }}
          >
            Upload a list. Write a message once. Work through a queue at your
            own pace. CRM;IN never sends a DM for you — that&apos;s how you
            stay off LinkedIn&apos;s ban radar.
          </p>
          <ul
            className="space-y-2 text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            <li>· Bring your own Anthropic API key — no subscription</li>
            <li>· Templated messages with personalization placeholders</li>
            <li>· Auto-resolve LinkedIn URLs from name + company</li>
            <li>· Manual sending only — no automation, no bans</li>
          </ul>
        </div>
      </main>

      <WelcomeModal isOpen={true} />
    </div>
  );
}
