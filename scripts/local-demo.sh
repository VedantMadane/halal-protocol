#!/usr/bin/env bash
set -euo pipefail

# This wrapper is intentionally local-only. The default mnemonic is a published Anvil demo
# mnemonic and must never be used with a public RPC. Set ANVIL_MNEMONIC to use another local seed.
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_RPC_URL="http://127.0.0.1:8545"
LOCAL_MNEMONIC="${ANVIL_MNEMONIC:-test test test test test test test test test test test junk}"
DEPLOY_LOG="$(mktemp)"
ANVIL_PID=""
APP_PID=""

cleanup() {
  if [[ -n "$APP_PID" ]]; then kill "$APP_PID" 2>/dev/null || true; fi
  if [[ -n "$ANVIL_PID" ]]; then kill "$ANVIL_PID" 2>/dev/null || true; fi
  rm -f "$DEPLOY_LOG"
}
trap cleanup EXIT INT TERM

command -v anvil >/dev/null || { echo "anvil is required (install Foundry first)" >&2; exit 1; }
command -v forge >/dev/null || { echo "forge is required (install Foundry first)" >&2; exit 1; }
command -v cast >/dev/null || { echo "cast is required (install Foundry first)" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm is required (install pnpm 11 first)" >&2; exit 1; }

if cast chain-id --rpc-url "$LOCAL_RPC_URL" >/dev/null 2>&1; then
  echo "Refusing to use an existing process on $LOCAL_RPC_URL; stop it before running the demo." >&2
  exit 1
fi

echo "Starting disposable Anvil chain..."
anvil --silent --mnemonic "$LOCAL_MNEMONIC" --port 8545 >/tmp/halal-anvil.log 2>&1 &
ANVIL_PID=$!
until cast chain-id --rpc-url "$LOCAL_RPC_URL" >/dev/null 2>&1; do sleep 1; done
LOCAL_PRIVATE_KEY="$(cast wallet derive --insecure "$LOCAL_MNEMONIC" | awk '/Private key:/ { print $3; exit }')"
if [[ -z "$LOCAL_PRIVATE_KEY" ]]; then
  echo "Could not derive the local demo account from ANVIL_MNEMONIC" >&2
  exit 1
fi

echo "Deploying Halal locally..."
(
  cd "$ROOT_DIR/contracts"
  PRIVATE_KEY="$LOCAL_PRIVATE_KEY" forge script script/DeployLocal.s.sol:DeployLocalHalalSystem \
    --rpc-url "$LOCAL_RPC_URL" --broadcast
) | tee "$DEPLOY_LOG"

if ! grep -q "NEXT_PUBLIC_HLC_TOKEN_31337" "$DEPLOY_LOG"; then
  echo "Deployment did not print frontend configuration; see /tmp/halal-anvil.log" >&2
  exit 1
fi

{
  echo "NEXT_PUBLIC_RPC_URL_31337=$LOCAL_RPC_URL"
  grep 'NEXT_PUBLIC_HLC_' "$DEPLOY_LOG" | sed -e 's/^ *//' -e 's/= /=/'
} > "$ROOT_DIR/app/.env.local"

echo "Frontend configuration written to app/.env.local"
echo "Starting the dApp at http://localhost:3000 (Ctrl-C to stop both processes)..."
(
  cd "$ROOT_DIR/app"
  pnpm dev
) &
APP_PID=$!
wait "$APP_PID"
