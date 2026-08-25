import test from "node:test";
import assert from "node:assert/strict";
import { validateSignatureSet, validateTypedData } from "../verify-cpi-report.mjs";

const signerOne = "0x1111111111111111111111111111111111111111";
const signerTwo = "0x2222222222222222222222222222222222222222";
const typedData = {
  types: { CPIReport: [] },
  primaryType: "CPIReport",
  domain: {
    name: "Halal CPI Report Adapter",
    version: "1",
    chainId: "421614",
    verifyingContract: "0x1234567890123456789012345678901234567890",
  },
  message: {
    reportedCPI: "1000000",
    reportedAt: "1780000000",
    sourceId: `0x${"ab".repeat(32)}`,
  },
};

test("validates the adapter domain and report message", () => {
  assert.equal(validateTypedData(typedData), typedData);
});

test("requires sorted unique signers and one signature per signer", () => {
  const signatures = `0x${"11".repeat(65)},0x${"22".repeat(65)}`;
  assert.deepEqual(validateSignatureSet(`${signerOne},${signerTwo}`, signatures), {
    signers: [signerOne, signerTwo],
    signatures: signatures.split(","),
  });
  assert.throws(
    () => validateSignatureSet(`${signerTwo},${signerOne}`, signatures),
    /strictly ascending/,
  );
  assert.throws(() => validateSignatureSet(signerOne, signatures), /same nonzero/);
});

test("rejects a typed data file for another domain", () => {
  assert.throws(() => validateTypedData({ ...typedData, domain: { ...typedData.domain, version: "2" } }), /domain/);
  assert.throws(() => validateTypedData({ ...typedData, primaryType: "OtherReport" }), /primaryType/);
  assert.throws(
    () => validateTypedData({ ...typedData, message: { ...typedData.message, reportedCPI: "2000001" } }),
    /outside the PSM range/,
  );
});
