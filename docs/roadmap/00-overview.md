# 00 · Vision & System Overview

> 600M informal workers in Sub-Saharan Africa have professional-grade skills but no portable record
> of them. TalentGraph Africa maps those skills to ISCO-08 occupations, attaches cryptographic
> credentials, and surfaces real global opportunities.

## System layers (from the architecture brief)

```
┌──────────────────────────────────────────────────────────────┐
│  PWA shell (TanStack Start, React 19, i18next: en/sw/fr/ha)  │
├──────────────────────────────────────────────────────────────┤
│  Server functions  ·  Edge functions (AI surface, webhooks)  │
├──────────────────────────────────────────────────────────────┤
│  Postgres + pgvector  ·  RLS  ·  Audit log  ·  pg_cron       │
├──────────────────────────────────────────────────────────────┤
│  External: Lovable AI Gateway · Cloudflare edge · WebAuthn   │
└──────────────────────────────────────────────────────────────┘
```

The brief originally proposed FastAPI + SQLAlchemy + Redis + Celery + Neo4j + Polygon. The
implementation collapses those onto the Lovable stack: server functions replace FastAPI,
`rl_check` SECURITY DEFINER replaces Redis sliding windows, the trust graph lives in Postgres with
a derived view rather than Neo4j, and the on-chain anchor is deferred (see
[03-trust-and-credentials.md](./03-trust-and-credentials.md)).

## Cross-references

- Visual brief: `talentgraph_unmapped_v2.html` (UNMAPPED design tokens, currently mirrored in `src/styles.css`)
- Master dashboard brief: `talentgraph_master_dashboard.html` → `/dashboard`
- Live route map: `src/routes/`
