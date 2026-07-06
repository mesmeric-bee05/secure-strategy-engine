# Security docs

- `security-memory.md` — canonical, human-authored security memory. Mirrors what
  `security--update_memory` stores. **Editing this file requires a paired update**
  to the RLS invariants fixture, the accepted-findings JSON, or a new migration.
  CI enforces this via `scripts/check-security-memory-drift.ts`.
- `findings.accepted.json` — machine-readable list of scan findings intentionally
  accepted or ignored, with reasons. Consumed by
  `tests/security/security-memory.consistency.test.ts`.
- `findings-2026-06-12.md` — narrative report from the last full re-scan.

Nightly full re-scans run via `.github/workflows/security-nightly.yml` and
upload an HTML report + raw JSON as workflow artifacts.
