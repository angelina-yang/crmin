"use client";

import { useEffect, useState, useRef } from "react";
import { parseCsv, parseTsv, type CsvParseResult } from "@/lib/csv";
import { deriveFirstName } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: CsvParseResult["rows"]) => void;
  byokKey: string | null;
  onNeedKey: () => void;
}

type Tab = "csv" | "paste" | "url";

type ScrapeStage = "idle" | "extracting" | "fallback" | "error";

export function AddContactsModal({
  isOpen,
  onClose,
  onImport,
  byokKey,
  onNeedKey,
}: Props) {
  const [tab, setTab] = useState<Tab>("csv");
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [pasteText, setPasteText] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeStage, setScrapeStage] = useState<ScrapeStage>("idle");
  const [scrapePasteText, setScrapePasteText] = useState("");
  const [scrapeError, setScrapeError] = useState("");
  const [scrapeQuota, setScrapeQuota] = useState<{
    used: number;
    cap: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whenever a fresh `parsed` result arrives, default-select every row.
  useEffect(() => {
    if (parsed && parsed.rows.length > 0) {
      setSelectedRows(new Set(parsed.rows.map((_, i) => i)));
    } else {
      setSelectedRows(new Set());
    }
  }, [parsed]);

  if (!isOpen) return null;

  const resetTabState = () => {
    setParsed(null);
    setScrapeStage("idle");
    setScrapeError("");
    setScrapePasteText("");
  };

  const runUrlScrape = async () => {
    if (!byokKey) {
      onNeedKey();
      return;
    }
    if (!scrapeUrl.trim()) {
      setScrapeError("Paste a URL first.");
      return;
    }
    setScrapeStage("extracting");
    setScrapeError("");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: scrapeUrl.trim(),
          anthropicKey: byokKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScrapeError(data.error ?? `Request failed (${res.status})`);
        setScrapeStage("error");
        return;
      }
      if (data.quota) setScrapeQuota(data.quota);
      const candidates = (data.candidates ?? []) as Array<{
        name: string;
        company: string | null;
        role: string | null;
      }>;
      if (candidates.length === 0) {
        // Fall through to the paste-text fallback. Don't mark as error.
        setScrapeStage("fallback");
        setScrapeError(
          data.notes ??
            "Couldn't extract candidates from this URL — try pasting the page text instead."
        );
        return;
      }
      setParsed({
        rows: candidates.map((c) => ({
          name: c.name,
          firstName: deriveFirstName(c.name),
          company: c.company ?? "",
          role: c.role,
          linkedinUrl: null,
          notes: "",
        })),
        warnings: data.notes ? [`Note: ${data.notes}`] : [],
      });
      setScrapeStage("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      setScrapeError(msg);
      setScrapeStage("error");
    }
  };

  const runScrapeTextFallback = async () => {
    if (!byokKey) {
      onNeedKey();
      return;
    }
    if (scrapePasteText.trim().length < 10) {
      setScrapeError("Paste at least a few lines of page text.");
      return;
    }
    setScrapeStage("extracting");
    setScrapeError("");
    try {
      const res = await fetch("/api/scrape/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scrapePasteText,
          anthropicKey: byokKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScrapeError(data.error ?? `Request failed (${res.status})`);
        setScrapeStage("error");
        return;
      }
      if (data.quota) setScrapeQuota(data.quota);
      const candidates = (data.candidates ?? []) as Array<{
        name: string;
        company: string | null;
        role: string | null;
      }>;
      if (candidates.length === 0) {
        setScrapeStage("error");
        setScrapeError(
          data.notes ??
            "No candidates found in the pasted text. Make sure it includes a list of named people."
        );
        return;
      }
      setParsed({
        rows: candidates.map((c) => ({
          name: c.name,
          firstName: deriveFirstName(c.name),
          company: c.company ?? "",
          role: c.role,
          linkedinUrl: null,
          notes: "",
        })),
        warnings: data.notes ? [`Note: ${data.notes}`] : [],
      });
      setScrapeStage("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      setScrapeError(msg);
      setScrapeStage("error");
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > 1_000_000) {
      setParsed({
        rows: [],
        warnings: [
          "File too large. Max 1 MB. For larger lists, email Angelina — we build bespoke versions for teams.",
        ],
      });
      return;
    }
    const text = await file.text();
    setParsed(parseCsv(text));
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      setParsed({ rows: [], warnings: ["Paste rows first."] });
      return;
    }
    // Try TSV first (most common when pasting from Sheets/Excel), fallback to CSV.
    const tsv = parseTsv(pasteText);
    if (tsv.rows.length > 0) {
      setParsed(tsv);
      return;
    }
    setParsed(parseCsv(pasteText));
  };

  const handleConfirm = () => {
    if (!parsed || parsed.rows.length === 0) return;
    const toImport = parsed.rows.filter((_, i) => selectedRows.has(i));
    if (toImport.length === 0) return;
    onImport(toImport);
    setParsed(null);
    setSelectedRows(new Set());
    setPasteText("");
    setScrapeUrl("");
    setScrapePasteText("");
    setScrapeStage("idle");
    onClose();
  };

  const toggleRow = (i: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (!parsed) return;
    setSelectedRows((prev) =>
      prev.size === parsed.rows.length
        ? new Set()
        : new Set(parsed.rows.map((_, i) => i))
    );
  };

  const handleCancel = () => {
    setParsed(null);
    setPasteText("");
    setScrapeUrl("");
    setScrapePasteText("");
    setScrapeStage("idle");
    setScrapeError("");
    onClose();
  };

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-secondary)",
    color: "var(--text-primary)",
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "var(--bg-backdrop)" }}
        onClick={handleCancel}
      />
      <div
        className="relative rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-secondary)",
        }}
      >
        <header
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Add contacts
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Close
          </button>
        </header>

        <div className="flex" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <button
            type="button"
            onClick={() => {
              setTab("csv");
              setParsed(null);
            }}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color:
                tab === "csv" ? "var(--accent)" : "var(--text-muted)",
              borderBottom:
                tab === "csv"
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            Upload CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("paste");
              resetTabState();
            }}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color:
                tab === "paste" ? "var(--accent)" : "var(--text-muted)",
              borderBottom:
                tab === "paste"
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            Paste rows
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("url");
              resetTabState();
            }}
            className="px-5 py-2.5 text-sm font-medium transition-colors"
            style={{
              color:
                tab === "url" ? "var(--accent)" : "var(--text-muted)",
              borderBottom:
                tab === "url"
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            From URL
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!parsed && tab === "csv" && (
            <div className="text-center py-8">
              <p
                className="text-sm mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                Pick a CSV with columns: <code>name</code>, <code>company</code>
                , optional <code>role</code>, <code>linkedin_url</code>,{" "}
                <code>notes</code>.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 text-white font-medium rounded-lg transition-colors"
                style={{ background: "var(--accent)" }}
              >
                Choose CSV file
              </button>
              <p
                className="text-xs mt-4"
                style={{ color: "var(--text-faint)" }}
              >
                <a
                  href="/sample.csv"
                  download
                  style={{ color: "var(--accent)" }}
                >
                  Download a sample CSV
                </a>{" "}
                · Max 1 MB · 500 rows max per import
              </p>
            </div>
          )}

          {!parsed && tab === "paste" && (
            <div>
              <p
                className="text-sm mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Paste rows from a spreadsheet (tab-separated). First line is
                the header.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  "Name\tCompany\tRole\tLinkedIn URL\nJane Doe\tAcme AI\tCEO\thttps://linkedin.com/in/..."
                }
                rows={10}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-1"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={handlePasteParse}
                className="mt-3 px-5 py-2.5 text-white font-medium rounded-lg transition-colors"
                style={{ background: "var(--accent)" }}
              >
                Parse rows
              </button>
            </div>
          )}

          {!parsed && tab === "url" && (
            <div>
              <p
                className="text-sm mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Paste the URL of a public list page, a directory, a
                roundup, an attendees page, a public newsletter post.
                CRM;IN fetches it and extracts the people on it.
              </p>
              {!byokKey && (
                <div
                  className="rounded-md px-3 py-2 text-xs mb-3"
                  style={{
                    background: "rgba(234, 179, 8, 0.1)",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Anthropic API key required.{" "}
                  <button
                    type="button"
                    onClick={onNeedKey}
                    style={{
                      color: "var(--accent)",
                      textDecoration: "underline",
                    }}
                  >
                    Add key
                  </button>
                </div>
              )}
              <input
                type="url"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://example.com/founders"
                disabled={scrapeStage === "extracting"}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 mb-3"
                style={inputStyle}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runUrlScrape}
                  disabled={
                    scrapeStage === "extracting" || !scrapeUrl.trim()
                  }
                  className="px-5 py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)" }}
                >
                  {scrapeStage === "extracting"
                    ? "Extracting…"
                    : "Extract candidates"}
                </button>
                {scrapeQuota && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {scrapeQuota.used}/{scrapeQuota.cap} scrapes today
                  </span>
                )}
              </div>

              {(scrapeStage === "fallback" || scrapeStage === "error") &&
                scrapeError && (
                  <div
                    className="rounded-md px-3 py-2 text-xs mt-4"
                    style={{
                      background: "rgba(234, 179, 8, 0.1)",
                      border: "1px solid rgba(234, 179, 8, 0.3)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {scrapeError}
                  </div>
                )}

              {scrapeStage === "fallback" && (
                <div className="mt-4">
                  <label
                    className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Paste page text instead
                  </label>
                  <textarea
                    value={scrapePasteText}
                    onChange={(e) => setScrapePasteText(e.target.value)}
                    placeholder="Open the page in your browser, select all, paste here…"
                    rows={8}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={runScrapeTextFallback}
                    disabled={
                      scrapeStage !== "fallback" ||
                      scrapePasteText.trim().length < 10
                    }
                    className="mt-3 px-5 py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    Extract from text
                  </button>
                </div>
              )}

              <p
                className="text-xs mt-5 leading-relaxed"
                style={{ color: "var(--text-faint)" }}
              >
                URL must be publicly accessible. Don&apos;t paste paywalled
                or login-gated pages.
              </p>
            </div>
          )}

          {parsed && (
            <div>
              {parsed.warnings.length > 0 && (
                <div
                  className="rounded-md px-3 py-2 text-xs mb-4 space-y-1"
                  style={{
                    background: "rgba(234, 179, 8, 0.1)",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {parsed.warnings.map((w, i) => (
                    <div key={i}>· {w}</div>
                  ))}
                </div>
              )}

              {parsed.rows.length > 0 ? (
                <>
                  <p
                    className="text-sm mb-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Found <strong>{parsed.rows.length}</strong> contact
                    {parsed.rows.length === 1 ? "" : "s"}. Untick any you
                    don&apos;t want to import.
                  </p>
                  <div
                    className="rounded-lg overflow-hidden text-xs"
                    style={{ border: "1px solid var(--border-primary)" }}
                  >
                    <div
                      className="overflow-y-auto"
                      style={{ maxHeight: "320px" }}
                    >
                      <table className="w-full">
                        <thead
                          style={{
                            background: "var(--bg-surface)",
                            position: "sticky",
                            top: 0,
                          }}
                        >
                          <tr>
                            <th className="px-3 py-2 w-8">
                              <input
                                type="checkbox"
                                aria-label="Select all"
                                checked={
                                  parsed.rows.length > 0 &&
                                  selectedRows.size === parsed.rows.length
                                }
                                ref={(el) => {
                                  if (el)
                                    el.indeterminate =
                                      selectedRows.size > 0 &&
                                      selectedRows.size < parsed.rows.length;
                                }}
                                onChange={toggleAll}
                                className="w-3.5 h-3.5 rounded"
                                style={{ accentColor: "var(--accent)" }}
                              />
                            </th>
                            <th
                              className="text-left px-3 py-2 font-medium"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Name
                            </th>
                            <th
                              className="text-left px-3 py-2 font-medium"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Company
                            </th>
                            <th
                              className="text-left px-3 py-2 font-medium"
                              style={{ color: "var(--text-muted)" }}
                            >
                              Role
                            </th>
                            <th
                              className="text-left px-3 py-2 font-medium"
                              style={{ color: "var(--text-muted)" }}
                            >
                              LinkedIn
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.rows.map((r, i) => {
                            const checked = selectedRows.has(i);
                            return (
                              <tr
                                key={i}
                                onClick={() => toggleRow(i)}
                                style={{
                                  borderTop: "1px solid var(--border-primary)",
                                  cursor: "pointer",
                                  opacity: checked ? 1 : 0.45,
                                }}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleRow(i)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-3.5 h-3.5 rounded"
                                    style={{ accentColor: "var(--accent)" }}
                                  />
                                </td>
                                <td
                                  className="px-3 py-2"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {r.name}
                                </td>
                                <td
                                  className="px-3 py-2"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {r.company}
                                </td>
                                <td
                                  className="px-3 py-2"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {r.role ?? "—"}
                                </td>
                                <td
                                  className="px-3 py-2"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {r.linkedinUrl ? "✓" : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  No contacts found. Check your column headers and try again.
                </p>
              )}
            </div>
          )}
        </div>

        {parsed && parsed.rows.length > 0 && (
          <footer
            className="px-6 py-4 flex items-center justify-end gap-3"
            style={{ borderTop: "1px solid var(--border-primary)" }}
          >
            <button
              type="button"
              onClick={() => setParsed(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border-secondary)",
              }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedRows.size === 0}
              className="px-5 py-2 text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Import {selectedRows.size}{" "}
              {selectedRows.size === 1 ? "contact" : "contacts"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
