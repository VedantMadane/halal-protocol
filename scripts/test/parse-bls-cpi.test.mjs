import test from "node:test";
import assert from "node:assert/strict";
import { BLS_SERIES_ID, buildBlsReport, parseBlsResponse, ratioToCpi } from "../parse-bls-cpi.mjs";

const payload = {
  status: "REQUEST_SUCCEEDED",
  Results: {
    series: [
      {
        seriesID: BLS_SERIES_ID,
        data: [{ year: "2026", period: "M07", periodName: "July", latest: "true", value: "333.952" }],
      },
    ],
  },
};

test("parses the documented BLS series and computes a deterministic ratio", () => {
  const report = buildBlsReport(
    {
      payload,
      baseIndex: "300.000",
      chainId: "421614",
      adapter: "0x1234567890123456789012345678901234567890",
      sourceId: `0x${"ab".repeat(32)}`,
      reportedAt: "100",
    },
    100,
  );
  assert.equal(report.cpi, "1.113173");
  assert.equal(report.source.seriesId, BLS_SERIES_ID);
  assert.equal(report.source.period, "M07");
  assert.equal(report.source.baseIndex, "300.000");
  assert.equal(report.source.responseSha256, null);
});

test("includes and validates the exact source-response hash", () => {
  const report = buildBlsReport(
    {
      payload,
      baseIndex: "300.000",
      chainId: "1",
      adapter: "0x1234567890123456789012345678901234567890",
      sourceId: `0x${"ab".repeat(32)}`,
      reportedAt: "100",
      sourceResponseSha256: "AB".repeat(32),
    },
    100,
  );
  assert.equal(report.source.responseSha256, "ab".repeat(32));
  assert.throws(
    () => buildBlsReport({ payload, baseIndex: "300.000", chainId: "1", adapter: "0x1234567890123456789012345678901234567890", sourceId: `0x${"ab".repeat(32)}`, reportedAt: "100", sourceResponseSha256: "not-a-hash" }, 100),
    /SHA-256/,
  );
});

test("rounds ratios in integer space", () => {
  assert.equal(ratioToCpi({ integer: 10005n, scale: 3 }, { integer: 10000n, scale: 3 }), 1_000_500n);
});

test("rejects a different series, duplicate periods, or invalid period", () => {
  assert.throws(() => parseBlsResponse({ ...payload, status: "REQUEST_FAILED" }), /did not succeed/);
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [payload.Results.series[0], payload.Results.series[0]] } }),
    /exactly CUUR0000SA0/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ seriesID: "CUSR0000SA0", data: payload.Results.series[0].data }] } }),
    /exactly CUUR0000SA0/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [] }] } }),
    /exactly one data point/,
  );
  assert.throws(
    () => parseBlsResponse({
      ...payload,
      Results: {
        series: [{
          ...payload.Results.series[0],
          data: [payload.Results.series[0].data[0], { ...payload.Results.series[0].data[0], value: "333.953" }],
        }],
      },
    }),
    /exactly one data point/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [null] }] } }),
    /data point must be an object/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [{ ...payload.Results.series[0].data[0], year: "26" }] }] } }),
    /monthly period/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [{ ...payload.Results.series[0].data[0], value: "not-a-number" }] }] } }),
    /BLS value must be a nonnegative decimal string/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [{ ...payload.Results.series[0].data[0], period: "A01" }] }] } }),
    /monthly period/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [{ ...payload.Results.series[0].data[0], latest: "false" }] }] } }),
    /marked latest/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [{ ...payload.Results.series[0].data[0], footnotes: [{ code: "P" }] }] }] } }),
    /preliminary/,
  );
  assert.throws(
    () => parseBlsResponse({ ...payload, Results: { series: [{ ...payload.Results.series[0], data: [{ ...payload.Results.series[0].data[0], footnotes: [{ code: "R" }] }] }] } }),
    /revised.*revision-policy review/,
  );
});

test("preserves the caller's publication timestamp and rejects future timestamps", () => {
  const report = buildBlsReport(
    {
      payload,
      baseIndex: "300.000",
      chainId: "421614",
      adapter: "0x1234567890123456789012345678901234567890",
      sourceId: `0x${"ab".repeat(32)}`,
      reportedAt: "1770000000",
    },
    1770000000,
  );
  assert.equal(report.reportedAt, "1770000000");
  assert.equal(report.typedData.message.reportedAt, "1770000000");
  assert.throws(
    () => buildBlsReport({ payload, baseIndex: "300.000", chainId: "1", adapter: "0x1234567890123456789012345678901234567890", sourceId: `0x${"ab".repeat(32)}`, reportedAt: "1770000001" }, 1770000000),
    /cannot be in the future/,
  );
});

test("rejects a CPI ratio outside the PSM range", () => {
  assert.throws(
    () => buildBlsReport({ payload, baseIndex: "4000.000", chainId: "1", adapter: "0x1234567890123456789012345678901234567890", sourceId: `0x${"ab".repeat(32)}`, reportedAt: "100" }, 100),
    /outside the PSM range/,
  );
});
