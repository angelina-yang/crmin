"use client";

import { useState } from "react";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-sm rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
      style={{
        color: "var(--text-muted)",
        border: "1px solid var(--border-secondary)",
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
