# Extending deployment-configuration tests

Use `contracts/test/DeployConfig.t.sol` for pure validation rules that protect the production
deployment script. These tests do not broadcast transactions or read process environment variables;
they expose a small pure helper through `DeployHalalSystemHarness` and exercise the helper with
valid and invalid boundary values.

## Run the focused suite

From the repository root:

```shell
cd contracts
forge test --match-contract DeployConfigTest
```

The full repository check remains:

```shell
cd ..
make verify
```

## Add a new guard

1. Identify the production invariant in `contracts/script/Deploy.s.sol`.
2. Keep the validation rule pure and isolated when possible. A pure helper is easier to test than a
   helper that depends on `vm.env*`, chain state, or a private key.
3. Expose only the helper needed by the test harness; do not duplicate the production rule inside
   the test.
4. Test the valid case, zero values, identity collisions, and the nearest meaningful numeric
   boundaries.
5. Keep `DeployLocal.s.sol` in view. The local demo intentionally has disposable defaults that
   production must reject, such as both beneficiaries defaulting to the Anvil broadcaster.
6. Update the production operator runbook and threat model when the guard changes a custody or
   deployment-safety assumption.

For example, the beneficiary separation rule is represented by the production helper:

```solidity
function _beneficiariesAreDistinct(address teamBeneficiary, address treasuryBeneficiary)
    internal
    pure
    returns (bool)
{
    return teamBeneficiary != address(0) && treasuryBeneficiary != address(0)
        && teamBeneficiary != treasuryBeneficiary;
}
```

The harness calls that helper, and the test proves nonzero distinct addresses pass while zero and
identical addresses fail. A second test covers the production rule that neither beneficiary may be
the temporary deployer.

## Documentation count checklist

Adding a Foundry test changes the count reported in the repository documentation. Search for the
current count before opening a PR:

```shell
rg -n "tests passing|test suite|unit/configuration" README.md CONTRIBUTING.md contracts/README.md docs
```

Update only current-state summaries; historical changelog entries should remain historical. The
PR should state the old and new totals and include the focused test command in its description.

## Review boundary

Deployment-config tests prove that the script rejects the cases they enumerate. They do not prove
that a chosen reserve token is safe, that beneficiary multisigs are controlled correctly, or that
the immutable protocol contracts are audited. For those questions, read the [operator runbook](OPERATOR-RUNBOOK.md),
[threat model](THREAT-MODEL.md), and [security policy](../SECURITY.md), and disclose fund-risking
findings privately.
