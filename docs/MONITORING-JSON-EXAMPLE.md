# Machine-readable health monitoring example

The deployment health command has a stable JSON envelope and a meaningful exit contract:

- exit `0` means `status=healthy`;
- exit `1` means `status=unhealthy` and the `reasons` array explains why;
- exit `2` means the output or schema could not be consumed safely.

The repository includes a dependency-free consumer using the Node runtime already required by the
project:

```sh
./scripts/check-deployment-health.sh --json > health.json
node scripts/consume-health-json.mjs < health.json
```

The consumer emits one log-safe line on stderr and preserves the health result for cron, systemd,
or a small wrapper:

```text
halal_health status=healthy reasons=none warnings=none
halal_health status=unhealthy reasons=reserve_deficit warnings=normal_cpi_update_overdue
```

Do not alert by parsing human-readable `FAILED:` messages. Route on the exit status and the
machine-readable `reasons` array. The `observed` object is diagnostic context and may contain
addresses or source labels, so send it only to the protected incident log appropriate for the
deployment.

## Safe local checks

Healthy output can be produced by the disposable adapter rehearsal:

```sh
make adapter-demo > /tmp/halal-adapter-demo.txt 2>&1
```

An intentionally unhealthy, no-RPC fixture can verify paging behavior without changing chain state:

```sh
printf '%s\n' '{"schemaVersion":1,"status":"unhealthy","reasons":["reserve_deficit"],"warnings":[],"observed":{"reserve_surplus":"-1"}}' \
  | node scripts/consume-health-json.mjs
test "$?" -eq 1
```

For automation, prefer:

```sh
set +e
./scripts/check-deployment-health.sh --json | node scripts/consume-health-json.mjs
exit_code=$?
set -e
test "$exit_code" -eq 0 || echo "page operator: Halal deployment health is not healthy" >&2
exit "$exit_code"
```

This example is read-only. It does not prove availability, reserve solvency, CPI correctness, or
issuer safety; those remain separate operator and independent-review responsibilities.
