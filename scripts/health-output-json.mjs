#!/usr/bin/env node

import { readFileSync } from "node:fs";

const records = {};
const reasons = [];
const warnings = [];

for (const line of readFileSync(0, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)=(.*)$/);
  if (!match) continue;
  const [, key, value] = match;
  if (key === "status") records.status = value;
  else if (key === "reason") reasons.push(value);
  else if (key === "warning") warnings.push(value);
  else records[key] = value;
}

const unique = (values) => [...new Set(values.filter(Boolean))];
const status = records.status ?? (reasons.length > 0 ? "unhealthy" : "unknown");
delete records.status;

process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  status,
  reasons: unique(reasons),
  warnings: unique(warnings),
  observed: records,
}, null, 2)}\n`);
