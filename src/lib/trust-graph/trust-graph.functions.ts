/**
 * Trust graph server functions.
 *
 * - syncTrustGraph: pulls verified skills, attestations, opportunities, and
 *   profiles from Postgres (via supabaseAdmin) and MERGEs them into Neo4j.
 * - findTrustedMatches: returns opportunities reachable from the current
 *   user through verified skills and attestations, with a trust score.
 * - getTrustGraphSubgraph: returns nodes/edges around a user for the UI.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withSession } from "./driver.server";
import { ensureTrustGraphSchema } from "./schema.server";

type SyncResult = {
  ok: boolean;
  users: number;
  skills: number;
  attestations: number;
  opportunities: number;
};

export const syncTrustGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    // Only admins may trigger full sync.
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      throw new Error("Forbidden: admin role required to sync the trust graph.");
    }

    await ensureTrustGraphSchema();

    const [{ data: profiles }, { data: skills }, { data: atts }, { data: opps }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, display_name, country_code, preferred_language")
          .limit(5000),
        supabaseAdmin
          .from("skills")
          .select(
            "id, user_id, skill_name, isco_code, is_verified, composite_score, attestation_weight_sum",
          )
          .eq("is_verified", true)
          .limit(20000),
        supabaseAdmin
          .from("attestations")
          .select(
            "id, skill_id, attester_id, attester_name, relationship, trust_weight, is_valid",
          )
          .eq("is_valid", true)
          .limit(50000),
        supabaseAdmin
          .from("opportunities")
          .select(
            "id, title, employer, required_isco_codes, country_code, location, is_remote",
          )
          .limit(20000),
      ]);

    const counts = {
      users: profiles?.length ?? 0,
      skills: skills?.length ?? 0,
      attestations: atts?.length ?? 0,
      opportunities: opps?.length ?? 0,
    };

    await withSession(async (session) => {
      // Batched MERGE using UNWIND for efficiency.
      if (profiles?.length) {
        await session.run(
          `UNWIND $rows AS r
           MERGE (u:User {id: r.id})
             SET u.displayName = r.display_name,
                 u.country     = r.country_code,
                 u.language    = r.preferred_language
           WITH r WHERE r.country_code IS NOT NULL
           MERGE (p:Place {code: r.country_code})
           MERGE (u)-[:LIVES_IN]->(p)`,
          { rows: profiles },
        );
      }
      if (skills?.length) {
        await session.run(
          `UNWIND $rows AS r
           MERGE (s:Skill {id: r.id})
             SET s.name           = r.skill_name,
                 s.isco           = r.isco_code,
                 s.verified       = r.is_verified,
                 s.compositeScore = r.composite_score,
                 s.trustWeight    = r.attestation_weight_sum
           MERGE (u:User {id: r.user_id})
           MERGE (u)-[:HAS_SKILL]->(s)`,
          { rows: skills },
        );
      }
      if (atts?.length) {
        await session.run(
          `UNWIND $rows AS r
           MERGE (a:Attestation {id: r.id})
             SET a.name         = r.attester_name,
                 a.relationship = r.relationship,
                 a.weight       = r.trust_weight,
                 a.valid        = r.is_valid
           MERGE (s:Skill {id: r.skill_id})
           MERGE (s)-[:EVIDENCED_BY]->(a)
           WITH r, a WHERE r.attester_id IS NOT NULL
           MERGE (att:User {id: r.attester_id})
           MERGE (att)-[:ATTESTED {weight: r.trust_weight}]->(a)`,
          { rows: atts },
        );
      }
      if (opps?.length) {
        await session.run(
          `UNWIND $rows AS r
           MERGE (o:Opportunity {id: r.id})
             SET o.title    = r.title,
                 o.employer = r.employer,
                 o.country  = r.country_code,
                 o.location = r.location,
                 o.remote   = r.is_remote,
                 o.isco     = r.required_isco_codes
           WITH r, o WHERE r.country_code IS NOT NULL
           MERGE (p:Place {code: r.country_code})
           MERGE (o)-[:LOCATED_IN]->(p)
           WITH r, o
           UNWIND coalesce(r.required_isco_codes, []) AS code
           MERGE (s:Skill {isco: code})
             ON CREATE SET s.id = 'isco:' + code, s.name = code, s.verified = true
           MERGE (o)-[:REQUIRES]->(s)`,
          { rows: opps },
        );
      }
    });

    return { ok: true, ...counts };
  });

export const findTrustedMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const result = await withSession((session) =>
      session.run(
        `MATCH (u:User {id: $userId})-[:HAS_SKILL]->(s:Skill)<-[:REQUIRES]-(o:Opportunity)
         OPTIONAL MATCH (s)-[:EVIDENCED_BY]->(a:Attestation)
         WITH o, s, count(DISTINCT a) AS evidence,
              coalesce(sum(a.weight), 0) + coalesce(s.trustWeight, 0) AS trust
         RETURN o.id AS id, o.title AS title, o.employer AS employer,
                o.location AS location, o.country AS country,
                collect(DISTINCT s.name) AS matchedSkills,
                sum(evidence) AS evidenceCount,
                sum(trust) AS trustScore
         ORDER BY trustScore DESC, evidenceCount DESC
         LIMIT toInteger($limit)`,
        { userId: context.userId, limit: data.limit },
      ),
    );
    return {
      matches: result.records.map((r) => ({
        id: r.get("id") as string,
        title: r.get("title") as string,
        employer: r.get("employer") as string | null,
        location: r.get("location") as string | null,
        country: r.get("country") as string | null,
        matchedSkills: r.get("matchedSkills") as string[],
        evidenceCount: Number(r.get("evidenceCount") ?? 0),
        trustScore: Number(r.get("trustScore") ?? 0),
      })),
    };
  });

export const getTrustSubgraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await withSession((session) =>
      session.run(
        `MATCH (u:User {id: $userId})
         OPTIONAL MATCH p = (u)-[:HAS_SKILL]->(s:Skill)
         OPTIONAL MATCH (s)-[:EVIDENCED_BY]->(a:Attestation)
         OPTIONAL MATCH (o:Opportunity)-[:REQUIRES]->(s)
         RETURN u, collect(DISTINCT s) AS skills,
                collect(DISTINCT a) AS atts,
                collect(DISTINCT o) AS opps`,
        { userId: context.userId },
      ),
    );
    const rec = result.records[0];
    if (!rec) return { nodes: [], edges: [] };
    const u = rec.get("u").properties as { id: string; displayName?: string };
    const skills = rec.get("skills") as Array<{ properties: Record<string, unknown> }>;
    const atts = rec.get("atts") as Array<{ properties: Record<string, unknown> }>;
    const opps = rec.get("opps") as Array<{ properties: Record<string, unknown> }>;
    const nodes: Array<{ id: string; label: string; kind: string }> = [
      { id: u.id, label: u.displayName ?? "You", kind: "user" },
      ...skills.map((s) => ({
        id: String(s.properties.id),
        label: String(s.properties.name ?? "skill"),
        kind: "skill",
      })),
      ...atts.map((a) => ({
        id: String(a.properties.id),
        label: String(a.properties.name ?? "attestation"),
        kind: "attestation",
      })),
      ...opps.map((o) => ({
        id: String(o.properties.id),
        label: String(o.properties.title ?? "opportunity"),
        kind: "opportunity",
      })),
    ];
    const edges: Array<{ from: string; to: string; kind: string }> = [
      ...skills.map((s) => ({ from: u.id, to: String(s.properties.id), kind: "HAS_SKILL" })),
    ];
    return { nodes, edges };
  });
