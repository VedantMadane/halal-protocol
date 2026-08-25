#!/usr/bin/env bash
set -euo pipefail

# Read-only post-deployment verifier. Required: RPC_URL, EXPECTED_CHAIN_ID, TIMELOCK, TOKEN,
# TEAM_VESTING, TREASURY_VESTING, DAO, PSM, and RESERVE_TOKEN. Optional: DEPLOYER_ADDRESS,
# CPI_UPDATER.

required_vars=(RPC_URL EXPECTED_CHAIN_ID TIMELOCK TOKEN TEAM_VESTING TREASURY_VESTING DAO PSM RESERVE_TOKEN)
for variable in "${required_vars[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: $variable" >&2
    exit 1
  fi
done

command -v cast >/dev/null || { echo "cast is required (install Foundry first)" >&2; exit 1; }

call() {
  cast call "$1" "$2" "${@:3}" --rpc-url "$RPC_URL"
}

address_call() {
  call "$1" "$2" | tr '[:upper:]' '[:lower:]'
}

expect_equal() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAILED: $label (expected $expected, got $actual)" >&2
    exit 1
  fi
}

expect_true() {
  local label="$1"
  local actual="$2"
  if [[ "$actual" != "true" ]]; then
    echo "FAILED: $label (expected true, got $actual)" >&2
    exit 1
  fi
}

expect_positive() {
  local label="$1"
  local actual="$2"
  # `cast` may render large uints as `[1.728e5]` rather than plain decimal.
  if [[ -z "$actual" || "$actual" =~ ^\[?0+(\.0+)?([eE][+-]?0+)?\]?$ ]]; then
    echo "FAILED: $label (expected a positive integer, got $actual)" >&2
    exit 1
  fi
}

expect_contract() {
  local label="$1"
  local address="$2"
  local code
  code="$(cast code "$address" --rpc-url "$RPC_URL")"
  if [[ -z "$code" || "$code" == "0x" ]]; then
    echo "FAILED: $label has no deployed contract bytecode at $address" >&2
    exit 1
  fi
}

expect_equal "RPC chain ID" "$(cast chain-id --rpc-url "$RPC_URL")" "$EXPECTED_CHAIN_ID"

TIMELOCK="${TIMELOCK,,}"
TOKEN="${TOKEN,,}"
TEAM_VESTING="${TEAM_VESTING,,}"
TREASURY_VESTING="${TREASURY_VESTING,,}"
DAO="${DAO,,}"
PSM="${PSM,,}"
RESERVE_TOKEN="${RESERVE_TOKEN,,}"

expect_contract "timelock" "$TIMELOCK"
expect_contract "token" "$TOKEN"
expect_contract "team vesting" "$TEAM_VESTING"
expect_contract "treasury vesting" "$TREASURY_VESTING"
expect_contract "DAO" "$DAO"
expect_contract "PSM" "$PSM"
expect_contract "reserve token" "$RESERVE_TOKEN"

expect_equal "PSM reserve" "$(address_call "$PSM" 'reserve()(address)')" "$RESERVE_TOKEN"
expect_equal "PSM HLC token" "$(address_call "$PSM" 'hlc()(address)')" "$TOKEN"
expect_equal "team vesting token" "$(address_call "$TEAM_VESTING" 'token()(address)')" "$TOKEN"
expect_equal "treasury vesting token" "$(address_call "$TREASURY_VESTING" 'token()(address)')" "$TOKEN"
expect_equal "team vesting DAO" "$(address_call "$TEAM_VESTING" 'dao()(address)')" "$TIMELOCK"
expect_equal "treasury vesting DAO" "$(address_call "$TREASURY_VESTING" 'dao()(address)')" "$TIMELOCK"
expect_equal "DAO HLC token" "$(address_call "$DAO" 'token()(address)')" "$TOKEN"
expect_equal "DAO timelock" "$(address_call "$DAO" 'timelock()(address)')" "$TIMELOCK"
expect_positive "timelock delay" "$(call "$TIMELOCK" 'getMinDelay()(uint256)')"

expect_true "genesis allocation minted" "$(call "$TOKEN" 'genesisMinted()(bool)')"
team_allocation="$(call "$TOKEN" 'TEAM_ALLOCATION()(uint256)')"
treasury_allocation="$(call "$TOKEN" 'TREASURY_ALLOCATION()(uint256)')"
# These allocations are immutable schedule values, while live balances decrease as vesting
# releases occur. Checking balances would make a valid deployment fail on every later audit.
expect_equal "team vesting allocation" "$(call "$TEAM_VESTING" 'totalAllocation()(uint256)')" "$team_allocation"
expect_equal "treasury vesting allocation" "$(call "$TREASURY_VESTING" 'totalAllocation()(uint256)')" "$treasury_allocation"

minter_role="$(call "$TOKEN" 'MINTER_ROLE()(bytes32)')"
admin_role="$(call "$TOKEN" 'DEFAULT_ADMIN_ROLE()(bytes32)')"
timelock_admin_role="$(call "$TIMELOCK" 'DEFAULT_ADMIN_ROLE()(bytes32)')"
proposer_role="$(call "$TIMELOCK" 'PROPOSER_ROLE()(bytes32)')"
executor_role="$(call "$TIMELOCK" 'EXECUTOR_ROLE()(bytes32)')"
psm_param_role="$(call "$PSM" 'PARAM_ROLE()(bytes32)')"
psm_admin_role="$(call "$PSM" 'DEFAULT_ADMIN_ROLE()(bytes32)')"
psm_updater_role="$(call "$PSM" 'UPDATER_ROLE()(bytes32)')"

expect_true "PSM has HLC minter role" "$(call "$TOKEN" 'hasRole(bytes32,address)(bool)' "$minter_role" "$PSM")"
expect_true "timelock has HLC admin role" "$(call "$TOKEN" 'hasRole(bytes32,address)(bool)' "$admin_role" "$TIMELOCK")"
expect_true "DAO has timelock proposer role" "$(call "$TIMELOCK" 'hasRole(bytes32,address)(bool)' "$proposer_role" "$DAO")"
expect_true "timelock retains self-admin role" "$(call "$TIMELOCK" 'hasRole(bytes32,address)(bool)' "$timelock_admin_role" "$TIMELOCK")"
expect_true "timelock has PSM admin role" "$(call "$PSM" 'hasRole(bytes32,address)(bool)' "$psm_admin_role" "$TIMELOCK")"
expect_true "timelock has PSM parameter role" "$(call "$PSM" 'hasRole(bytes32,address)(bool)' "$psm_param_role" "$TIMELOCK")"
expect_true "timelock has open executor role" "$(call "$TIMELOCK" 'hasRole(bytes32,address)(bool)' "$executor_role" "0x0000000000000000000000000000000000000000")"

if [[ -n "${CPI_UPDATER:-}" ]]; then
  CPI_UPDATER="${CPI_UPDATER,,}"
  expect_true "configured CPI updater role" "$(call "$PSM" 'hasRole(bytes32,address)(bool)' "$psm_updater_role" "$CPI_UPDATER")"
fi

if [[ -n "${DEPLOYER_ADDRESS:-}" ]]; then
  DEPLOYER_ADDRESS="${DEPLOYER_ADDRESS,,}"
  expect_equal "deployer HLC minter role" "$(call "$TOKEN" 'hasRole(bytes32,address)(bool)' "$minter_role" "$DEPLOYER_ADDRESS")" "false"
  expect_equal "deployer HLC admin role" "$(call "$TOKEN" 'hasRole(bytes32,address)(bool)' "$admin_role" "$DEPLOYER_ADDRESS")" "false"
  expect_equal "deployer timelock admin role" "$(call "$TIMELOCK" 'hasRole(bytes32,address)(bool)' "$timelock_admin_role" "$DEPLOYER_ADDRESS")" "false"
  expect_equal "deployer PSM admin role" "$(call "$PSM" 'hasRole(bytes32,address)(bool)' "$psm_admin_role" "$DEPLOYER_ADDRESS")" "false"
  expect_equal "deployer PSM parameter role" "$(call "$PSM" 'hasRole(bytes32,address)(bool)' "$psm_param_role" "$DEPLOYER_ADDRESS")" "false"
  expect_equal "deployer PSM updater role" "$(call "$PSM" 'hasRole(bytes32,address)(bool)' "$psm_updater_role" "$DEPLOYER_ADDRESS")" "false"
fi

echo "Halal deployment wiring verified: $PSM"
