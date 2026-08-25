.PHONY: verify contracts-build contracts-test contracts-lint contracts-coverage app-lint app-build app-smoke abis psm-health deployment-health economic-model oracle-test adapter-demo registry-check shell-check

verify: registry-check shell-check oracle-test adapter-demo contracts-build contracts-test contracts-lint app-lint app-smoke

registry-check:
	node scripts/validate-deployment-registry.mjs

shell-check:
	bash -n scripts/*.sh

oracle-test:
	node --test scripts/test/*.test.mjs

adapter-demo:
	./scripts/local-adapter-demo.sh

contracts-build:
	cd contracts && forge build

contracts-test:
	cd contracts && forge test --force

contracts-lint:
	cd contracts && forge fmt --check src test script && forge lint src test script --severity high --severity med --severity low --severity gas

contracts-coverage:
	cd contracts && forge coverage --report summary

app-lint:
	cd app && pnpm lint

app-build:
	cd app && pnpm build

app-smoke:
	./scripts/local-app-smoke.sh

abis:
	cd app && pnpm gen:abis

psm-health:
	./scripts/check-psm-health.sh

deployment-health:
	./scripts/check-deployment-health.sh

economic-model:
	node scripts/model-psm.mjs
