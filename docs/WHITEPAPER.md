# Halal (HLC): A CPI-Indexed, DAO-Governed Stablecoin

**Version 1.0**

> This document describes the design and intent of the Halal protocol. It is not investment
> advice, and it is not a claim that the software described here is complete, audited, or safe
> to use with real funds today. See [Status & risk](../README.md#status--risk) in the root
> README, and [`SECURITY.md`](../SECURITY.md), for the current, honest state of the project.

## Abstract

Most "stablecoins" stabilize the wrong thing. They peg to a unit of account — the US dollar —
that itself loses purchasing power to inflation year over year. A token that reliably trades for
$1 is not the same thing as a token that reliably buys the same basket of goods. Halal (HLC) is
an attempt to close that gap: a token backed 1:1 by a reserve asset, redeemable through a Peg
Stability Module (PSM) at a rate that is periodically adjusted to track a Consumer Price Index
(CPI) feed, so that HLC's *purchasing power* — not just its nominal price against the reserve —
stays roughly constant over time. The protocol is governed entirely on-chain by HLC holders
through an OpenZeppelin `Governor` + `TimelockController` pair; there is no admin key, upgrade
proxy, or centralized off-switch once the system is fully deployed and handed off.

## 1. The problem

A dollar-pegged stablecoin is a claim on a dollar, not a claim on a fixed amount of purchasing
power. Over a long enough horizon, that distinction matters: someone holding a dollar-pegged
stablecoin through a decade of inflation has preserved their *nominal* balance while losing real
value, exactly as a cash holder would. For a token that wants to function as a long-horizon
store of value or unit of account — rather than purely as short-term trading collateral — that's
a design flaw, not a neutral fact of life.

CPI-indexation is the standard tool economies use to solve this for other instruments (inflation-
linked bonds, wage escalation clauses, some pension schemes). Halal applies the same idea to a
crypto-native, reserve-backed token: instead of fixing the exchange rate between HLC and its
reserve asset, the rate itself moves with a CPI feed, so a holder who redeems HLC for reserve
assets later gets back proportionally more reserve per HLC than someone who redeemed earlier,
compensating for the reserve currency's own inflation over that period.

## 2. System overview

Halal is five contracts, deployed once and never upgraded:

| Contract | Role |
|---|---|
| `HalalToken` | The HLC token itself — `ERC20Votes` + `ERC20Permit` + `AccessControl`, burnable. |
| `HalalVesting` | Linear vesting with cliff, one instance each for the team and treasury allocations. |
| `HalalPSM` | The Peg Stability Module — mints/burns HLC against a reserve asset at the current CPI-adjusted rate. |
| `HalalDAO` | An OpenZeppelin `Governor` — the only entity that can mint beyond genesis supply, change PSM parameters, or move treasury funds. |
| `HalalTimelock` | Enforces a delay between a passed vote and its execution. |

No contract is upgradeable, and no contract has an owner key that bypasses the DAO. Every
privileged action — minting, PSM parameter changes, treasury spending, granting roles to future
modules — happens through a proposal, a vote, and a timelock delay. This is a deliberate
trade-off: it means there is no emergency admin override if something goes wrong (see
[§7, Risks](#7-risks-and-honest-limitations)), in exchange for the token actually being
credibly neutral rather than "decentralized" in name with a backdoor in practice.

For the full technical specification — function signatures, access-control matrix, gas
estimates, and the exact contract call flow for a sample proposal — see
[`TECHNICAL-DOCS.md`](TECHNICAL-DOCS.md) and [`Architecture.md`](Architecture.md). This document
is deliberately non-technical by comparison; it explains *why* the system is shaped the way it
is, not *how* to call its functions.

## 3. The Peg Stability Module and CPI mechanism

The PSM is where HLC enters and leaves circulation in response to user action (as opposed to
genesis/vesting supply, which is fixed at deployment). A user deposits a reserve asset — DAI or
USDC in the reference deployment — and receives HLC at the current rate; redeeming works in
reverse.

The rate is not fixed at 1:1 indefinitely. It moves according to a CPI figure that is submitted
on-chain by a rate-limited updater role (intended in production to be a Chainlink Functions
consumer pulling from an official CPI data source), bounded to a 0.1–2.0 range so that a bad or
malicious data point can't move the rate to an absurd extreme in one step. A separate,
DAO-gated manual override exists purely as an emergency mechanism if the automated feed breaks —
it is deliberately harder to invoke than the routine update path, and any use of it is a matter
of public record via governance.

**Per-depositor redemption accounting.** Because HLC is one fungible token shared between
PSM-issued (reserve-backed) supply and the fixed genesis/vesting allocation (which was never
backed by PSM reserves), the contract tracks how much HLC each address has actually minted
through the PSM and not yet redeemed. Only that amount is redeemable by that address. This closes
an entire class of exploit where genesis tokens, or PSM-minted HLC that changed hands, could be
used to drain the reserve out from under legitimate depositors — at the cost of PSM-minted HLC
losing its redemption right if transferred to another address. That trade-off is documented in
detail, with the reasoning behind it, in [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md).

## 4. Token and allocation

HLC has a fixed genesis supply of 10,000,000 tokens, split:

- **6,000,000 HLC — team allocation.** Vests linearly over 4 years with a 1-year cliff.
  Revocable by DAO vote, so unvested tokens return to the timelock (i.e. the DAO) if a vote
  determines revocation is warranted — this is not a unilateral founder privilege.
- **4,000,000 HLC — treasury allocation.** Vests linearly over 3 years, not revocable. Vested
  tokens flow to a treasury multisig and are spent only per DAO-approved proposals — see
  [`Treasury.md`](Treasury.md) for worked examples (bootstrapping liquidity, paying for an
  audit).

Beyond genesis, the only way new HLC enters circulation is (a) through the PSM, backed 1:1 by
deposited reserve assets, or (b) through a future contract that the DAO has explicitly voted to
grant `MINTER_ROLE`. There is no discretionary inflation.

## 5. Governance

HLC holders govern the protocol directly; voting power comes from `ERC20Votes` checkpoints (an
address's balance, delegated), so voting weight is auditable and snapshot-based rather than
signature-of-the-day.

- **Proposal threshold:** 100 HLC held (delegated) to submit a proposal — low enough that
  meaningful stakeholders, not just whales, can propose.
- **Quorum:** 4% of total supply must vote for a proposal to be actionable — intentionally low,
  to avoid governance paralysis from low turnout, at the cost of concentrated holders having
  outsized influence on any given vote (see [§7](#7-risks-and-honest-limitations)).
- **Voting period:** targets roughly one week of real time, converted into a block count from
  the actual target chain's block time rather than a number copied from an Ethereum L1 reference
  (a ~12s/block chain and a sub-second-block L2 need very different block counts for the same
  wall-clock voting window — see [`TECHNICAL-DOCS.md`](TECHNICAL-DOCS.md) for the derivation).
- **Timelock delay:** 2 days (172,800 seconds) between a proposal succeeding and its execution
  being possible — enough time for anyone watching the chain to notice and react to a proposal
  they believe is harmful, even though there is deliberately no privileged canceller once a
  proposal is queued (removing that role removed a would-be admin backdoor; see
  [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md) §6).

A proposal's lifecycle: **Pending** (one block, so voting power is snapshotted before anyone can
react to the proposal's contents) → **Active** (the voting window) → **Succeeded** or **Defeated**
(based on for/against votes and quorum) → **Queued** (timelock delay) → **Executed**.

### Extending the protocol without touching existing contracts

Because the core contracts are immutable, new functionality is added by deploying a new,
independent contract and having the DAO grant it a narrowly-scoped role — never by patching or
upgrading an existing contract. This is not a hypothetical pattern; it is the intended path for
the near-term roadmap below, and it is documented in full (with a worked example) in
[`AddingFeature.md`](AddingFeature.md).

## 6. Roadmap

The core system — token, vesting, PSM, DAO, timelock — is deliberately minimal: it's the smallest
set of contracts that makes a CPI-indexed, DAO-governed stablecoin work end to end. Everything
below is future work, to be built as standalone contracts and connected to the existing system
purely through DAO-granted roles, per the extension pattern in §5.

- **Lending module.** The first planned extension. A money-market contract (Aave/Compound-style
  pool or an isolated-pair design — to be decided via governance discussion, not pre-committed
  here) that lets HLC holders lend against or borrow HLC using other assets as collateral. It
  would be granted `MINTER_ROLE` by DAO vote so that it can mint HLC against posted collateral
  the same way the PSM mints against reserve deposits, subject to whatever collateral-factor and
  liquidation parameters the DAO approves. Because it's a separate contract, a flaw in the
  lending module cannot compromise the PSM, the token, or governance itself — the DAO can revoke
  its role and deploy a fixed version without touching anything else.
- **Staking / veHLC-style vote-locking.** A mechanism for holders to lock HLC for a period in
  exchange for boosted voting weight and/or a share of protocol revenue (e.g. PSM spread, if one
  is ever introduced by governance). Intended to align long-term holders more closely with
  governance outcomes than a simple balance-weighted vote does, and to give quorum a more stable
  base than freely-liquid balances provide.
- **Cross-chain expansion.** The reference deployment targets Arbitrum; a canonical-vs-bridged
  supply model (e.g. a canonical mint on one chain with a burn-and-mint or lock-and-mint bridge
  contract elsewhere) is the leading candidate for expanding HLC to additional chains without
  fragmenting DAO authority — governance would remain on a single home chain, with bridge
  contracts on other chains granted only the specific mint/burn rights they need.
- **Additional reserve/collateral types.** The reference PSM supports a single reserve asset;
  supporting multiple reserve assets (or multiple isolated PSM instances, each with its own
  reserve and risk parameters) is a natural extension once the single-asset design has real
  usage to learn from.

None of the above exists in the contracts today, and nothing here is a commitment to a specific
implementation, timeline, or parameter set — those are exactly the kind of decisions this
protocol's own governance process exists to make. This section describes direction, not a spec.

## 7. Risks and honest limitations

This project does not benefit from overselling itself, so this section is written as plainly as
the rest of the technical documentation:

- **No professional security audit has been performed.** The contracts pass an internal test
  suite and have been through an internal adversarial review (which found and fixed one
  critical and one medium-severity issue — see [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md)),
  but neither of those is a substitute for an independent, professional audit. One is strongly
  recommended, and planned, before real user funds are put at meaningful risk.
- **CPI-indexed redemption has an inherent reserve-adequacy tension.** If CPI rises after a
  deposit, the PSM's redemption obligation for that deposit can exceed what it holds in reserve
  for a period, and `withdraw()` will correctly revert rather than pay out more than the reserve
  can cover, until the treasury tops up the shortfall. This is not a bug to be patched away; it
  is the direct consequence of promising purchasing-power stability without infinite reserves,
  and it is a real operational responsibility for the treasury and DAO, not a solved problem.
- **No admin emergency brake.** Removing any privileged canceller/pause role was a deliberate
  choice in favor of credible neutrality over convenience. It also means there is genuinely no
  way to stop a maliciously-passed proposal once it clears the timelock, beyond the 2-day window
  during which the community can react. Anyone relying on this protocol should understand that
  trade-off, not assume an admin safety net exists.
- **Low quorum (4%) is a deliberate but real trade-off.** It keeps governance functional with
  modest turnout, at the cost of a concentrated set of holders being able to pass proposals that
  the broader, less-engaged token base did not weigh in on.
- **CPI oracle dependency.** The system's core promise — purchasing-power stability — is only as
  good as the CPI data feeding it. A compromised, delayed, or manipulated data source degrades
  the peg's meaning even though the on-chain mechanics enforcing the *reported* rate remain
  sound.

## 8. Summary

Halal is a from-scratch attempt at a stablecoin that stabilizes purchasing power rather than
nominal price, governed entirely by the people who hold it, with no upgrade path and no admin
key once launched. The core system is intentionally small; a lending module, a vote-locking
staking mechanism, cross-chain expansion, and multi-collateral PSM support are the near-term
roadmap, each to be added as an independent contract granted a narrow role by governance vote —
never as a patch to the contracts described here. It is early, unaudited, and honest about both
facts.
