type Tone = "primary" | "accent" | "danger" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  danger: "bg-danger",
  neutral: "bg-muted",
};

export function ProgressBar({
  ratio,
  tone = "primary",
  className = "",
  trackClassName = "",
}: {
  /** 0-1 */
  ratio: number;
  tone?: Tone;
  className?: string;
  trackClassName?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100;
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-background-subtle ${trackClassName}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${TONE_CLASSES[tone]} ${className}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
