#!/usr/bin/env bash
set -euo pipefail

# Read-only PSM health check for cron, CI, and monitoring agents.
# Required: RPC_URL and PSM. Optional: CPI_UPDATER, EXPECTED_CPI_SOURCE, and
# FAIL_ON_UPDATE_OVERDUE (default: true).

for variable in RPC_URL PSM; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: $variable" >&2
    exit 1
  fi
done

command -v cast >/dev/null || { echo "cast is required (install Foundry first)" >&2; exit 1; }

call() {
  cast call "$PSM" "$@" --rpc-url "$RPC_URL" | awk 'NR == 1 { print $1; exit }'
}

address_call() {
  call "$@" | tr '[:upper:]' '[:lower:]'
}

now="$(cast block latest --field timestamp --rpc-url "$RPC_URL")"
reserve_surplus="$(call 'reserveSurplus()(int256)')"
last_report="$(call 'lastReportTimestamp()(uint256)')"
max_report_age="$(call 'MAX_REPORT_AGE()(uint256)')"
last_updated="$(call 'lastUpdated()(uint256)')"
min_update_interval="$(call 'minUpdateInterval()(uint256)')"
cpi_source="$(call 'source()(string)' | sed -e 's/^"//' -e 's/"$//')"

echo "psm=$PSM"
echo "checked_at=$now"
echo "reserve_surplus=$reserve_surplus"
echo "last_report_timestamp=$last_report"
echo "max_report_age=$max_report_age"
echo "last_updated=$last_updated"
echo "min_update_interval=$min_update_interval"
echo "cpi_source=$cpi_source"

failure=0

if [[ -n "${CPI_UPDATER:-}" ]]; then
  CPI_UPDATER="${CPI_UPDATER,,}"
  updater_role="$(call 'UPDATER_ROLE()(bytes32)')"
  updater_configured="$(address_call 'hasRole(bytes32,address)(bool)' "$updater_role" "$CPI_UPDATER")"
  echo "cpi_updater=$CPI_UPDATER"
  if [[ "$updater_configured" != "true" ]]; then
    echo "status=unhealthy"
    echo "reason=configured_cpi_updater_missing_role"
    failure=1
  fi
fi

if [[ -n "${EXPECTED_CPI_SOURCE:-}" && "$cpi_source" != "$EXPECTED_CPI_SOURCE" ]]; then
  echo "status=unhealthy"
  echo "reason=cpi_source_mismatch"
  failure=1
fi

if [[ "$reserve_surplus" == -* ]]; then
  echo "status=unhealthy"
  echo "reason=reserve_deficit"
  failure=1
fi

if [[ "$last_report" == "0" ]]; then
  echo "status=unhealthy"
  echo "reason=timestamped_cpi_report_missing"
  failure=1
elif (( now > last_report + max_report_age )); then
  echo "status=unhealthy"
  echo "reason=timestamped_cpi_report_stale"
  failure=1
fi

if (( now > last_updated + min_update_interval )); then
  echo "warning=normal_cpi_update_overdue"
  if [[ "${FAIL_ON_UPDATE_OVERDUE:-true}" == "true" ]]; then
    failure=1
  fi
fi

if (( failure == 0 )); then
  echo "status=healthy"
  exit 0
fi

exit 1
