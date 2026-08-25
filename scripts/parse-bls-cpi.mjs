#!/usr/bin/env node

import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeAddress, normalizeSourceId, prepareReport } from "./prepare-cpi-report.mjs";

export const BLS_SERIES_ID = "CUUR0000SA0";

export function normalizeSha256(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error("sourceResponseSha256 must be a 64-character SHA-256 hex string");
  }
  return value.toLowerCase();
}

function parseDecimal(value, name) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(`${name} must be a nonnegative decimal string`);
  }
  const [whole, fraction = ""] = value.split(".");
  return { integer: BigInt(whole + fraction), scale: fraction.length };
}

function formatScaled(value) {
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}

export function parseBlsResponse(payload) {
  if (payload?.status !== "REQUEST_SUCCEEDED") throw new Error("BLS response did not succeed");
  const series = payload?.Results?.series;
  if (!Array.isArray(series) || series.length !== 1 || series[0]?.seriesID !== BLS_SERIES_ID) {
    throw new Error(`BLS response must contain exactly ${BLS_SERIES_ID}`);
  }
  const data = series[0].data;
  if (!Array.isArray(data) || data.length !== 1) throw new Error("BLS response must contain exactly one data point");
  const point = data[0];
  if (point === null || typeof point !== "object" || Array.isArray(point)) {
    throw new Error("BLS data point must be an object");
  }
  if (typeof point.year !== "string" || !/^\d{4}$/.test(point.year) || !/^M(?:0[1-9]|1[0-2])$/.test(point.period)) {
    throw new Error("BLS data point must identify a monthly period");
  }
  if (point.latest !== "true") throw new Error("BLS data point must be marked latest");
  if (Array.isArray(point.footnotes) && point.footnotes.some((footnote) => footnote?.code === "P")) {
    throw new Error("BLS data point is preliminary");
  }
  const rawIndex = parseDecimal(point.value, "BLS value");
  return { ...point, rawIndex };
}

export function ratioToCpi(rawIndex, baseIndex) {
  if (rawIndex.integer === 0n || baseIndex.integer === 0n) throw new Error("CPI indexes must be positive");
  const numerator = rawIndex.integer * 10n ** BigInt(baseIndex.scale) * 1_000_000n;
  const denominator = 10n ** BigInt(rawIndex.scale) * baseIndex.integer;
  return (numerator + denominator / 2n) / denominator;
}

export function buildBlsReport(
  { payload, baseIndex, chainId, adapter, sourceId, reportedAt, sourceResponseSha256 = null },
  nowSeconds,
) {
  const point = parseBlsResponse(payload);
  const parsedBase = parseDecimal(baseIndex, "baseIndex");
  const scaledCpi = ratioToCpi(point.rawIndex, parsedBase);
  const report = prepareReport(
    {
      chainId,
      adapter,
      sourceId,
      cpi: formatScaled(scaledCpi),
      reportedAt,
    },
    nowSeconds,
  );
  return {
    ...report,
    cpi: formatScaled(scaledCpi),
    source: {
      seriesId: BLS_SERIES_ID,
      year: point.year,
      period: point.period,
      periodName: point.periodName ?? null,
      rawIndex: point.value,
      baseIndex,
      rounding: "nearest CPI_PRECISION unit, ties rounded up",
      responseSha256: sourceResponseSha256 === null ? null : normalizeSha256(sourceResponseSha256),
    },
  };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") || i + 1 >= argv.length) throw new Error(`invalid argument: ${arg}`);
    options[arg.slice(2)] = argv[++i];
  }
  const required = ["input", "output", "base-index", "chain-id", "adapter", "source-id", "reported-at"];
  for (const key of required) if (!options[key]) throw new Error(`missing --${key}`);
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const outputPath = path.resolve(options.output);
  const inputBytes = fs.readFileSync(path.resolve(options.input));
  const result = buildBlsReport(
    {
      payload: JSON.parse(inputBytes),
      baseIndex: options["base-index"],
      chainId: options["chain-id"],
      adapter: normalizeAddress(options.adapter),
      sourceId: normalizeSourceId(options["source-id"]),
      reportedAt: options["reported-at"],
      sourceResponseSha256: createHash("sha256").update(inputBytes).digest("hex"),
    },
    Math.floor(Date.now() / 1000),
  );
  const output = {
    chainId: result.chainId,
    adapter: result.adapter,
    sourceId: result.sourceId,
    cpi: result.cpi,
    reportedAt: result.reportedAt,
    source: result.source,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

const entrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (entrypoint) main();
