"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export type HealthStatus = "pass" | "warn" | "fail" | "loading";

const STATUS_LABELS: Record<HealthStatus, string> = {
  pass: "Healthy",
  warn: "Review",
  fail: "Blocking",
  loading: "Checking",
};

const STATUS_TONES: Record<HealthStatus, "primary" | "accent" | "danger" | "neutral"> = {
  pass: "primary",
  warn: "accent",
  fail: "danger",
  loading: "neutral",
};

export function HealthStatusCard({
  checks,
  summary,
}: {
  checks: Array<{ label: string; status: HealthStatus; detail: string }>;
  summary: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const blocking = checks.filter((check) => check.status === "fail").length;
  const review = checks.filter((check) => check.status === "warn").length;
  const overall: HealthStatus = blocking > 0 ? "fail" : review > 0 ? "warn" : checks.some((check) => check.status === "loading") ? "loading" : "pass";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment checks</CardTitle>
        <div className="flex items-center gap-2">
          <div role="status" aria-label="Overall deployment health">
            <Badge tone={STATUS_TONES[overall]}>{STATUS_LABELS[overall]}</Badge>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              try {
                if (!navigator.clipboard) throw new Error("Clipboard unavailable");
                await navigator.clipboard.writeText(summary);
                setCopyState("copied");
              } catch {
                setCopyState("error");
              }
            }}
            aria-label="Copy deployment health summary"
          >
            {copyState === "copied" ? "Copied" : "Copy summary"}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {checks.map((check) => (
          <div className="flex items-start justify-between gap-4 rounded-xl bg-background-subtle px-3 py-2.5" key={check.label}>
            <div>
              <p className="text-sm font-medium">{check.label}</p>
              <p className="mt-0.5 text-xs text-muted">{check.detail}</p>
            </div>
            <Badge tone={STATUS_TONES[check.status]}>{STATUS_LABELS[check.status]}</Badge>
          </div>
        ))}
        <p className="text-xs text-muted">
          Read-only checks from the selected chain. Resolve blocking items before signing protocol transactions.
        </p>
        <p className="text-xs text-muted" role="status" aria-live="polite">
          {copyState === "copied" ? "Health summary copied to the clipboard." : copyState === "error" ? "Could not copy automatically; check your browser permissions." : ""}
        </p>
      </CardBody>
    </Card>
  );
}
