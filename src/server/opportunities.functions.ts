import { createServerFn } from "@tanstack/react-start";
import {
  ListOpportunitiesInput,
  MatchOpportunitiesInput,
  PERSONA_SLUG,
} from "@/lib/schemas";
import { getSupabasePublic } from "@/lib/supabase-server";

export interface OpportunityCardDTO {
  id: string;
  title: string;
  employer: string | null;
  description: string | null;
  required_skills: string[];
  required_isco_codes: string[];
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_period: string | null;
  is_remote: boolean;
  country_code: string | null;
  location: string | null;
  growth_pct: number | null;
  source: string | null;
  source_citation: string | null;
  match_pct?: number;
}

export const listOpportunities = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    ListOpportunitiesInput.parse(input ?? {})
  )
  .handler(async ({ data }): Promise<OpportunityCardDTO[]> => {
    const sb = getSupabasePublic();
    let q = sb
      .from("opportunities")
      .select(
        "id,title,employer,description,required_skills,required_isco_codes,salary_min,salary_max,currency,salary_period,is_remote,country_code,location,growth_pct,source,source_citation"
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.countryCode) q = q.eq("country_code", data.countryCode);
    if (data.remote !== undefined) q = q.eq("is_remote", data.remote);
    const { data: rows, error } = await q;
    if (error) {
      console.error("listOpportunities", error);
      return [];
    }
    return (rows ?? []) as OpportunityCardDTO[];
  });

/**
 * Persona-driven keyword/ISCO match (no embeddings yet — that comes once
 * authenticated users start uploading portfolios). Pure server-side rerank
 * keeps the demo deterministic.
 */
export const matchOpportunities = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    MatchOpportunitiesInput.parse(input ?? {})
  )
  .handler(async ({ data }): Promise<OpportunityCardDTO[]> => {
    const sb = getSupabasePublic();

    const personaSkillSeeds = data.personaSlug
      ? PERSONA_SKILL_SEEDS[
          PERSONA_SLUG.parse(data.personaSlug)
        ]
      : null;

    let q = sb
      .from("opportunities")
      .select(
        "id,title,employer,description,required_skills,required_isco_codes,salary_min,salary_max,currency,salary_period,is_remote,country_code,location,growth_pct,source,source_citation"
      )
      .limit(50);
    if (data.countryCode) q = q.eq("country_code", data.countryCode);

    const { data: rows, error } = await q;
    if (error || !rows) return [];

    if (!personaSkillSeeds) {
      return (rows.slice(0, data.limit) as OpportunityCardDTO[]).map((o) => ({
        ...o,
        match_pct: 50,
      }));
    }

    const scored = rows.map((opp) => {
      const iscoOverlap = countOverlap(
        opp.required_isco_codes ?? [],
        personaSkillSeeds.iscoCodes
      );
      const kwOverlap = countOverlapInsensitive(
        opp.required_skills ?? [],
        personaSkillSeeds.keywords
      );

      // Weighted score: ISCO match 60%, keyword match 30%, base 10%.
      const iscoScore =
        personaSkillSeeds.iscoCodes.length > 0
          ? iscoOverlap / personaSkillSeeds.iscoCodes.length
          : 0;
      const kwScore =
        personaSkillSeeds.keywords.length > 0
          ? kwOverlap / personaSkillSeeds.keywords.length
          : 0;
      const raw = 0.6 * iscoScore + 0.3 * kwScore + 0.1;
      const match_pct = Math.round(Math.min(0.99, raw) * 100);
      return { ...(opp as OpportunityCardDTO), match_pct };
    });

    scored.sort((a, b) => (b.match_pct ?? 0) - (a.match_pct ?? 0));
    return scored.slice(0, data.limit);
  });

export const listCountries = createServerFn({ method: "GET" }).handler(
  async () => {
    const sb = getSupabasePublic();
    const { data, error } = await sb
      .from("countries")
      .select(
        "code,name,flag_emoji,currency,youth_unemployment_pct,min_wage_monthly_usd,min_wage_local,informal_share_pct,human_capital_index,population_millions,unemployment_source,wage_source,informal_source,hci_source"
      )
      .order("name");
    if (error) {
      console.error("listCountries", error);
      return [];
    }
    return data ?? [];
  }
);

export type CountryRow = Awaited<ReturnType<typeof listCountries>>[number];

/* -------------------------------------------------------------------------- */
/* Persona "skill seed" reference data — used as a deterministic stand-in    */
/* for embeddings until live AI skill profiles are saved per user.            */
/* These reflect the seeded persona prefill_text from the personas table.    */
/* -------------------------------------------------------------------------- */

const PERSONA_SKILL_SEEDS: Record<
  "sarah" | "james" | "amara" | "kwame",
  { iscoCodes: string[]; keywords: string[] }
> = {
  sarah: {
    iscoCodes: ["7531", "7318", "5223"],
    keywords: [
      "sewing",
      "pattern making",
      "embroidery",
      "quality control",
      "customer service",
    ],
  },
  james: {
    iscoCodes: ["7421", "5230", "3322"],
    keywords: [
      "micro-soldering",
      "board-level repair",
      "team management",
      "customer service",
      "inventory management",
    ],
  },
  amara: {
    iscoCodes: ["6111", "6121", "3322"],
    keywords: [
      "crop production",
      "cooperative leadership",
      "record keeping",
      "negotiation",
    ],
  },
  kwame: {
    iscoCodes: ["3322", "5223", "8322"],
    keywords: [
      "logistics",
      "negotiation",
      "customer service",
      "languages",
      "inventory management",
    ],
  },
};

function countOverlap(a: string[], b: string[]): number {
  const set = new Set(b);
  let n = 0;
  for (const v of a) if (set.has(v)) n++;
  return n;
}
function countOverlapInsensitive(a: string[], b: string[]): number {
  const set = new Set(b.map((s) => s.toLowerCase()));
  let n = 0;
  for (const v of a) if (set.has(v.toLowerCase())) n++;
  return n;
}
