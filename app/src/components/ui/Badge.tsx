import type { HTMLAttributes } from "react";

type BadgeTone = "neutral" | "primary" | "accent" | "danger";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-background-subtle text-muted",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
