# Deployment registry

The dApp reads public deployments from [`app/src/config/deployment-registry.json`](../app/src/config/deployment-registry.json).
The file is empty until an operator publishes a deployment that passed the read-only verifier.
Keeping it empty protects users from an address list that no one has verified.

## Record a deployment

After deploying and running `scripts/verify-deployment.sh`, add one object keyed by the numeric
chain ID:

```json
{
  "421614": {
    "network": "arbitrum-sepolia",
    "release": "v0.1.0-alpha.XX",
    "commit": "<deployment-commit>",
    "token": "0x...",
    "teamVesting": "0x...",
    "treasuryVesting": "0x...",
    "psm": "0x...",
    "dao": "0x...",
    "timelock": "0x...",
    "reserveToken": "0x...",
    "reserveTokenSymbol": "USDC",
    "deploymentBlock": "123456789"
  }
}
```

The seven contract addresses, reserve symbol, and positive deployment block are required. The
`network`, `release`, and `commit` fields provide review context and do not affect runtime reads.
Run `make registry-check` before opening a pull request. CI runs the same check. The dApp still
accepts `NEXT_PUBLIC_HLC_*_<chainId>` environment variables as overrides for local experiments;
those overrides do not change the checked-in public registry.

Do not add a deployment until the operator has recorded the chain ID, reserve-token due diligence,
beneficiary review, source-verification links, verifier output, and first healthy CPI report in the
deployment journal. A registry entry is a pointer to that evidence, not a substitute for it.
