import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  info: "bg-background-subtle text-foreground border-card-border",
  success: "bg-primary-soft text-primary border-primary/20",
  warning: "bg-accent-soft text-accent border-accent/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`} role="alert">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="text-sm opacity-90">{children}</div>
    </div>
  );
}
