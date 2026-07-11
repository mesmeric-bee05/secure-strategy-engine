# TalentGraph Africa

Elite skill-capture, peer attestation, and portable credential platform for
informal-sector workers across Africa. Built on TanStack Start + Supabase.

## Security rescan (local)

Reproduce the nightly full security scan locally before pushing:

```bash
bun run security:rescan
```

The one-command workflow runs the full test suites (unit + integration +
security invariants), executes `bun audit`, aggregates results via
`scripts/security/collect.ts`, fingerprints each finding for stable de-dup,
and diffs against the previous run.

### Generated artifacts

| Path | Purpose |
| --- | --- |
| `reports/*.json` | Raw JSON per suite (vitest, bun-audit, etc.) |
| `reports/index.html` | Human-readable summary of the latest run |
| `src/security-history/<runId>.json` | Fingerprinted findings for the run (RBAC-gated) |
| `src/security-history/latest.json` | Alias for the most recent run |
| `src/security-history/index.json` | Run index consumed by the Findings History UI |

The `src/security-history/` directory is bundled at build time and only
reachable through the authenticated `/api/security/history/*` route
(admin role required). The old `public/security/history/*` path no
longer exists.

### Drift check

`bun run security:memory:check` regenerates the security-memory drift
report (`reports/security-memory-drift.md`) and fails if
`docs/security/security-memory.md` was edited without a matching change
to the RLS invariants fixture or `docs/security/findings.accepted.json`.

### Reviewing the results

Open `reports/index.html` in a browser to see per-run totals, or visit
`/security/findings-history` (Security admin sign-in required) to
diff two runs side-by-side.

## Additional docs

- `docs/roadmap/` — architecture, data model, AI pipeline, trust layer.
- `docs/security/` — security memory, accepted findings, past reports.
