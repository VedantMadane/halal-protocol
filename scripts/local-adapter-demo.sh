#!/usr/bin/env bash
set -euo pipefail

# Local-only adapter rehearsal. It uses Anvil's published mnemonic by default and refuses any
# existing process on port 8545. Production deployments must use DAO/timelock governance instead.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_RPC_URL="http://127.0.0.1:8545"
LOCAL_MNEMONIC="${ANVIL_MNEMONIC:-test test test test test test test test test test test junk}"
ANVIL_PID=""

cleanup() {
  if [[ -n "$ANVIL_PID" ]]; then kill "$ANVIL_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

for command_name in anvil forge cast; do
  command -v "$command_name" >/dev/null || { echo "$command_name is required (install Foundry first)" >&2; exit 1; }
done

if cast chain-id --rpc-url "$LOCAL_RPC_URL" >/dev/null 2>&1; then
  echo "Refusing to use an existing process on $LOCAL_RPC_URL; stop it before running the demo." >&2
  exit 1
fi

anvil --silent --mnemonic "$LOCAL_MNEMONIC" --port 8545 >/tmp/halal-adapter-anvil.log 2>&1 &
ANVIL_PID=$!
until cast chain-id --rpc-url "$LOCAL_RPC_URL" >/dev/null 2>&1; do sleep 1; done

DEMO_LOG="$(mktemp)"

derive_key() {
  local account_count="$1"
  cast wallet derive --insecure --accounts "$account_count" "$LOCAL_MNEMONIC" \
    | awk '/Private key:/ { key=$3 } END { print key }'
}

DEPLOYER_KEY="$(derive_key 1)"
SIGNER_ONE_KEY="$(derive_key 2)"
SIGNER_TWO_KEY="$(derive_key 3)"

(
  cd "$ROOT_DIR/contracts"
  forge build --force
  PRIVATE_KEY="$DEPLOYER_KEY" CPI_SIGNER_1_KEY="$SIGNER_ONE_KEY" CPI_SIGNER_2_KEY="$SIGNER_TWO_KEY" \
    forge script script/LocalCPIAdapterDemo.s.sol:LocalCPIAdapterDemo \
    --rpc-url "$LOCAL_RPC_URL" --broadcast --non-interactive
) 2>&1 | tee "$DEMO_LOG"

PSM_ADDRESS="$(awk '/^  PSM: / { print $2; exit }' "$DEMO_LOG")"
ADAPTER_ADDRESS="$(awk '/^  CPI adapter: / { print $3; exit }' "$DEMO_LOG")"
SOURCE_ID="$(awk 'length($1) == 66 && $1 ~ /^0x/ { print $1; exit }' "$DEMO_LOG")"
DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_KEY")"
test -n "$PSM_ADDRESS" && test -n "$ADAPTER_ADDRESS" && test -n "$SOURCE_ID"

HEALTH_OUTPUT="$(
  RPC_URL="$LOCAL_RPC_URL" PSM="$PSM_ADDRESS" CPI_ADAPTER="$ADAPTER_ADDRESS" \
    EXPECTED_CPI_ADAPTER_OWNER="$DEPLOYER_ADDRESS" EXPECTED_CPI_SOURCE_ID="$SOURCE_ID" \
    FAIL_ON_UPDATE_OVERDUE=false "$ROOT_DIR/scripts/check-psm-health.sh"
)"
echo "$HEALTH_OUTPUT"
echo "$HEALTH_OUTPUT" | grep -q '^status=healthy$'
echo "$HEALTH_OUTPUT" | grep -q '^cpi_adapter_signer_0='
echo "$HEALTH_OUTPUT" | grep -q '^cpi_adapter_signer_1='

echo "Local CPI adapter rehearsal passed on chain 31337."
