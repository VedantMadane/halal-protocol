# Halal threat model

This document defines the security boundary for the current Halal reference implementation. It is
an engineering review aid, not an audit, safety guarantee, or replacement for independent review.
The contracts are non-upgradeable and currently unaudited.

## Security objectives

The system is intended to preserve these properties:

1. HLC can only be minted by an account with `MINTER_ROLE`; in the shipped deployment that role is
   held by the PSM.
2. PSM-issued HLC can only redeem against the caller's own PSM redemption credit. A plain HLC
   transfer does not transfer that credit; `transferRedeemable` does both operations atomically.
3. A withdrawal cannot make the PSM's reserve deficit worse, and the DAO cannot withdraw reserve
   required by the current outstanding PSM issuance.
4. Privileged protocol changes are controlled by the DAO's timelock after deployment wiring. The
   deployer must retain no privileged role.
5. Vesting releases only the schedule's vested amount, and a revocation can return only unvested
   tokens to the DAO.

## Assets and failure impact

| Asset or property | Worst credible impact |
| --- | --- |
| Reserve held by the PSM | Direct loss or inability to redeem outstanding credits |
| PSM redemption credits | A holder loses or gains redemption rights incorrectly |
| HLC supply | Unauthorized inflation, destruction, or governance capture |
| Vesting allocations | Beneficiary loss or premature treasury/team release |
| DAO-controlled roles and parameters | Malicious minting, reserve transfer, or protocol takeover |
| CPI purchasing-power target | Incorrect redemption rate or reserve shortfall |

## Trust boundaries

### On-chain trusted components

- The DAO and its timelock are the final administrators of token, PSM, and vesting roles.
- The configured `UPDATER_ROLE` account is trusted to submit CPI readings within the contract's
  bounds and cadence. The contract does not independently prove that a reading came from an
  official statistics agency.
- The reserve token is an external dependency. Its transfer, balance, decimals, and fee behavior
  affect PSM operation; the PSM accounts for fee-on-transfer behavior but cannot make a malicious
  token honest.
- Beneficiary wallets are trusted to secure their own vesting keys. Two-step beneficiary rotation
  limits typo risk but cannot recover a compromised beneficiary.

### Off-chain and operational boundaries

- Deployment operators choose the reserve token, beneficiaries, governance parameters, and
  optional CPI updater. The deployment script validates configuration and asserts role wiring, but
  operators still need to review addresses and chain-specific block timing.
- Wallets and frontend RPC endpoints are untrusted clients. The frontend is a convenience layer;
  users must verify target, calldata, network, and amounts in their wallet.
- RPC providers, explorers, CPI data sources, and Chainlink/relayer infrastructure may be down,
  censored, stale, or compromised. The contracts do not treat any frontend or RPC response as an
  authorization.

## Main threat scenarios

| Scenario | Contract response | Residual risk / operator action |
| --- | --- | --- |
| Caller tries to redeem genesis or transferred-away HLC against PSM reserves | Per-address `redeemableBalance`; only `transferRedeemable` moves credit | Users must use the credit-aware transfer path; ordinary ERC20 tooling can leave credit behind |
| CPI rises after deposits | `reserveRequired()` exposes the current obligation; withdrawals cannot worsen an existing deficit; DAO can top up | The system can still become under-reserved and withdrawals are first-come-first-served until topped up |
| CPI updater submits an extreme, rapid, stale, replayed, or reserve-inadequate value | Absolute bounds, step limit, minimum interval, timestamp freshness/replay checks, and a guard against routine updates exceeding held reserve; DAO can revoke the role or use `mockCPI` | A compromised updater can still move the rate within reserve-backed limits over time; the emergency override is intentionally more powerful |
| Deployer keeps a privileged role | Deployment script revokes deployer token/timelock roles and asserts the final wiring | Verify deployment output and on-chain roles before accepting deposits |
| DAO proposal drains reserves or grants minting | Governor snapshot voting plus timelock delay; PSM reserve floor blocks ordinary reserve withdrawals | Governance capture remains a protocol-level risk; use multisig-controlled beneficiaries and monitor proposals |
| Reentrancy or unusual ERC20 transfer behavior | `ReentrancyGuard`, `SafeERC20`, balance-delta accounting, and post-transfer checks | Unsupported token semantics or malicious tokens can still make a deployment unusable; select reserve assets carefully |
| Beneficiary address is mistyped or compromised | Two-step beneficiary acceptance; funds always release to the current beneficiary | A beneficiary that accepts a malicious address or loses its key cannot be rescued by the contract |
| Frontend displays stale or incomplete chain data | Reads validate complete deployment configuration and surface partial-read errors | Treat wallet simulation and on-chain transaction data as authoritative |

## Explicit non-goals and unresolved risks

- The current CPI paths are bounded report submissions, not a live Chainlink Functions consumer.
  Production deployments must supply and govern the oracle/relayer infrastructure; timestamped
  reports should use `updateCPIWithTimestamp`. Its report watermark starts empty at deployment so
  a fresh source report published immediately before deployment can bootstrap the feed.
- There is no instant guardian pause or upgrade admin. This avoids a hidden centralized backdoor,
  but means incident response is constrained by the configured governance path.
- The public `HalalToken.burn()` function allows a holder to burn its own HLC without informing the
  PSM's per-address accounting. This cannot create a reserve claim or over-withdrawal, but it can
  strand that holder's redemption credit and leave corresponding reserve as surplus. Users who
  want accounting-aware retirement should use `cancelRedeemable`.
- No professional audit, formal verification, economic simulation, oracle assessment, or bug bounty
  has been completed. Do not deploy with meaningful funds on the strength of this document.

## Review checklist

Before a testnet or mainnet deployment, independently verify:

- reserve token address, decimals, transfer behavior, and any fee/blacklist/pause controls;
- team and treasury beneficiaries, preferably multisigs with documented ownership;
- DAO voting period in target-chain blocks, threshold, quorum, and timelock delay;
- `DEFAULT_ADMIN_ROLE`, `PARAM_ROLE`, `MINTER_ROLE`, and optional `UPDATER_ROLE` on every deployed
  contract, including that the deployer has none;
- reserve balance versus `reserveRequired()` after every CPI change and treasury action;
- updater source provenance, freshness monitoring, key rotation, and emergency governance procedure;
- independent contract, frontend, and operational review before accepting meaningful funds.

Report suspected vulnerabilities privately according to [`SECURITY.md`](../SECURITY.md), not in a
public issue.
