#!/usr/bin/env bash
set -euo pipefail

# Read-only recurring audit for a configured deployment. It verifies immutable wiring and then
# checks CPI freshness, reserve coverage, update cadence, and optional CPI source/updater
# expectations. It requires no private key.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--json" ]]; then
  shift
  set +e
  health_output="$("$0" "$@" 2>&1)"
  health_status=$?
  set -e
  HEALTH_CHECK_EXIT_STATUS="$health_status" printf '%s\n' "$health_output" |
    node "$ROOT_DIR/scripts/health-output-json.mjs"
  exit "$health_status"
fi

for variable in RPC_URL EXPECTED_CHAIN_ID PSM; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: $variable" >&2
    echo "status=unhealthy"
    echo "reason=missing_required_environment_variable"
    echo "missing_variable=$variable"
    exit 1
  fi
done

echo "== Deployment wiring =="
if wiring_output="$("$ROOT_DIR/scripts/verify-deployment.sh" 2>&1)"; then
  printf '%s\n' "$wiring_output"
else
  printf '%s\n' "$wiring_output" >&2
  echo "status=unhealthy"
  echo "reason=deployment_wiring_check_failed"
  exit 1
fi
echo "== PSM health =="
if [[ -n "${CPI_ADAPTER:-}" && -z "${EXPECTED_CPI_ADAPTER_OWNER:-}" ]]; then
  EXPECTED_CPI_ADAPTER_OWNER="${TIMELOCK,,}"
  export EXPECTED_CPI_ADAPTER_OWNER
fi
"$ROOT_DIR/scripts/check-psm-health.sh"
