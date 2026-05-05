import Link from "next/link";

export default function NotFound() {
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
        <p
          className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
          style={{ color: "var(--accent)" }}
        >
          404
        </p>
        <h1
          className="text-2xl font-semibold mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Page not found
        </h1>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          The link you followed doesn&apos;t match anything in CRM;IN.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 text-white font-medium rounded-lg"
          style={{ background: "var(--accent)" }}
        >
          Back to start
        </Link>
      </div>
    </div>
  );
}
