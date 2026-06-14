# 03 · Trust & Credentials

The brief layers attestations, a three-of-N verification rule, and an on-chain soulbound NFT.
Current implementation covers the first two; the on-chain anchor is captured as a future phase.

## Implemented

- **Attestations** — `attestations` table + `submit_attestation` SECURITY DEFINER RPC.
  Rate-limited (10/hr/user), enforces length bounds on signature/pubkey fields, rejects
  duplicates, and writes an audit row for every outcome (success, dup, rl, validation fail).
- **Trust weight rollup** — `src/lib/trust-graph/` aggregates attestation weights and drives the
  `/trust-graph` route.
- **Public verifier** — `/credential/$id` reads via `getCredentialById` (service-role server fn)
  and returns a curated DTO (no PII).
- **Issuance** — `issue_credential` SECURITY DEFINER writes `credential_anchors` + audit row.
  Execute privilege revoked from PUBLIC/anon/authenticated; called only from privileged server
  paths.

## Deferred

- On-chain soulbound ERC-721 (Polygon/L2). The brief calls for `TalentCredential.sol` with
  non-transferable transfers. Plan: emit an external anchor hash from `issue_credential`, mint via
  a server-side relayer keyed to a secret. Tracked in [06-roadmap.md](./06-roadmap.md).
- Neo4j-backed trust graph. Current Postgres derivation is sufficient for the demo dataset.

## Cross-references

- `src/server/credentials.functions.ts`
- `src/lib/trust-graph/`
- `src/routes/credential.$id.tsx`
- `src/routes/trust-graph.tsx`
