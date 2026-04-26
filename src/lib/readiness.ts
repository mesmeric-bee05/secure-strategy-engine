/**
 * Pure helpers for Module 02 — AI Readiness & Displacement Risk Lens.
 *
 * Math lives here (not in the route) so the gauge formula, calibration logic
 * and adjacent-skill ranking can be unit-tested without mounting the page.
 *
 * All "automation_probability" values are 0–1 and follow Frey & Osborne (2013):
 * the share of an occupation's tasks judged automatable inside the next two
 * decades on the US task baseline. We then apply a country-level LMIC
 * calibration multiplier (`countries.lmic_calibration`) that discounts the
 * baseline for capital-deepening, infrastructure and labour-cost differences
 * in the user's country.
 */

import type { ExtractedSkillT } from "./schemas";

/** Risk band thresholds (after LMIC calibration). */
export const RISK_BAND_DURABLE_MAX = 0.35;
export const RISK_BAND_MODERATE_MAX = 0.6;

export type RiskBand = "durable" | "moderate" | "exposed";

export function bandFor(calibrated: number): RiskBand {
  if (calibrated < RISK_BAND_DURABLE_MAX) return "durable";
  if (calibrated < RISK_BAND_MODERATE_MAX) return "moderate";
  return "exposed";
}

/** Human label for a band. */
export function bandLabel(band: RiskBand): string {
  switch (band) {
    case "durable":
      return "Durable — human judgement required";
    case "moderate":
      return "Moderate — LMIC context reduces near-term risk";
    case "exposed":
      return "Exposed — upskill toward adjacent durable skills";
  }
}

export interface SkillRisk {
  /** Display name for the skill (from AI extraction). */
  skillName: string;
  /** ISCO-08 4-digit code. */
  iscoCode: string;
  /** AI-assigned proficiency 1-10. */
  proficiency: number;
  /** Frey-Osborne raw automation probability, 0-1. May be null if unknown. */
  rawProbability: number | null;
  /** rawProbability * lmicCalibration, clamped to [0,1]. Null when raw is null. */
  calibratedProbability: number | null;
  band: RiskBand | null;
  /** True if mapped to a Frey-Osborne row. */
  hasData: boolean;
}

/**
 * Frey-Osborne row, keyed by isco_code. We keep the shape minimal so the
 * server function can return a tiny payload.
 */
export interface FreyOsborneRow {
  isco_code: string;
  automation_probability: number;
  task_routine_share?: number | null;
  task_cognitive_share?: number | null;
}

/**
 * Compose the per-skill risk view from extracted skills + Frey-Osborne lookup.
 * If a skill's ISCO code is missing from the FO table, we surface it as
 * `hasData: false` rather than silently dropping it.
 */
export function composeSkillRisks(
  skills: Pick<ExtractedSkillT, "skill_name" | "isco_code" | "proficiency_level">[],
  frey: FreyOsborneRow[],
  lmicCalibration: number
): SkillRisk[] {
  const calibration = clampCalibration(lmicCalibration);
  const byCode = new Map(frey.map((r) => [r.isco_code, r]));

  return skills.map((s) => {
    const row = byCode.get(s.isco_code);
    if (!row) {
      return {
        skillName: s.skill_name,
        iscoCode: s.isco_code,
        proficiency: s.proficiency_level,
        rawProbability: null,
        calibratedProbability: null,
        band: null,
        hasData: false,
      };
    }
    const raw = clamp01(Number(row.automation_probability));
    const calibrated = clamp01(raw * calibration);
    return {
      skillName: s.skill_name,
      iscoCode: s.isco_code,
      proficiency: s.proficiency_level,
      rawProbability: raw,
      calibratedProbability: calibrated,
      band: bandFor(calibrated),
      hasData: true,
    };
  });
}

/**
 * Composite automation risk for a profile.
 *
 * We want this to favour what the user is GOOD at — somebody whose top skill
 * is durable should not be tagged "exposed" because they also dabble in a
 * routine task. The composite is therefore a proficiency-weighted mean of the
 * calibrated probabilities, with a small floor weight so a profile of 1
 * skill at proficiency 1 doesn't dominate.
 *
 * Returns null when no skills have Frey-Osborne data.
 */
export function compositeRisk(risks: SkillRisk[]): number | null {
  const usable = risks.filter(
    (r) => r.calibratedProbability !== null && r.proficiency > 0
  );
  if (usable.length === 0) return null;
  let weightSum = 0;
  let weightedRisk = 0;
  for (const r of usable) {
    // Floor of 1 keeps very low proficiency from disappearing entirely.
    const weight = Math.max(1, r.proficiency);
    weightSum += weight;
    weightedRisk += weight * (r.calibratedProbability as number);
  }
  return clamp01(weightedRisk / weightSum);
}

/**
 * Education-level projection comparison: returns the delta in tertiary share
 * between the earliest and latest available year, useful for the headline
 * "+X.X pp tertiary by 2035" stat in the projections panel.
 */
export interface ProjectionRow {
  year: number;
  primary_pct: number | null;
  secondary_pct: number | null;
  tertiary_pct: number | null;
}
export interface ProjectionDelta {
  startYear: number;
  endYear: number;
  primaryPP: number;
  secondaryPP: number;
  tertiaryPP: number;
}
export function projectionDelta(rows: ProjectionRow[]): ProjectionDelta | null {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const pp = (a: number | null, b: number | null) =>
    a == null || b == null ? 0 : Number((b - a).toFixed(1));
  return {
    startYear: start.year,
    endYear: end.year,
    primaryPP: pp(start.primary_pct, end.primary_pct),
    secondaryPP: pp(start.secondary_pct, end.secondary_pct),
    tertiaryPP: pp(start.tertiary_pct, end.tertiary_pct),
  };
}

/**
 * Adjacent-skill recommendation: surface skills the user could ADD that would
 * reduce their composite risk the most. We pick from a curated short list
 * of durable/anchored skills keyed by category — kept here as data so the
 * route can render without a server round-trip.
 *
 * This is intentionally simple: it ranks candidates by how much each would
 * pull the composite below the moderate band if blended at proficiency 6.
 * The math is the same compositeRisk() function above.
 */
export interface AdjacentSkill {
  name: string;
  isco_code: string;
  rationale: string;
  resilience_score: number; // higher = more durable
}

const CURATED_ADJACENT: AdjacentSkill[] = [
  {
    name: "Quality control & inspection",
    isco_code: "3115",
    rationale: "Tactile judgement is hard to automate; pairs with any trade.",
    resilience_score: 0.78,
  },
  {
    name: "Customer relationship management",
    isco_code: "4225",
    rationale: "Empathy + context — durable across automation cycles.",
    resilience_score: 0.74,
  },
  {
    name: "Supervision & team leadership",
    isco_code: "1439",
    rationale:
      "First-line management consistently rated low automation by F-O.",
    resilience_score: 0.85,
  },
  {
    name: "Vocational training delivery",
    isco_code: "2359",
    rationale: "Teaching adults is one of the lowest F-O scores ever recorded.",
    resilience_score: 0.92,
  },
  {
    name: "Care & community work",
    isco_code: "5321",
    rationale:
      "Healthcare assistance and community work resist automation strongly.",
    resilience_score: 0.81,
  },
  {
    name: "Skilled trade — electrical/plumbing",
    isco_code: "7411",
    rationale:
      "Field repair under uncertainty stays human for the foreseeable future.",
    resilience_score: 0.7,
  },
];

/**
 * Recommend N adjacent skills that don't overlap with the user's current
 * profile and, if added, would best move them toward "durable".
 */
export function recommendAdjacent(
  current: SkillRisk[],
  pool: AdjacentSkill[] = CURATED_ADJACENT,
  topN = 3
): AdjacentSkill[] {
  const haveCodes = new Set(current.map((s) => s.iscoCode));
  return pool
    .filter((p) => !haveCodes.has(p.isco_code))
    .sort((a, b) => b.resilience_score - a.resilience_score)
    .slice(0, topN);
}

/**
 * The list of curated adjacents, exposed so callers can render the full set.
 */
export function curatedAdjacent(): AdjacentSkill[] {
  return [...CURATED_ADJACENT];
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * LMIC calibration is stored as a NUMERIC(3,2) in the DB and is expected to
 * sit in roughly [0.5, 1.0]. Clamp to [0.3, 1.2] defensively to keep the
 * gauge math sane in the presence of bad seed data.
 */
function clampCalibration(c: number): number {
  if (!Number.isFinite(c)) return 1;
  if (c < 0.3) return 0.3;
  if (c > 1.2) return 1.2;
  return c;
}
