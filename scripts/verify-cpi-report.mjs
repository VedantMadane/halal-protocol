#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const ADDRESS_IN_OUTPUT_PATTERN = /0x[0-9a-fA-F]{40}/g;
const SIGNATURE_PATTERN = /^0x[0-9a-fA-F]{130}$/;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      console.log("Usage: node scripts/verify-cpi-report.mjs --typed-data <json> --rpc-url <url> --adapter <address> --signers <address,...> --signatures <signature,...>");
      process.exit(0);
    }
    if (!argument.startsWith("--") || index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
      throw new Error(`Invalid argument: ${argument}`);
    }
    const name = argument.slice(2);
    if (!["typed-data", "rpc-url", "adapter", "signers", "signatures"].includes(name)) throw new Error(`Unknown option: ${argument}`);
    options[name] = argv[++index];
  }
  for (const name of ["typed-data", "rpc-url", "adapter", "signers", "signatures"]) {
    if (!options[name]) throw new Error(`Missing --${name}`);
  }
  return options;
}

function normalizeAddress(value) {
  if (!ADDRESS_PATTERN.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`invalid signer address: ${value}`);
  }
  return value.toLowerCase();
}

function runCast(args, castCommand) {
  const result = spawnSync(castCommand, args, { encoding: "utf8" });
  if (result.error) throw new Error(`could not run cast: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`cast command failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout.trim();
}

function firstCastValue(output, name) {
  const value = output.split(/\s+/)[0];
  if (!value) throw new Error(`cast returned no value for ${name}`);
  return value;
}

function normalizeSignature(value) {
  if (!SIGNATURE_PATTERN.test(value)) throw new Error("each signature must be 65-byte hex data");
  return value;
}

export function validateTypedData(typedData) {
  if (!typedData || typeof typedData !== "object" || Array.isArray(typedData)) {
    throw new Error("typed data must be a JSON object");
  }
  if (typedData.primaryType !== "CPIReport") throw new Error("typed data primaryType must be CPIReport");
  if (typedData.domain?.name !== "Halal CPI Report Adapter" || typedData.domain?.version !== "1") {
    throw new Error("typed data has an unexpected CPI adapter domain");
  }
  if (!ADDRESS_PATTERN.test(typedData.domain?.verifyingContract ?? "") || /^0x0{40}$/i.test(typedData.domain.verifyingContract)) {
    throw new Error("typed data domain must include a valid verifyingContract");
  }
  if (!/^[0-9]+$/.test(String(typedData.domain?.chainId)) || BigInt(typedData.domain.chainId) === 0n) {
    throw new Error("typed data domain must include a positive chainId");
  }
  const message = typedData.message;
  if (
    !message ||
    typeof message !== "object" ||
    !/^0x[0-9a-fA-F]{64}$/.test(message.sourceId ?? "") ||
    /^0x0{64}$/i.test(message.sourceId)
  ) {
    throw new Error("typed data message must include a bytes32 sourceId");
  }
  if (!/^[0-9]+$/.test(String(message.reportedCPI)) || !/^[0-9]+$/.test(String(message.reportedAt))) {
    throw new Error("typed data message must include integer reportedCPI and reportedAt");
  }
  if (BigInt(message.reportedCPI) < 100_000n || BigInt(message.reportedCPI) > 2_000_000n) {
    throw new Error("typed data reportedCPI is outside the PSM range [0.1, 2.0]");
  }
  if (BigInt(message.reportedAt) === 0n) throw new Error("typed data reportedAt must be positive");
  return typedData;
}

export function validateSignatureSet(signerValues, signatureValues) {
  const signers = signerValues.split(",").map(normalizeAddress);
  const signatures = signatureValues.split(",").map(normalizeSignature);
  if (signers.length === 0 || signers.length !== signatures.length) {
    throw new Error("signers and signatures must contain the same nonzero number of entries");
  }
  for (let index = 1; index < signers.length; index += 1) {
    if (signers[index] <= signers[index - 1]) {
      throw new Error("signers must be unique and strictly ascending by address");
    }
  }
  return { signers, signatures };
}

export function verifyReport({ typedDataPath, rpcUrl, adapter, signerValues, signatureValues, castCommand = "cast" }) {
  const typedData = validateTypedData(JSON.parse(readFileSync(typedDataPath, "utf8")));
  const { signers, signatures } = validateSignatureSet(signerValues, signatureValues);
  const normalizedAdapter = normalizeAddress(adapter);
  if (typedData.domain.verifyingContract.toLowerCase() !== normalizedAdapter) {
    throw new Error("typed data verifyingContract does not match --adapter");
  }

  const chainId = BigInt(firstCastValue(runCast(["chain-id", "--rpc-url", rpcUrl], castCommand), "chain ID"));
  if (BigInt(typedData.domain.chainId) !== chainId) throw new Error("typed data chainId does not match the RPC");
  const onChainSourceId = firstCastValue(
    runCast(["call", normalizedAdapter, "sourceId()(bytes32)", "--rpc-url", rpcUrl], castCommand),
    "source ID",
  ).toLowerCase();
  if (typedData.message.sourceId.toLowerCase() !== onChainSourceId) {
    throw new Error("typed data sourceId does not match the adapter");
  }
  const threshold = BigInt(
    firstCastValue(runCast(["call", normalizedAdapter, "threshold()(uint256)", "--rpc-url", rpcUrl], castCommand), "threshold"),
  );
  if (threshold !== BigInt(signers.length)) throw new Error("signature count does not match the adapter threshold");
  const onChainSigners = (runCast(["call", normalizedAdapter, "getSigners()(address[])", "--rpc-url", rpcUrl], castCommand).match(ADDRESS_IN_OUTPUT_PATTERN) ?? [])
    .map((signer) => signer.toLowerCase());
  if (onChainSigners.length === 0) throw new Error("adapter returned an empty signer set");
  for (const signer of signers) {
    if (!onChainSigners.includes(signer)) throw new Error(`signer is not configured on the adapter: ${signer}`);
  }
  for (let index = 0; index < signers.length; index += 1) {
    const result = runCast(
      ["wallet", "verify", "--data", "--from-file", typedDataPath, "--address", signers[index], signatures[index]],
      castCommand,
    );
    if (!result) throw new Error(`signature ${index} returned no verification result`);
  }
  return {
    status: "verified",
    typedDataPath: path.resolve(typedDataPath),
    adapter: typedData.domain.verifyingContract.toLowerCase(),
    sourceId: typedData.message.sourceId.toLowerCase(),
    signers,
    signatureCount: signatures.length,
    adapterSignerCount: onChainSigners.length,
  };
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = verifyReport({
    typedDataPath: path.resolve(options["typed-data"]),
    rpcUrl: options["rpc-url"],
    adapter: options.adapter,
    signerValues: options.signers,
    signatureValues: options.signatures,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const entrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (entrypoint) {
  try {
    main();
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
