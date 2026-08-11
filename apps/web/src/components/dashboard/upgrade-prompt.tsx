import Link from "next/link";

export type UpgradePromptProps = {
  title: string;
  detail: string;
  ctaLabel: string;
  href: string;
  /** Compact = single row; default = card. */
  compact?: boolean;
};

/**
 * Contextual upgrade nudge. Informational only — authorization stays server-side.
 */
export function UpgradePrompt({
  title,
  detail,
  ctaLabel,
  href,
  compact = false,
}: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--ink)] bg-[var(--cream)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-medium">{title}</span>
          <span className="caption"> — {detail}</span>
        </p>
        <Link
          href={href}
          className="btn-ink bg-[var(--blue)] text-white px-3.5 py-1.5 text-xs whitespace-nowrap"
        >
          {ctaLabel}
        </Link>
      </div>
    );
  }

  return (
    <aside className="ink-card bg-[var(--cream)] p-5 space-y-3">
      <p className="font-medium text-base">{title}</p>
      <p className="caption text-sm">{detail}</p>
      <Link
        href={href}
        className="btn-ink bg-[var(--blue)] text-white px-4 py-2 text-xs inline-block"
      >
        {ctaLabel}
      </Link>
    </aside>
  );
}
