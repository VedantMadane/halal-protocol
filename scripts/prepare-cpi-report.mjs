#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CPI_PRECISION = 1_000_000n;
export const MIN_CPI = 100_000n;
export const MAX_CPI = 2_000_000n;

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a nonempty string`);
  return value;
}

function positiveInteger(value, name) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== "string" || !/^[0-9]+$/.test(text) || BigInt(text) === 0n) {
    throw new Error(`${name} must be a positive integer`);
  }
  return BigInt(text).toString();
}

export function normalizeSourceId(value) {
  const sourceId = requireString(value, "sourceId").toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(sourceId) || /^0x0+$/.test(sourceId)) {
    throw new Error("sourceId must be a nonzero bytes32 hex value");
  }
  return sourceId;
}

export function normalizeAddress(value, name = "adapter") {
  const address = requireString(value, name).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address) || /^0x0+$/.test(address)) {
    throw new Error(`${name} must be a nonzero address`);
  }
  return address;
}

export function normalizeCpi(value) {
  const text = requireString(value, "cpi");
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) {
    throw new Error("cpi must be a nonnegative decimal with at most 6 fractional digits");
  }
  const [whole, fraction = ""] = text.split(".");
  const normalized = BigInt(whole) * CPI_PRECISION + BigInt(fraction.padEnd(6, "0"));
  if (normalized < MIN_CPI || normalized > MAX_CPI) {
    throw new Error("cpi is outside the PSM range [0.1, 2.0]");
  }
  return normalized.toString();
}

export function prepareReport(input, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input must be a JSON object");
  const chainId = positiveInteger(input.chainId, "chainId");
  const adapter = normalizeAddress(input.adapter);
  const sourceId = normalizeSourceId(input.sourceId);
  const reportedCPI = normalizeCpi(input.cpi);
  const reportedAt = positiveInteger(input.reportedAt, "reportedAt");
  if (BigInt(reportedAt) > BigInt(nowSeconds)) throw new Error("reportedAt cannot be in the future");

  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      CPIReport: [
        { name: "reportedCPI", type: "uint256" },
        { name: "reportedAt", type: "uint256" },
        { name: "sourceId", type: "bytes32" },
      ],
    },
    primaryType: "CPIReport",
    domain: {
      name: "Halal CPI Report Adapter",
      version: "1",
      chainId,
      verifyingContract: adapter,
    },
    message: { reportedCPI, reportedAt, sourceId },
  };

  return {
    sourceId,
    chainId,
    adapter,
    reportedCPI,
    reportedAt,
    typedData,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--") || i + 1 >= argv.length) throw new Error(`invalid argument: ${arg}`);
    options[arg.slice(2)] = argv[++i];
  }
  if (!options.input || !options["typed-data-out"]) {
    throw new Error("usage: prepare-cpi-report.mjs --input <json> --typed-data-out <json>");
  }
  return options;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const inputPath = path.resolve(options.input);
  const typedDataPath = path.resolve(options["typed-data-out"]);
  const report = prepareReport(JSON.parse(fs.readFileSync(inputPath, "utf8")));
  fs.writeFileSync(typedDataPath, `${JSON.stringify(report.typedData, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    sourceId: report.sourceId,
    chainId: report.chainId,
    adapter: report.adapter,
    reportedCPI: report.reportedCPI,
    reportedAt: report.reportedAt,
    typedDataPath: typedDataPath,
  })}\n`);
}

const entrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (entrypoint) main();
