"use client";

import { useState } from "react";

export function EmptyState({
  onCreate,
}: {
  onCreate: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  if (creating) {
    return (
      <div
        className="rounded-2xl p-8 max-w-lg mx-auto"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        <h2
          className="text-xl font-semibold mb-2 text-center"
          style={{ color: "var(--text-primary)" }}
        >
          Name your campaign
        </h2>
        <p
          className="text-sm text-center mb-5"
          style={{ color: "var(--text-muted)" }}
        >
          Use a name that helps you tell campaigns apart later — for
          example, &quot;Q2 founder outreach&quot; or &quot;Hiring funnel.&quot;
        </p>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Founder outreach Q2"
          className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 mb-4"
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-secondary)",
            color: "var(--text-primary)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onCreate(name.trim());
          }}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="flex-1 py-2.5 font-medium rounded-lg transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-secondary)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim())}
            className="flex-1 py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{ background: "var(--accent)" }}
          >
            Create campaign
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8">
      <h2
        className="text-2xl font-semibold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Create your first campaign
      </h2>
      <p
        className="text-sm leading-relaxed max-w-md mx-auto mb-7"
        style={{ color: "var(--text-muted)" }}
      >
        A campaign is a list of contacts plus the message templates you&apos;ll
        send. You&apos;ll add contacts by uploading a CSV or pasting a public
        list URL.
      </p>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="px-6 py-2.5 text-white font-medium rounded-lg transition-colors"
        style={{ background: "var(--accent)" }}
      >
        New campaign
      </button>
      <div
        className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs"
        style={{ color: "var(--text-faint)" }}
      >
        <a
          href="/sample.csv"
          download
          style={{ color: "var(--accent)" }}
        >
          Sample CSV
        </a>
        <span>How to write a good template (coming)</span>
        <span>What is CRM;IN? (coming)</span>
      </div>
    </div>
  );
}
