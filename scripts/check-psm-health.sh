#!/usr/bin/env bash
set -euo pipefail

# Read-only PSM health check for cron, CI, and monitoring agents.
# Required: RPC_URL and PSM. Optional: FAIL_ON_UPDATE_OVERDUE (default: true).

for variable in RPC_URL PSM; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: $variable" >&2
    exit 1
  fi
done

command -v cast >/dev/null || { echo "cast is required (install Foundry first)" >&2; exit 1; }

call() {
  cast call "$PSM" "$1" --rpc-url "$RPC_URL" | awk 'NR == 1 { print $1; exit }'
}

now="$(cast block latest --field timestamp --rpc-url "$RPC_URL")"
reserve_surplus="$(call 'reserveSurplus()(int256)')"
last_report="$(call 'lastReportTimestamp()(uint256)')"
max_report_age="$(call 'MAX_REPORT_AGE()(uint256)')"
last_updated="$(call 'lastUpdated()(uint256)')"
min_update_interval="$(call 'minUpdateInterval()(uint256)')"

echo "psm=$PSM"
echo "checked_at=$now"
echo "reserve_surplus=$reserve_surplus"
echo "last_report_timestamp=$last_report"
echo "max_report_age=$max_report_age"
echo "last_updated=$last_updated"
echo "min_update_interval=$min_update_interval"

failure=0

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
