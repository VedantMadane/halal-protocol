.PHONY: verify contracts-build contracts-test contracts-lint contracts-coverage app-lint app-build abis psm-health economic-model registry-check

verify: registry-check contracts-build contracts-test contracts-lint app-lint app-build

registry-check:
	node scripts/validate-deployment-registry.mjs

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

abis:
	cd app && pnpm gen:abis

psm-health:
	./scripts/check-psm-health.sh

economic-model:
	node scripts/model-psm.mjs
