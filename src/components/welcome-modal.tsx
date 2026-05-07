"use client";

import { useState } from "react";
import { isValidEmail } from "@/lib/email-validation";

interface WelcomeModalProps {
  isOpen: boolean;
}

type ModalState = "form" | "submitting" | "sent";

export function WelcomeModal({ isOpen }: WelcomeModalProps) {
  const [state, setState] = useState<ModalState>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const emailOk = isValidEmail(email);
  const showEmailError =
    state === "form" && email.length > 0 && !emailOk;
  const canSubmit =
    state === "form" &&
    name.trim() !== "" &&
    emailOk &&
    agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          termsAgreed: true,
          newsletter,
        }),
      });

      if (res.ok) {
        setState("sent");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Sign-up failed. Try again.");
      setState("form");
    } catch {
      setErrorMsg("Network error. Try again.");
      setState("form");
    }
  };

  const handleResend = async () => {
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          termsAgreed: true,
          newsletter,
        }),
      });
      if (res.ok) {
        setState("sent");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Failed to resend. Try again.");
      setState("sent");
    } catch {
      setErrorMsg("Network error. Try again.");
      setState("sent");
    }
  };

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-secondary)",
    color: "var(--text-primary)",
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "var(--bg-backdrop)" }}
      />
      <div
        className="relative rounded-2xl w-full max-w-md mx-4 p-6"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--accent)" }}
          >
            {state === "sent" ? (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6" />
                <path d="M23 11h-6" />
              </svg>
            )}
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            {state === "sent" ? "Check your inbox" : "Welcome to CRM;IN"}
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {state === "sent" ? (
              <>
                We sent a sign-in link to{" "}
                <span style={{ color: "var(--text-primary)" }}>{email}</span>.
                Click it to finish signing in. The link expires in 15 minutes.
              </>
            ) : (
              <>
                Templated LinkedIn outreach with manual sending. Bring your
                list, we hold the queue.
              </>
            )}
          </p>
        </div>

        {state === "sent" ? (
          <div className="space-y-3">
            {errorMsg && (
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
            <button
              type="button"
              onClick={handleResend}
              className="w-full py-2.5 font-medium rounded-lg transition-colors"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-secondary)",
              }}
            >
              Resend the link
            </button>
            <p
              className="text-xs text-center"
              style={{ color: "var(--text-faint)" }}
            >
              Wrong email? Refresh the page to start over.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1"
                style={{
                  ...inputStyle,
                  border: `1px solid ${
                    showEmailError ? "#ef4444" : "var(--border-secondary)"
                  }`,
                }}
              />
              {showEmailError && (
                <p className="text-xs mt-1" style={{ color: "#ef4444" }}>
                  Please enter a valid email address.
                </p>
              )}
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded"
                style={{ accentColor: "var(--accent)" }}
              />
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                Subscribe to the{" "}
                <a
                  href="https://angelinayang.substack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  TwoSetAI newsletter
                </a>
                {" "}— new free AI tools, founder insights, and early access
                to what I&apos;m building
              </p>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded"
                style={{ accentColor: "var(--accent)" }}
              />
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                I agree to the{" "}
                <a
                  href="https://www.twosetai.com/lab/terms/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  TwoSetAI Lab Terms of Use
                </a>
                . This is a free, experimental tool.
              </p>
            </div>

            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--text-faint)" }}
            >
              <span
                className="font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                Your keys, your data.
              </span>
              {" "}Contacts and messages stay in your browser, never on our
              server.
            </p>

            {errorMsg && (
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

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-2.5 text-white font-medium rounded-lg transition-colors mt-2 disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              {state === "submitting"
                ? "Sending sign-in link…"
                : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
