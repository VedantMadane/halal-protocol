import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCpi, prepareReport } from "../prepare-cpi-report.mjs";

const base = {
  chainId: "421614",
  adapter: "0x1234567890123456789012345678901234567890",
  sourceId: `0x${"ab".repeat(32)}`,
  cpi: "1.234567",
  reportedAt: "100",
};

test("normalizes decimal CPI without floating-point rounding", () => {
  assert.equal(normalizeCpi("1.234567"), "1234567");
  assert.equal(normalizeCpi("0.100000"), "100000");
});

test("emits the adapter's exact EIP-712 domain and message", () => {
  const report = prepareReport(base, 100);
  assert.equal(report.reportedCPI, "1234567");
  assert.equal(report.typedData.domain.name, "Halal CPI Report Adapter");
  assert.equal(report.typedData.domain.verifyingContract, base.adapter);
  assert.deepEqual(report.typedData.message, {
    reportedCPI: "1234567",
    reportedAt: "100",
    sourceId: base.sourceId,
  });
});

test("rejects excess precision, out-of-range values, and future reports", () => {
  assert.throws(() => normalizeCpi("1.2345678"), /at most 6/);
  assert.throws(() => normalizeCpi("2.000001"), /outside/);
  assert.throws(() => prepareReport({ ...base, reportedAt: "101" }, 100), /future/);
});

test("rejects malformed source identity and adapter addresses", () => {
  assert.throws(() => prepareReport({ ...base, sourceId: "0x00" }, 100), /sourceId/);
  assert.throws(() => prepareReport({ ...base, adapter: "0x0" }, 100), /adapter/);
  assert.throws(() => prepareReport({ ...base, cpi: 1.2 }, 100), /cpi must/);
});
