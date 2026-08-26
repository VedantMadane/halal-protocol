#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^[0-9a-fA-F]{64}$/;
const COMMIT = /^[0-9a-fA-F]{40}$/;
const DECIMAL = /^(?:0*[1-9]\d*)(?:\.\d+)?$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SECTIONS = ["source", "valuePolicy", "retrieval", "authorization", "review"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isPending = (value) => typeof value === "string" && /^(?:pending|tbd|not yet|unresolved)\b/i.test(value.trim());
const isBlank = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");
function https(value) {
  try { return typeof value === "string" && new URL(value).protocol === "https:"; } catch { return false; }
}

export function validateCpiPolicy(policy) {
  const errors = [];
  const pending = [];
  const result = { schemaVersion: 1, status: "invalid", errors, pending };
  const error = (path, message) => errors.push(`${path}: ${message}`);
  if (!isObject(policy)) { error("record", "must be a JSON object"); return result; }
  if (policy.schemaVersion !== 1) error("schemaVersion", "must equal 1");
  if (!["draft", "reviewed", "rejected"].includes(policy.status)) error("status", "must be draft, reviewed, or rejected");
  const reviewed = policy.status === "reviewed";
  const required = (path, value) => {
    if (isBlank(value) || isPending(value)) {
      if (reviewed) error(path, "cannot be missing or pending in a reviewed record");
      else pending.push(path);
      return false;
    }
    return true;
  };
  const section = (name) => {
    if (!isObject(policy[name])) { error(name, "must be an object"); return false; }
    return true;
  };
  if (section("source")) {
    const source = policy.source;
    for (const field of ["publishingAgency", "indexName", "seriesId", "geography", "publicationCadence", "releaseTimezone", "policyOwner"]) required(`source.${field}`, source[field]);
    if (required("source.sourceUrl", source.sourceUrl) && !https(source.sourceUrl)) error("source.sourceUrl", "must be an HTTPS URL");
    if (required("source.reviewDate", source.reviewDate) && !UTC.test(source.reviewDate)) error("source.reviewDate", "must use an ISO-8601 UTC timestamp");
  }

  if (section("valuePolicy")) {
    const value = policy.valuePolicy;
    for (const field of ["units", "referencePeriod", "conversion", "rounding", "missingValue", "duplicateValue", "futureStaleOrdering", "revisionPolicy"]) required(`valuePolicy.${field}`, value[field]);
    if (required("valuePolicy.reportedAt", value.reportedAt) && value.reportedAt !== "source_publication_timestamp") error("valuePolicy.reportedAt", "must be source_publication_timestamp");
    if (required("valuePolicy.baseIndex", value.baseIndex) && !DECIMAL.test(value.baseIndex)) error("valuePolicy.baseIndex", "must be a positive decimal string");
  }

  if (section("retrieval")) {
    const retrieval = policy.retrieval;
    for (const field of ["transport", "parserRepository", "parserVersion", "retrievalTimestamp", "parserTestCommand", "reviewer"]) required(`retrieval.${field}`, retrieval[field]);
    if (required("retrieval.parserCommit", retrieval.parserCommit) && !COMMIT.test(retrieval.parserCommit)) error("retrieval.parserCommit", "must be exactly 40 hexadecimal characters");
    if (required("retrieval.rawResponseSha256", retrieval.rawResponseSha256) && !HASH.test(retrieval.rawResponseSha256)) error("retrieval.rawResponseSha256", "must be exactly 64 hexadecimal characters without 0x");
    if (required("retrieval.rawResponseArchive", retrieval.rawResponseArchive) && !https(retrieval.rawResponseArchive)) error("retrieval.rawResponseArchive", "must be an HTTPS evidence URL");
  }

  if (section("authorization")) {
    const authorization = policy.authorization;
    for (const field of ["signerCustody", "relayer", "psmRoleGrant", "sourceMetadata", "monitoring", "rotation", "emergencyCorrection"]) required(`authorization.${field}`, authorization[field]);
    const signers = authorization.signerAddresses;
    if (Array.isArray(signers)) {
      if (signers.length === 0) error("authorization.signerAddresses", "must contain at least one signer");
      const seen = new Set();
      for (const [index, signer] of signers.entries()) {
        if (typeof signer !== "string" || !ADDRESS.test(signer) || /^0x0{40}$/i.test(signer)) error(`authorization.signerAddresses[${index}]`, "must be a non-zero Ethereum address");
        const normalized = typeof signer === "string" ? signer.toLowerCase() : signer;
        if (seen.has(normalized)) error(`authorization.signerAddresses[${index}]`, "duplicates another signer");
        seen.add(normalized);
      }
      if (!Number.isInteger(authorization.threshold) || authorization.threshold < 1 || authorization.threshold > signers.length) error("authorization.threshold", "must be an integer between 1 and the signer count");
    } else if (reviewed || !isPending(signers)) {
      error("authorization.signerAddresses", "must be an array or an explicit pending value");
    } else pending.push("authorization.signerAddresses");
  }

  if (section("review")) {
    const review = policy.review;
    if (required("review.decisionDate", review.decisionDate) && !UTC.test(review.decisionDate)) error("review.decisionDate", "must use an ISO-8601 UTC timestamp");
    const links = review.evidenceLinks;
    if (Array.isArray(links)) {
      if (links.length === 0) error("review.evidenceLinks", "must contain at least one HTTPS link");
      for (const [index, link] of links.entries()) if (!https(link)) error(`review.evidenceLinks[${index}]`, "must be an HTTPS URL");
    } else if (reviewed || !isPending(links)) error("review.evidenceLinks", "must be an array or an explicit pending value");
    else pending.push("review.evidenceLinks");
    const reviewers = review.independentReviewers;
    if (Array.isArray(reviewers)) {
      if (reviewers.length === 0) error("review.independentReviewers", "must contain at least one reviewer");
      for (const [index, reviewer] of reviewers.entries()) {
        if (!isObject(reviewer)) { error(`review.independentReviewers[${index}]`, "must be an object"); continue; }
        if (required(`review.independentReviewers[${index}].name`, reviewer.name) && required(`review.independentReviewers[${index}].evidenceUrl`, reviewer.evidenceUrl) && !https(reviewer.evidenceUrl)) error(`review.independentReviewers[${index}].evidenceUrl`, "must be an HTTPS URL");
      }
    } else if (reviewed || !isPending(reviewers)) error("review.independentReviewers", "must be an array or an explicit pending value");
    else pending.push("review.independentReviewers");
  }
  if (policy.status === "rejected") error("status", "rejected policies are never reviewable");
  if (errors.length === 0) result.status = reviewed ? "reviewable" : "draft";
  return result;
}

function usage() { console.log("Usage: node scripts/validate-cpi-policy.mjs --input <policy.json> [--json]"); }
function parseArgs(args) {
  const options = { json: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--help") { usage(); return null; }
    if (args[index] === "--json") { options.json = true; continue; }
    if (args[index] === "--input" && args[index + 1] && !args[index + 1].startsWith("--")) { options.input = resolve(args[++index]); continue; }
    throw new Error(`Invalid argument: ${args[index]}`);
  }
  if (!options.input) throw new Error("Missing --input");
  return options;
}

async function main(args = process.argv.slice(2)) {
  try {
    const options = parseArgs(args);
    if (options === null) return;
    const report = validateCpiPolicy(JSON.parse(await readFile(options.input, "utf8")));
    if (options.json) console.log(JSON.stringify({ ...report, input: options.input }, null, 2));
    else { console.log(`status=${report.status}`); for (const path of report.pending) console.log(`pending=${path}`); for (const message of report.errors) console.log(`error=${message}`); }
    process.exitCode = report.status === "draft" || report.status === "reviewable" ? 0 : 1;
  } catch (cause) {
    const report = { schemaVersion: 1, status: "invalid", errors: [cause.message], pending: [] };
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2)); else console.error(`error=${cause.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
