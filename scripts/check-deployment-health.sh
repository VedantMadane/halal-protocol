#!/usr/bin/env bash
set -euo pipefail

# Read-only recurring audit for a configured deployment. It verifies immutable wiring and then
# checks CPI freshness, reserve coverage, update cadence, and optional CPI source/updater
# expectations. It requires no private key.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

for variable in RPC_URL EXPECTED_CHAIN_ID PSM; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: $variable" >&2
    exit 1
  fi
done

echo "== Deployment wiring =="
"$ROOT_DIR/scripts/verify-deployment.sh"
echo "== PSM health =="
"$ROOT_DIR/scripts/check-psm-health.sh"
