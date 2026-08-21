# Security Policy

## Status: unaudited software

Halal (HLC) — the smart contracts in `contracts/src/` and the frontend in `app/` — has **not**
undergone a professional third-party security audit. Nothing in this repository should be
treated as safe to use with real funds. There is currently **no bug bounty program**. If you
choose to interact with a deployment of these contracts (on any network, including a public
testnet or mainnet), you do so entirely at your own risk. Treat any deployed instance you didn't
personally verify as unaudited and unproven, regardless of what a UI, announcement, or third
party might claim about it.

This policy will be updated once an audit (or a bug bounty program) is in place. Until then,
"unaudited" is not a formality — please read it as a real statement about the current risk level
of this code.

## Scope

- **Smart contracts**: everything under `contracts/src/` — `HalalToken`, `HalalVesting`,
  `HalalPSM`, `HalalDAO`, `HalalTimelock` — plus the deployment/operational scripts in
  `contracts/script/`.
- **Frontend**: the dApp under `app/`, including wallet-connection flows, transaction
  construction/signing, and any server-side code it ships with.

Out of scope: third-party dependencies (OpenZeppelin Contracts, Chainlink, Next.js, etc.) —
please report those upstream, though we'd appreciate a heads-up if a vulnerability in a
dependency affects how we use it. Social-engineering, spam, and denial-of-service reports against
project infrastructure (this repo, CI, hosting) rather than the protocol itself are also out of
scope for this policy — use normal GitHub abuse-reporting channels for those.

## Reporting a vulnerability

**If a bug could put real user funds at risk — a way to drain, freeze, mint without
authorization, bypass governance/access control, or otherwise break the PSM's collateralization
or the DAO's control over the system — please do not open a public GitHub issue or PR.** Public
disclosure before a fix ships gives potential attackers a head start.

Instead, report it privately to:

**security@halal-dao.example** *(placeholder — the project maintainer should replace this with a
real monitored address, or a GitHub Security Advisory / private vulnerability-reporting channel,
before this project is treated as live)*

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a minimal proof-of-concept (a Foundry test reproducing the issue against
  `contracts/src/` is ideal, if applicable).
- The affected file(s)/function(s)/commit, and which network(s) it applies to if relevant.
- Your assessment of severity, if you have one — we'll form our own view too, but your reasoning
  helps.

If your finding is a normal bug with no security impact (a UI glitch, a gas inefficiency, a
documentation error, a test that's wrong), please just open a regular public issue instead —
save the private channel for things that genuinely need it.

## What to expect

This is currently a small, volunteer-maintained open-source project, not a company with a formal
security team, so please calibrate expectations accordingly:

- **Acknowledgment**: we aim to acknowledge a private report within **5 business days**.
- **Initial assessment**: a first read on severity and validity within **10 business days** of
  acknowledgment.
- **Resolution timeline**: depends entirely on severity and complexity — a critical
  fund-at-risk issue in `contracts/src/` gets prioritized above everything else; low-severity
  issues may take longer. We'll communicate a rough timeline once triaged.
- **Coordinated disclosure**: we'll work with you on when and how to disclose publicly once a
  fix is available (or deployed, for on-chain issues where a fix requires a governance
  action/timelock delay). We ask that you not disclose publicly until we've had a reasonable
  chance to respond and, where applicable, ship a fix.
- **Credit**: unless you ask to stay anonymous, we're happy to credit you in the fix's
  changelog/release notes once it's safe to disclose.

## A note on immutability

Several contracts in this system (`HalalToken`, `HalalVesting`, `HalalPSM`, `HalalTimelock`) are
**not upgradeable** — see `docs/AddingFeature.md` for the intended extension pattern (deploy a
new contract, grant it a role via DAO vote, rather than patching existing bytecode). This means
some classes of bugs in an already-deployed instance cannot be "hotfixed" in place; response may
instead involve a DAO vote to pause/revoke a role, migrate to a redeployed contract, or otherwise
mitigate at the protocol-parameter level. This makes catching issues *before* deployment,
and reporting them responsibly if found after, especially important.
