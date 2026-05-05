"use client";

import { useState } from "react";
import {
  type Templates,
  type Contact,
  renderTemplate,
} from "@/lib/types";

interface Props {
  templates: Templates;
  sampleContact: Contact | null;
  onChange: (patch: Partial<Templates>) => void;
}

export function TemplatesPanel({ templates, sampleContact, onChange }: Props) {
  const [open, setOpen] = useState(true);

  const ctx = {
    name: sampleContact?.name ?? "Jane Doe",
    firstName: sampleContact?.firstName ?? "Jane",
    company: sampleContact?.company ?? "Acme AI",
    role: sampleContact?.role ?? "CEO",
    sender: templates.senderName || "Your name",
  };

  const inputStyle = {
    background: "var(--bg-input)",
    border: "1px solid var(--border-secondary)",
    color: "var(--text-primary)",
  };

  const previewStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-primary)",
    color: "var(--text-secondary)",
  };

  return (
    <section
      className="rounded-2xl"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-secondary)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Message templates
          </h3>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Variables: {"{first_name}"}, {"{name}"}, {"{company}"}, {"{role}"},{" "}
            {"{sender}"}
          </p>
        </div>
        <span style={{ color: "var(--text-muted)" }}>
          {open ? "Hide" : "Edit"}
        </span>
      </button>

      {open && (
        <div
          className="px-5 pb-5 grid gap-5 md:grid-cols-2"
          style={{ borderTop: "1px solid var(--border-primary)" }}
        >
          <div className="space-y-4 pt-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Your name (sender)
              </label>
              <input
                type="text"
                value={templates.senderName}
                onChange={(e) =>
                  onChange({ senderName: e.target.value })
                }
                placeholder="How you sign off"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Message 1 (first DM)
              </label>
              <textarea
                value={templates.message1}
                onChange={(e) => onChange({ message1: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 resize-y"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Follow-up message
              </label>
              <textarea
                value={templates.followUp}
                onChange={(e) => onChange({ followUp: e.target.value })}
                rows={5}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 resize-y"
                style={inputStyle}
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Send follow-up after (days)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={templates.followUpDelayDays}
                onChange={(e) =>
                  onChange({
                    followUpDelayDays: Math.max(
                      1,
                      Math.min(60, Number(e.target.value) || 5)
                    ),
                  })
                }
                className="w-24 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1"
                style={inputStyle}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Preview · Message 1{sampleContact ? ` for ${sampleContact.name}` : ""}
              </label>
              <pre
                className="px-3 py-3 rounded-lg text-sm whitespace-pre-wrap font-sans leading-relaxed"
                style={previewStyle}
              >
                {renderTemplate(templates.message1, ctx)}
              </pre>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Preview · Follow-up
              </label>
              <pre
                className="px-3 py-3 rounded-lg text-sm whitespace-pre-wrap font-sans leading-relaxed"
                style={previewStyle}
              >
                {renderTemplate(templates.followUp, ctx)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
