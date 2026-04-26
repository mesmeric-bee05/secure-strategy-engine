import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { COUNTRY_CODE } from "@/lib/schemas";
import {
  composeSkillRisks,
  compositeRisk,
  curatedAdjacent,
  type SkillRisk,
  type AdjacentSkill,
  type FreyOsborneRow,
  type ProjectionRow,
} from "@/lib/readiness";
import { getSupabasePublic } from "@/lib/supabase-server";

const ReadinessInput = z.object({
  /**
   * ISCO codes already on the user's profile. We only fetch Frey-Osborne rows
   * for these to keep the payload small. The route may also pass an empty
   * array when no profile has been built yet, in which case we still return
   * country calibration + projections so the page renders something useful.
   */
  iscoCodes: z
    .array(z.string().regex(/^[0-9]{4}$/))
    .max(40)
    .default([]),
  countryCode: COUNTRY_CODE.default("KE"),
  /**
   * Optional skill names so the per-skill rows can render without re-running
   * the AI extractor. We trust the client here because nothing is written —
   * this is a read-only enrichment.
   */
  skills: z
    .array(
      z.object({
        skill_name: z.string().min(1).max(120),
        isco_code: z.string().regex(/^[0-9]{4}$/),
        proficiency_level: z.number().int().min(1).max(10),
      }),
    )
    .max(40)
    .default([]),
});
export type ReadinessInputT = z.infer<typeof ReadinessInput>;

export interface ReadinessReport {
  country: {
    code: string;
    name: string;
    flag_emoji: string | null;
    /** 0.5–1.0 typical; 1.0 = no LMIC discount applied. */
    lmic_calibration: number;
  };
  /** Per-skill rows, in input order. Includes rows where Frey-Osborne lookup failed. */
  skillRisks: SkillRisk[];
  /** Composite proficiency-weighted risk on the calibrated scale. Null when no data. */
  compositeRisk: number | null;
  /** Education projections for the country, sorted by year. */
  projections: ProjectionRow[];
  /** Curated adjacent skills the user could add, ordered by resilience. */
  adjacent: AdjacentSkill[];
  /** Source citations to surface inline. */
  sources: { key: string; label: string; citation: string }[];
}

export const getReadinessReport = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => ReadinessInput.parse(input ?? {}))
  .handler(async ({ data }): Promise<ReadinessReport> => {
    const sb = getSupabasePublic();

    // Country (for calibration + flag).
    const { data: country } = await sb
      .from("countries")
      .select("code,name,flag_emoji,lmic_calibration")
      .eq("code", data.countryCode)
      .maybeSingle();

    const calibration = Number(country?.lmic_calibration ?? 1);

    // Frey-Osborne rows for the requested ISCO codes.
    const codes = data.skills.map((s) => s.isco_code).concat(data.iscoCodes);
    const uniqueCodes = Array.from(new Set(codes));
    let freyRows: FreyOsborneRow[] = [];
    if (uniqueCodes.length > 0) {
      const { data: rows } = await sb
        .from("frey_osborne_scores")
        .select("isco_code,automation_probability,task_routine_share,task_cognitive_share")
        .in("isco_code", uniqueCodes);
      freyRows = (rows ?? []) as FreyOsborneRow[];
    }

    // Wittgenstein projections — country-specific then SSP2 region fallback.
    let projectionRows: ProjectionRow[] = [];
    {
      const { data: rows } = await sb
        .from("wittgenstein_projections")
        .select("year,primary_pct,secondary_pct,tertiary_pct")
        .eq("country_code", data.countryCode)
        .eq("scenario", "SSP2")
        .order("year");
      projectionRows = (rows ?? []) as ProjectionRow[];
    }
    if (projectionRows.length === 0) {
      // Region-level fallback so the UI can still render a curve.
      const { data: rows } = await sb
        .from("wittgenstein_projections")
        .select("year,primary_pct,secondary_pct,tertiary_pct")
        .eq("region", "Sub-Saharan Africa")
        .eq("scenario", "SSP2")
        .order("year");
      projectionRows = (rows ?? []) as ProjectionRow[];
    }

    const risks = composeSkillRisks(data.skills, freyRows, calibration);
    const composite = compositeRisk(risks);
    const adjacent = curatedAdjacent();

    return {
      country: {
        code: data.countryCode,
        name: country?.name ?? data.countryCode,
        flag_emoji: country?.flag_emoji ?? null,
        lmic_calibration: calibration,
      },
      skillRisks: risks,
      compositeRisk: composite,
      projections: projectionRows,
      adjacent,
      sources: [
        {
          key: "frey-osborne",
          label: "Frey & Osborne (2013)",
          citation:
            "Automation probabilities by occupation. Calibrated for LMIC context using country-level multipliers.",
        },
        {
          key: "wittgenstein",
          label: "Wittgenstein Centre — SSP2",
          citation: "Education-level projections by country, age and sex through 2035.",
        },
      ],
    };
  });
