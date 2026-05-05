import Link from "next/link";
import { VerifyConfirm } from "@/components/verify-confirm";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div
        className="flex flex-col flex-1 items-center justify-center px-6"
        style={{ background: "var(--bg-surface)" }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-secondary)",
          }}
        >
          <h1
            className="text-2xl font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Invalid sign-in link
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            This link is missing required information.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block underline"
            style={{ color: "var(--accent)" }}
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 items-center justify-center px-6"
      style={{ background: "var(--bg-surface)" }}
    >
      <div
        className="max-w-md w-full rounded-2xl p-8"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        <header className="text-center mb-6">
          <h1
            className="text-2xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Confirm sign in
          </h1>
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Click below to finish signing in to CRM;IN.
          </p>
        </header>
        <VerifyConfirm token={token} />
      </div>
    </div>
  );
}
