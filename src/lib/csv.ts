"use client";

import Papa from "papaparse";
import { type Contact, deriveFirstName } from "./types";

export type CsvParseResult = {
  rows: Array<
    Pick<Contact, "name" | "company" | "role" | "linkedinUrl" | "notes" | "firstName">
  >;
  warnings: string[];
};

// Map common header variants to canonical fields.
const FIELD_ALIASES: Record<string, "name" | "company" | "role" | "linkedinUrl" | "notes"> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  contact: "name",

  company: "company",
  organization: "company",
  org: "company",
  employer: "company",

  role: "role",
  title: "role",
  position: "role",
  "job title": "role",

  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  "linkedin profile": "linkedinUrl",
  url: "linkedinUrl",
  profile: "linkedinUrl",

  notes: "notes",
  note: "notes",
  comment: "notes",
};

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/_/g, " ");
}

function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (!/linkedin\.com\/in\//i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, "");
}

export function parseCsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeKey(h),
  });

  const warnings: string[] = [];
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      warnings.push(`Row ${e.row}: ${e.message}`);
    }
  }

  const rows: CsvParseResult["rows"] = [];
  for (const raw of result.data) {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const canonical = FIELD_ALIASES[k];
      if (canonical) row[canonical] = String(v ?? "").trim();
    }

    const name = row.name ?? "";
    const company = row.company ?? "";
    if (!name) continue;

    rows.push({
      name,
      firstName: deriveFirstName(name),
      company,
      role: row.role || null,
      linkedinUrl: normalizeLinkedInUrl(row.linkedinUrl),
      notes: row.notes ?? "",
    });
  }

  if (rows.length === 0 && result.data.length > 0) {
    warnings.push(
      "No usable rows. Make sure your CSV has at least a 'name' column."
    );
  }

  return { rows, warnings };
}

// Parse tab-separated rows pasted into a textarea. First line is the header.
// Same field aliases as CSV.
export function parseTsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter: "\t",
    transformHeader: (h) => normalizeKey(h),
  });

  const warnings: string[] = [];
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      warnings.push(`Row ${e.row}: ${e.message}`);
    }
  }

  const rows: CsvParseResult["rows"] = [];
  for (const raw of result.data) {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const canonical = FIELD_ALIASES[k];
      if (canonical) row[canonical] = String(v ?? "").trim();
    }
    const name = row.name ?? "";
    if (!name) continue;
    rows.push({
      name,
      firstName: deriveFirstName(name),
      company: row.company ?? "",
      role: row.role || null,
      linkedinUrl: normalizeLinkedInUrl(row.linkedinUrl),
      notes: row.notes ?? "",
    });
  }

  if (rows.length === 0 && result.data.length > 0) {
    warnings.push(
      "No usable rows. Paste rows with a header line (Name, Company, Role, LinkedIn URL)."
    );
  }

  return { rows, warnings };
}
