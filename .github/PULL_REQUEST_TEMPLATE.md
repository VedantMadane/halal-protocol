## Summary

<!-- What does this PR change, and why? Link the issue it addresses, if any (e.g. "Closes #123"). -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `refactor` — no behavior change
- [ ] `chore` / `ci` — tooling, dependencies, CI

## Component(s) touched

- [ ] `contracts/src/` (see extra checklist below)
- [ ] `contracts/script/`
- [ ] `contracts/test/`
- [ ] `app/`
- [ ] `docs/`

## Checklist

- [ ] I ran the relevant test suite locally and it passes (`forge test` for contracts;
      `pnpm lint && pnpm build` for the frontend).
- [ ] I ran the relevant formatter (`forge fmt` for Solidity).
- [ ] I added or updated tests covering this change.
- [ ] I updated relevant documentation (`docs/`, NatSpec comments, READMEs) if this change
      affects behavior described there.
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

### If this PR touches `contracts/src/`

- [ ] I discussed this change in an issue first (linked above), or it's a trivial/obviously-safe
      fix (typo, comment, NatSpec).
- [ ] I called out any access-control, gas, or edge-case implications in the summary above.
- [ ] I considered whether this affects `HalalPSM` collateralization accounting or the DAO's
      timelock-gated execution path, and noted it if so.

## Additional context

<!-- Anything a reviewer needs to know: design tradeoffs, things you're unsure about, follow-up
work you're deliberately leaving out of scope. -->
