import { formatUnits, keccak256, toBytes } from "viem";

/** OZ Governor's descriptionHash = keccak256(bytes(description)), used by queue/execute/cancel. */
export function descriptionHash(description: string): `0x${string}` {
  return keccak256(toBytes(description));
}

/** CPI_PRECISION from HalalPSM.sol — 1_000_000 represents a rate of 1.0. */
export const CPI_PRECISION = 1_000_000n;

/** Truncates a checksum/lowercase address to `0x1234…abcd`. */
export function shortAddress(address: string | undefined | null, chars = 4): string {
  if (!address) return "";
  if (address.length <= 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

/** Formats an 18-decimal token amount for display, trimming to `maxDecimals` fraction digits. */
export function formatToken(value: bigint | undefined, decimals = 18, maxDecimals = 4): string {
  if (value === undefined) return "—";
  const full = formatUnits(value, decimals);
  return trimDecimals(full, maxDecimals);
}

/** Formats an 18-decimal token amount with thousands separators, e.g. "1,234,567.89". */
export function formatTokenGrouped(value: bigint | undefined, decimals = 18, maxDecimals = 2): string {
  if (value === undefined) return "—";
  const trimmed = trimDecimals(formatUnits(value, decimals), maxDecimals);
  const [whole, frac] = trimmed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

function trimDecimals(numericString: string, maxDecimals: number): string {
  const [whole, frac] = numericString.split(".");
  if (!frac) return whole;
  const trimmedFrac = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmedFrac.length > 0 ? `${whole}.${trimmedFrac}` : whole;
}

/** Formats a CPI_PRECISION-scaled integer rate (1_000_000 == 1.0) as e.g. "1.000". */
export function formatCPIRate(rate: bigint | undefined): string {
  if (rate === undefined) return "—";
  const scaled = Number(rate) / Number(CPI_PRECISION);
  return scaled.toFixed(3);
}

/** Formats a basis-point-free integer percentage numerator/denominator pair, e.g. (4, 100) -> "4%". */
export function formatPercent(numerator: bigint | number, denominator: bigint | number): string {
  const n = Number(numerator);
  const d = Number(denominator);
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(2)}%`;
}

/** Formats a duration given in seconds as a human string, e.g. "4 years" / "1 year, 3 months". */
export function formatDurationSeconds(seconds: bigint | number): string {
  const total = Number(seconds);
  if (total <= 0) return "0 seconds";
  const DAY = 86_400;
  const YEAR = 365 * DAY;
  const MONTH = 30 * DAY;

  const years = Math.floor(total / YEAR);
  const rem1 = total % YEAR;
  const months = Math.floor(rem1 / MONTH);
  const rem2 = rem1 % MONTH;
  const days = Math.floor(rem2 / DAY);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0 && years === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : "< 1 day";
}

/** Formats a unix-seconds timestamp as an absolute date string. */
export function formatDate(unixSeconds: bigint | number | undefined): string {
  if (unixSeconds === undefined) return "—";
  const ms = Number(unixSeconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Formats a block-length duration using an approximate seconds-per-block for the chain. */
export function formatBlocksAsDuration(blocks: bigint | number, secondsPerBlock: number): string {
  return formatDurationSeconds(Number(blocks) * secondsPerBlock);
}

/** Clamps and formats a ratio (0-1) as a percentage string, e.g. 0.4231 -> "42.31%". */
export function formatRatio(ratio: number, decimals = 2): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  return `${(clamped * 100).toFixed(decimals)}%`;
}

/**
 * Governor proposal ids are keccak-derived uint256 values, so they're huge and not meant to be
 * read digit-by-digit. Show a shortened hex form like a tx hash, with the full decimal value
 * available via `title`/copy elsewhere.
 */
export function shortProposalId(id: bigint): string {
  const hex = id.toString(16);
  if (hex.length <= 10) return `#${id.toString()}`;
  return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
}
