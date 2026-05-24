"use client";

/**
 * Two small links that route to Angelina's Delphi (delphi.ai/angelina-yang)
 * with a prefilled message that includes the app name. Delphi reads the
 * `message` query param and surfaces it as the conversation starter, so
 * Angelina knows which Lab tool the user came from.
 *
 * Drop into any Lab app's footer/header. Keep this component identical
 * across repos so future Delphi changes (e.g., switching to ?prompt=)
 * are a single grep-and-replace.
 */

const DELPHI_URL = "https://www.delphi.ai/angelina-yang";

function buildDelphiUrl(message: string): string {
  return `${DELPHI_URL}?message=${encodeURIComponent(message)}`;
}

interface SupportLinksProps {
  appName: string;
  /** Style override. Defaults to muted text + bullet separator. */
  className?: string;
}

export function SupportLinks({ appName, className = "" }: SupportLinksProps) {
  const featureUrl = buildDelphiUrl(`I have a feature idea for ${appName}: `);
  const issueUrl = buildDelphiUrl(`I'm having an issue with ${appName}: `);

  return (
    <span className={`inline-flex items-center gap-2 text-xs flex-wrap ${className}`}>
      <a
        href={featureUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:underline"
        style={{ color: "var(--text-muted)" }}
        title="Suggest a feature, opens Angelina's Delphi"
      >
        Request a feature
      </a>
      <span style={{ color: "var(--text-faint)" }}>·</span>
      <a
        href={issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:underline"
        style={{ color: "var(--text-muted)" }}
        title="Report an issue, opens Angelina's Delphi"
      >
        Something not working?
      </a>
    </span>
  );
}
