#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const MASK_64 = (1n << 64n) - 1n;
const KECCAK_RATE = 136;
const ROTATION = [
  0, 36, 3, 41, 18,
  1, 44, 10, 45, 2,
  62, 6, 43, 15, 61,
  28, 55, 25, 21, 56,
  27, 20, 39, 8, 14,
];
const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

function fail(message) {
  throw new Error(message);
}

function rotateLeft64(value, amount) {
  if (amount === 0) return value;
  return ((value << BigInt(amount)) | (value >> BigInt(64 - amount))) & MASK_64;
}

// Ethereum uses Keccak-256 (padding suffix 0x01), which is not NIST SHA3-256 (suffix 0x06).
// Keeping this small implementation local makes the verifier independent of RPC, Foundry, and
// frontend dependencies while allowing it to check selector/signature consistency.
export function keccak256(bytes) {
  const padded = [...bytes, 0x01];
  while (padded.length % KECCAK_RATE !== KECCAK_RATE - 1) padded.push(0);
  padded.push(0x80);
  const state = Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += KECCAK_RATE) {
    for (let lane = 0; lane < KECCAK_RATE / 8; lane += 1) {
      let value = 0n;
      for (let byte = 0; byte < 8; byte += 1) value |= BigInt(padded[offset + lane * 8 + byte]) << BigInt(byte * 8);
      state[lane] ^= value;
    }
    for (const roundConstant of ROUND_CONSTANTS) {
      const columns = Array(5).fill(0n);
      for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) columns[x] ^= state[x + 5 * y];
      for (let x = 0; x < 5; x += 1) {
        const correction = columns[(x + 4) % 5] ^ rotateLeft64(columns[(x + 1) % 5], 1);
        for (let y = 0; y < 5; y += 1) state[x + 5 * y] = (state[x + 5 * y] ^ correction) & MASK_64;
      }
      const rotated = Array(25).fill(0n);
      for (let x = 0; x < 5; x += 1) {
        for (let y = 0; y < 5; y += 1) {
          const destination = y + 5 * ((2 * x + 3 * y) % 5);
          rotated[destination] = rotateLeft64(state[x + 5 * y], ROTATION[x * 5 + y]);
        }
      }
      for (let x = 0; x < 5; x += 1) {
        for (let y = 0; y < 5; y += 1) {
          const current = x + 5 * y;
          state[current] = (rotated[current] ^ ((MASK_64 ^ rotated[(x + 1) % 5 + 5 * y]) & rotated[(x + 2) % 5 + 5 * y])) & MASK_64;
        }
      }
      state[0] ^= roundConstant;
    }
  }
  const output = [];
  for (let lane = 0; lane < KECCAK_RATE / 8; lane += 1) {
    for (let byte = 0; byte < 8; byte += 1) output.push(Number((state[lane] >> BigInt(byte * 8)) & 0xffn));
  }
  return output.slice(0, 32).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function readObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be a JSON object.`);
  return value;
}

function normalizeAddress(value, label) {
  if (typeof value !== "string" || !ADDRESS.test(value) || /^0x0{40}$/i.test(value)) {
    fail(`${label} must be a non-zero Ethereum address.`);
  }
  return value.toLowerCase();
}

function decimal(value, label) {
  if (typeof value !== "string" || !DECIMAL.test(value)) fail(`${label} must be a non-negative decimal string.`);
  return BigInt(value);
}

function selector(data, index) {
  if (data === "0x") return null;
  if (data.length < 10) fail(`calldatas[${index}] is shorter than a 4-byte selector.`);
  return data.slice(0, 10).toLowerCase();
}

function parseSignature(signature) {
  const match = /^[_a-zA-Z][_a-zA-Z0-9]*\((.*)\)$/.exec(signature);
  if (!match) fail(`Invalid function signature in policy: ${signature}`);
  return match[1] === "" ? [] : match[1].split(",").map((type) => type.trim());
}

function word(args, index, signature) {
  const start = index * 64;
  if (start + 64 > args.length) fail(`calldata for ${signature} is truncated at argument ${index}`);
  return args.slice(start, start + 64);
}

function isDynamicType(type) {
  return type === "string" || type === "bytes";
}

function isSupportedAbiType(type) {
  return /^(address|bool|bytes(?:[1-9]|[12][0-9]|3[0-2])|uint(?:8|16|32|64|128|256)?)$/.test(type) || isDynamicType(type);
}

function validateAbiEncoding(data, signature, index) {
  const types = parseSignature(signature);
  const args = data.slice(10);
  const headLength = types.length * 64;
  const headLengthBytes = types.length * 32;
  if (args.length < headLength) fail(`calldatas[${index}] is truncated for ${signature}`);
  if (args.length % 64 !== 0) fail(`calldatas[${index}] has a non-word-aligned ABI payload for ${signature}`);

  const dynamicRanges = [];
  for (let argumentIndex = 0; argumentIndex < types.length; argumentIndex += 1) {
    const type = types[argumentIndex];
    const currentWord = word(args, argumentIndex, signature);
    if (isDynamicType(type)) {
      const offset = BigInt(`0x${currentWord}`);
      if (offset % 32n !== 0n || offset < BigInt(headLengthBytes) || offset > BigInt(args.length / 2 - 32)) {
        fail(`calldatas[${index}] has an invalid ${type} offset for ${signature}`);
      }
      const tailStart = Number(offset) * 2;
      const lengthWord = args.slice(tailStart, tailStart + 64);
      if (lengthWord.length !== 64) fail(`calldatas[${index}] has a truncated ${type} length for ${signature}`);
      const byteLength = BigInt(`0x${lengthWord}`);
      const paddedLength = ((byteLength + 31n) / 32n) * 32n;
      const tailEnd = offset + 32n + paddedLength;
      if (tailEnd > BigInt(args.length / 2)) fail(`calldatas[${index}] has a truncated ${type} value for ${signature}`);
      dynamicRanges.push([Number(offset), Number(tailEnd)]);
      continue;
    }
    if (type === "address" && !/^0{24}[0-9a-f]{40}$/i.test(currentWord)) {
      fail(`calldatas[${index}] has a non-canonical address for ${signature}`);
    }
    if (type === "bool" && !/^0{63}[01]$/i.test(currentWord)) {
      fail(`calldatas[${index}] has a non-canonical bool for ${signature}`);
    }
    const uintType = /^uint(8|16|32|64|128|256)?$/.exec(type);
    if (uintType) {
      const bits = Number(uintType[1] ?? 256);
      if (bits < 256 && BigInt(`0x${currentWord}`) >= 2n ** BigInt(bits)) {
        fail(`calldatas[${index}] has an out-of-range ${type} value for ${signature}`);
      }
    }
    const fixedBytes = /^bytes([1-9]|[12][0-9]|3[0-2])$/.exec(type);
    if (fixedBytes) {
      const usedBytes = Number(fixedBytes[1]);
      if (!new RegExp(`^[0-9a-f]{${usedBytes * 2}}0{${64 - usedBytes * 2}}$`, "i").test(currentWord)) {
        fail(`calldatas[${index}] has non-canonical ${type} data for ${signature}`);
      }
    }
    if (!/^(address|bool|bytes(?:[1-9]|[12][0-9]|3[0-2])|uint(?:8|16|32|64|128|256)?)$/.test(type)) {
      fail(`calldatas[${index}] uses an unsupported ABI type ${type}`);
    }
  }

  if (dynamicRanges.length > 0) {
    dynamicRanges.sort(([left]) => left);
    let end = headLengthBytes;
    for (const [start, rangeEnd] of dynamicRanges) {
      if (start !== end) fail(`calldatas[${index}] has overlapping or non-canonical dynamic data for ${signature}`);
      end = rangeEnd;
    }
    if (end !== args.length / 2) fail(`calldatas[${index}] has trailing or overlapping ABI data for ${signature}`);
  } else if (args.length !== headLength) {
    fail(`calldatas[${index}] has trailing ABI data for ${signature}`);
  }
}

function normalizePolicy(policy) {
  const root = readObject(policy, "policy");
  const targets = readObject(root.targets, "policy.targets");
  const normalized = new Map();
  for (const [address, rawTarget] of Object.entries(targets)) {
    const target = normalizeAddress(address, "policy target address");
    if (normalized.has(target)) fail(`Duplicate policy target after address normalization: ${target}`);
    const config = readObject(rawTarget, `policy.targets.${address}`);
    const selectors = readObject(config.selectors, `policy.targets.${address}.selectors`);
    const allowedSelectors = new Map();
    for (const [rawSelector, signature] of Object.entries(selectors)) {
      if (!/^0x[0-9a-fA-F]{8}$/.test(rawSelector)) fail(`Invalid selector in policy for ${address}: ${rawSelector}`);
      if (typeof signature !== "string" || signature.trim() === "") fail(`Selector ${rawSelector} needs a function signature.`);
      const normalizedSelector = rawSelector.toLowerCase();
      if (allowedSelectors.has(normalizedSelector)) fail(`Duplicate policy selector after normalization: ${rawSelector}`);
      const types = parseSignature(signature);
      if (types.some((type) => !isSupportedAbiType(type))) fail(`Policy signature ${signature} contains an unsupported ABI type.`);
      const expectedSelector = `0x${keccak256(new TextEncoder().encode(signature)).slice(0, 8)}`;
      if (normalizedSelector !== expectedSelector) fail(`Policy selector ${rawSelector} does not match signature ${signature}; expected ${expectedSelector}.`);
      allowedSelectors.set(normalizedSelector, signature);
    }
    const maxValue = config.maxValue === undefined ? 0n : decimal(config.maxValue, `policy.targets.${address}.maxValue`);
    normalized.set(target, {
      label: typeof config.label === "string" && config.label.trim() ? config.label.trim() : target,
      selectors: allowedSelectors,
      maxValue,
      allowEmptyCalldata: config.allowEmptyCalldata === true,
    });
  }
  if (normalized.size === 0) fail("policy.targets must contain at least one target.");
  return normalized;
}

/**
 * Validate a proposal bundle against an explicit target/selector/value policy.
 * This never contacts a chain, signs, simulates, or broadcasts a transaction.
 */
export function verifyGovernancePayload(bundle, policy) {
  const proposal = readObject(bundle, "bundle");
  const targets = proposal.targets;
  const values = proposal.values;
  const calldatas = proposal.calldatas;
  if (!Array.isArray(targets) || !Array.isArray(values) || !Array.isArray(calldatas)) {
    fail("bundle.targets, bundle.values, and bundle.calldatas must be arrays.");
  }
  if (targets.length !== values.length || targets.length !== calldatas.length) {
    fail("bundle action arrays must have identical lengths.");
  }
  if (proposal.description !== undefined && (typeof proposal.description !== "string" || proposal.description.trim() === "")) {
    fail("bundle.description must be a non-empty string when provided.");
  }
  if (proposal.descriptionHash !== undefined && (typeof proposal.descriptionHash !== "string" || !BYTES32.test(proposal.descriptionHash))) {
    fail("bundle.descriptionHash must be a 32-byte hex value when provided.");
  }

  const targetsByAddress = normalizePolicy(policy);
  const errors = [];
  const actions = targets.map((rawTarget, index) => {
    let target;
    let value;
    let calldata;
    try {
      target = normalizeAddress(rawTarget, `targets[${index}]`);
      value = decimal(values[index], `values[${index}]`);
      if (typeof calldatas[index] !== "string" || !HEX.test(calldatas[index])) {
        fail(`calldatas[${index}] must be an even-length 0x-prefixed hex string.`);
      }
      calldata = calldatas[index].toLowerCase();
    } catch (error) {
      errors.push(error.message);
      return { index, target: rawTarget, value: values[index], calldata: calldatas[index], authorized: false, decoded: null };
    }

    const config = targetsByAddress.get(target);
    const action = { index, target, targetLabel: config?.label ?? null, value: value.toString(), calldata, selector: null, authorized: true, decoded: null };
    if (!config) {
      action.authorized = false;
      errors.push(`targets[${index}] is not present in the explicit policy: ${target}`);
      return action;
    }
    if (value > config.maxValue) {
      action.authorized = false;
      errors.push(`values[${index}] exceeds the policy maximum for ${target}: ${value} > ${config.maxValue}`);
    }
    try {
      action.selector = selector(calldata, index);
    } catch (error) {
      action.authorized = false;
      errors.push(error.message);
      return action;
    }
    if (action.selector === null) {
      if (!config.allowEmptyCalldata) {
        action.authorized = false;
        errors.push(`calldatas[${index}] is empty for target ${target}.`);
      }
      return action;
    }
    const signature = config.selectors.get(action.selector);
    if (!signature) {
      action.authorized = false;
      errors.push(`selector ${action.selector} is not allowed for target ${target}.`);
      return action;
    }
    try {
      validateAbiEncoding(calldata, signature, index);
    } catch (error) {
      action.authorized = false;
      errors.push(error.message);
      return action;
    }
    action.decoded = signature;
    return action;
  });

  return {
    schemaVersion: 1,
    authorized: errors.length === 0 && actions.every((action) => action.authorized),
    description: proposal.description ?? null,
    descriptionHash: proposal.descriptionHash ?? null,
    actions,
    errors,
  };
}

function usage() {
  console.error("Usage: node scripts/verify-governance-payload.mjs --bundle <bundle.json> --policy <policy.json>");
}

async function main(args) {
  const paths = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!["--bundle", "--policy"].includes(argument) || !args[index + 1] || args[index + 1].startsWith("--")) {
      usage();
      process.exitCode = 2;
      return;
    }
    paths[argument.slice(2)] = args[++index];
  }
  if (!paths.bundle || !paths.policy) {
    usage();
    process.exitCode = 2;
    return;
  }
  const bundle = JSON.parse(await readFile(paths.bundle, "utf8"));
  const policy = JSON.parse(await readFile(paths.policy, "utf8"));
  const result = verifyGovernancePayload(bundle, policy);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.authorized) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(`Governance payload verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
