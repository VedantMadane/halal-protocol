"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

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
}: {
  checks: Array<{ label: string; status: HealthStatus; detail: string }>;
}) {
  const blocking = checks.filter((check) => check.status === "fail").length;
  const review = checks.filter((check) => check.status === "warn").length;
  const overall: HealthStatus = blocking > 0 ? "fail" : review > 0 ? "warn" : checks.some((check) => check.status === "loading") ? "loading" : "pass";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment checks</CardTitle>
        <Badge tone={STATUS_TONES[overall]}>{STATUS_LABELS[overall]}</Badge>
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
      </CardBody>
    </Card>
  );
}
