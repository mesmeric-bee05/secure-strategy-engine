# 05 · Fairness Audits

> "Flag if any group has > 15% deviation from mean approval rate."
> — architecture brief, pages 23–24 and 31–32

## Implementation

- `fairness_audits` table (RLS: `no_write` deny policy; writes via SECURITY DEFINER batch job).
- Audit row schema: `{ batch_id, group_dimension, group_value, approval_rate, deviation_pp, flagged_at }`.
- Scheduled via `pg_cron` after each decision batch.

## Algorithm

```
overall_rate    = approvals / total
group_rates[g]  = approvals_in_group / total_in_group
flagged[g]      = |group_rates[g] - overall_rate| > 0.15
```

When any group is flagged, the batch is held for human review before any downstream credential
issuance. The held batch surfaces in the `/security` route's review queue.

## Gaps

- No public UI yet for reviewing flagged batches with attestation context; admin-only view today.
- Deviation threshold (15pp) is hard-coded; should move to a `fairness_thresholds` table once we
  ship per-tenant configuration.

## Cross-references

- `supabase/migrations/` (search for `fairness_audits`)
- `src/routes/security.tsx`
- Architecture brief pp. 23–24, 31–32
