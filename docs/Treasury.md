In this protocol, “treasury” is a role and a set of balances, not a single magical bank account. The DAO
controls protocol-owned contracts through the timelock, while the treasury beneficiary controls the
tokens that have actually been released to its wallet. Keep those permissions separate when designing
budgets and operational procedures.

Here is exactly how your Treasury works, broken down by **Structure**, **Flow**, and **Real-World Examples**.

***

### 1. The Structure: What is "The Treasury"?

In your deployed contracts, the Treasury is actually **two things**:

1.  **The Treasury Vesting Contract**: Holds the 4,000,000 HLC allocated for the protocol. It releases tokens slowly over 3 years so the market isn't flooded.
2.  **The Beneficiary Wallet (Multisig)**: This is the address (set in your `.env` as `TREASURY_BENEFICIARY`) that receives HLC when it is released.

**The Hierarchy:**
*   **The DAO (Governor):** The "Board of Directors." They vote on *budgets*.
*   **The Multisig (Gnosis Safe):** The "CFO/Finance Team." They execute the daily spending based on the budget.
*   **The Vesting Contract:** The "Trust Fund." It holds the locked tokens.

### 2. Worked Example: HLC Balance versus Redemption Credit

The PSM deliberately tracks two different things. `token.balanceOf(account)` is the ordinary
fungible HLC balance, while `psm.redeemableBalance(account)` is the amount of that balance that
the account may redeem against this PSM. The second value is the accounting boundary; receiving
HLC does not automatically create redemption rights.

Assume a fresh PSM at CPI 1.0, no transfer fees, and an illustrative deposit of 100 reserve units:

| Action | Alice HLC balance | Bob HLC balance | Alice redeemable credit | Bob redeemable credit |
| --- | ---: | ---: | ---: | ---: |
| Alice deposits 100 reserve units | 100 | 0 | 100 | 0 |
| Alice calls ordinary `HLC.transfer(Bob, 40)` | 60 | 40 | 100 | 0 |
| Alice approves and calls `PSM.transferRedeemable(Bob, 40)` | 20 | 80 | 60 | 40 |
| Bob approves and withdraws 40 HLC | 20 | 40 | 60 | 0 |
| Alice approves and calls `PSM.cancelRedeemable(10)` | 10 | 40 | 50 | 0 |

The ordinary ERC20 transfer moves only HLC. Bob cannot redeem the 40 received that way, because
Bob's credit is still zero. `transferRedeemable` moves the PSM-issued HLC and its matching credit
atomically, so Bob can redeem exactly the transferred claim. `cancelRedeemable` burns HLC and
retires the matching credit without returning reserve; after the final row, the PSM still holds
60 reserve units against 50 outstanding HLC units, so 10 units are surplus rather than an active
redemption obligation.

This example omits CPI movement, decimal scaling, slippage, and fee-on-transfer behavior. For the
stateful conservation property and the genesis-allocation boundary, see
[`docs/INVARIANTS.md`](INVARIANTS.md), `test_TransferRedeemableMovesHLCAndRedemptionCreditAtomically`,
and `test_TransferredCreditCannotUnlockRecipientGenesisBalance`.

***

### 3. Real-World Example A: Creating a Market (Liquidity)

**The Problem:** You launch HLC, but no one can buy it because it's not on Uniswap.
**The Goal:** Put \$50,000 worth of HLC and \$50,000 worth of DAI into Uniswap so people can trade.

**How the Treasury Handles It:**

1.  **The Budget Decision:** The treasury multisig approves the use of an amount that has already vested. A DAO proposal is not required merely to call `release()`; `release()` is intentionally callable by anyone and always pays the configured beneficiary.
2.  **The Release:** The beneficiary, a multisig operator, or any third party calls `release()` on the `HalalVesting` contract.
3.  **The Transfer:** The released HLC moves from the vesting contract to the treasury beneficiary.
4.  **The Execution:** The multisig signers take that HLC, pair it with DAI they raised, and deposit it into a liquidity venue after reviewing the trade and custody risks.
5.  **The Result:** Any LP position belongs to the wallet or contract that supplied it; it is not automatically protocol-owned merely because the tokens came from vesting.

***

### 4. Real-World Example B: Paying for a Security Audit

**The Problem:** You need to pay an audit firm (e.g., OpenZeppelin) \$100,000 to check your new lending contract. They accept USDC, not HLC.

**How the Treasury Handles It:**

1.  **The Budget Decision:** The multisig approves selling up to a specified amount of HLC for USDC, subject to its own signing policy and any DAO-controlled contract permissions involved in the transaction.
2.  **The Swap:** The Treasury Multisig receives the HLC (if vested), then executes the reviewed HLC -> USDC trade.
    *   *Note: This lowers the price of HLC slightly, so it must be done carefully.*
3.  **The Payment:** The Multisig sends the USDC to the auditor.
4.  **The Receipt:** The final audit report is published to the community as proof of work.

***

### 5. Real-World Example C: The "Rainy Day" Fund (Revenue)

Right now, your Treasury only holds HLC tokens. But a healthy Treasury should also hold **stablecoins (DAI/USDC)** so you can pay bills even if the HLC price drops.

**How to get Revenue into the Treasury:**
*   **PSM Fees:** Currently, your PSM charges no protocol fee. Its exchange rate still follows the
    CPI-adjusted rate; a future PSM version could add a fee, but that would require a separately
    reviewed and governed deployment.
*   **Lending Fees:** If you launch the Lending module, the interest paid by borrowers goes into the Treasury.

**Scenario:**
1.  In a hypothetical fee-enabled version, a user mints 1,000 HLC using DAI.
2.  That version charges a 2 DAI fee.
3.  That 2 DAI is sent to the Treasury Multisig.
4.  Over a year, this accumulates to 500,000 DAI.
5.  **Result:** Now, if you need to pay for marketing, you use this DAI instead of selling HLC. This prevents dumping your own token price.

***

### 6. How the "Vesting" Constraint Works in Real Life

You allocated 4M HLC to the Treasury with **3-year vesting**. This protects the community.

*   **Month 1:** You want to spend 1M HLC on a Super Bowl ad.
*   **The Contract Says:** "No." Only ~111,000 HLC (1/36th of the total) becomes available each month.
*   **The Result:** You are forced to be frugal. You can only spend what has vested. This gives investors confidence that the team/DAO cannot "rug pull" or dump all 4M tokens at once.

### Summary Flowchart

```text
[HalalVesting Contract]
      | (Holds 4M locked HLC)
      |
      | Time passes... (Tokens vest)
      |
      v
[Anyone calls release()] ---------> [Treasury Multisig Wallet]
                                          | (Holds Liquid HLC + Revenue DAI)
                                          |
                  +-----------------------+-----------------------+
                  |                       |                       |
        [Uniswap Pool]             [Contractor/Auditor]      [Yield Farmers]
      (Provides Liquidity)           (Pays Expenses)        (Growth Incentives)
```

### Best Practice Recommendation
For your project, I highly recommend you set the `TREASURY_BENEFICIARY` in your `.env` file to a **Gnosis Safe** address, not a standard single-user wallet. This ensures that if one person loses their key, the Treasury funds are still safe.
