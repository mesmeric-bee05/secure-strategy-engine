# 06 · Phase Roadmap

This file is the canonical source for `/dashboard` (Phases tab). Keep the two in sync — the route
imports `src/lib/dashboard-content.ts`, which mirrors the phase list below.

| # | Phase | Window | Status |
| - | --- | --- | --- |
| 1 | Foundation & scaffolding | Hours 0–4 | Shipped |
| 2 | Core AI pipeline | Hours 4–14 | Shipped |
| 3 | Trust & credential layer | Hours 14–22 | In progress (on-chain anchor deferred) |
| 4 | Frontend — mobile-first PWA | Hours 22–34 | Shipped |
| 5 | Security hardening | Hours 34–40 | Shipped |
| 6 | Polish, seed data & demo prep | Hours 40–48 | In progress (visual regression baselines pending) |

## Post-hackathon

- **Week 1** — Gather user feedback, fix critical bugs, optimise AI response times.
- **Week 2–4** — Ship on-chain credential anchor (relayer-signed L2 mint, soulbound transfer-reject).
- **Month 2** — Per-tenant fairness thresholds + admin review UI.
- **Month 3** — Open API for institutions (curated server-fn surface, key-issued via dashboard).

## Cross-references

- Live surface: `/dashboard`
- Data source: `src/lib/dashboard-content.ts`
- Security posture: `docs/security/findings-2026-06-12.md`
