#!/usr/bin/env node

import { readFileSync } from "node:fs";

let report;
try {
  report = JSON.parse(readFileSync(0, "utf8"));
} catch (error) {
  console.error(`halal_health status=invalid reason=invalid_json error=${error.message}`);
  process.exit(2);
}

if (
  !report ||
  report.schemaVersion !== 1 ||
  !["healthy", "unhealthy"].includes(report.status) ||
  !Array.isArray(report.reasons) ||
  !Array.isArray(report.warnings) ||
  !report.observed ||
  typeof report.observed !== "object" ||
  Array.isArray(report.observed)
) {
  console.error("halal_health status=invalid reason=unsupported_health_schema");
  process.exit(2);
}

const reasons = report.reasons.join(",") || "none";
const warnings = report.warnings.join(",") || "none";
console.error(`halal_health status=${report.status} reasons=${reasons} warnings=${warnings}`);
process.exit(report.status === "healthy" ? 0 : 1);
