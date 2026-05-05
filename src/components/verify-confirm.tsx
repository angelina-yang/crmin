"use client";

import { useState } from "react";
import Link from "next/link";

export function VerifyConfirm({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expired, setExpired] = useState(false);

  async function onClick() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        window.location.href = "/app";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.code === "expired") setExpired(true);
      setErrorMsg(data.error ?? "Sign-in failed. Request a new link.");
      setSubmitting(false);
    } catch {
      setErrorMsg("Network error. Try again.");
      setSubmitting(false);
    }
  }

  if (expired) {
    return (
      <div className="text-center space-y-4">
        <p style={{ color: "var(--text-secondary)" }}>
          This sign-in link has expired or already been used.
        </p>
        <Link
          href="/"
          className="inline-block rounded-md px-4 py-2.5 text-white font-medium transition-colors"
          style={{ background: "var(--accent)" }}
        >
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onClick}
        disabled={submitting}
        className="w-full rounded-md px-4 py-2.5 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ background: "var(--accent)" }}
      >
        {submitting ? "Signing you in…" : "Sign in to CRM;IN"}
      </button>
      {errorMsg && !expired && (
        <div
          className="rounded-md px-3 py-2 text-sm"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
