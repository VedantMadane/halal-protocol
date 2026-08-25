# Protocol invariants

The stateful harness in [`contracts/test/HalalPSMInvariant.t.sol`](../contracts/test/HalalPSMInvariant.t.sol)
exercises randomized deposits, withdrawals, `transferRedeemable`, `cancelRedeemable`, and
governance CPI changes with reserve top-ups across two actors. Foundry runs each invariant for 64
sequences of 2,048 calls by default (the scheduled deep workflow raises this to 128 sequences of
8,192 calls).

## Accounting properties

| Property | Meaning | Harness scope |
| --- | --- | --- |
| Redemption-credit conservation | The sum of tracked actor credits equals `totalHlcIssued`. | All HLC issuance comes through PSM deposits; cancellation and withdrawal retire both values; the handler is the only actor surface. |
| Governance-rate collateralization | Reserve held by the PSM remains at least `reserveRequired()` after a governance CPI change. | The handler tops up the mock reserve before each rate change, then continues mixed user actions. |
| Supply decomposition | Token supply equals the fixed 10M genesis allocation plus outstanding PSM issuance. | The handler does not call the separately available ERC20 burn path; `cancelRedeemable` preserves this equation by reducing both values. |

The redemption boundary also applies when one address holds both asset classes: the focused
`test_TransferredCreditCannotUnlockRecipientGenesisBalance` regression test gives a recipient its
unbacked genesis allocation, transfers it a PSM claim, redeems exactly that claim, and proves the
remaining genesis HLC cannot drain the reserve. A plain ERC20 balance is therefore not evidence of
PSM redemption authority; `redeemableBalance` is the authority boundary.

Oracle freshness is intentionally one-sided: `test_StaleCpiReportStillAllowsExistingHolderToWithdraw`
proves that a stale report blocks new deposits while an existing holder can still redeem its own
credit. This preserves an exit path during an oracle outage without allowing new issuance against
unknown CPI data.

These are deliberately state-transition properties rather than claims that every governance
override is fully collateralized. Routine `updateCPI()` reports cannot raise `reserveRequired()`
above the reserve held by the PSM; the DAO-gated `mockCPI()` emergency path can intentionally do so.
The protocol exposes any resulting condition through `reserveSurplus()` and requires a
DAO-controlled reserve top-up before every outstanding claim can be redeemed.

Run the invariant suite directly:

```bash
cd contracts
forge test --match-path test/HalalPSMInvariant.t.sol -vvv
```

The harness is complementary to the unit tests. It does not replace an independent audit,
economic-model review, oracle integration review, or testing against adversarial reserve tokens.

Focused arithmetic tests in `contracts/test/HalalPSMArithmetic.t.sol` compare the contract's
conversion previews with independent `Math.mulDiv` reference formulas across every supported
reserve-decimal count (0 through 77), CPI bounds, and large amounts. These checks cover the
normalization branches but do not prove that an external reserve token is safe to use.
