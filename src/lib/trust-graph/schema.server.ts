/**
 * Idempotent Neo4j schema bootstrap. Run once on first sync.
 */
import { withSession } from "./driver.server";

const STATEMENTS = [
  "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
  "CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (s:Skill) REQUIRE s.id IS UNIQUE",
  "CREATE CONSTRAINT opp_id IF NOT EXISTS FOR (o:Opportunity) REQUIRE o.id IS UNIQUE",
  "CREATE CONSTRAINT attestation_id IF NOT EXISTS FOR (a:Attestation) REQUIRE a.id IS UNIQUE",
  "CREATE CONSTRAINT place_code IF NOT EXISTS FOR (p:Place) REQUIRE p.code IS UNIQUE",
  "CREATE INDEX skill_name IF NOT EXISTS FOR (s:Skill) ON (s.name)",
  "CREATE INDEX opp_isco IF NOT EXISTS FOR (o:Opportunity) ON (o.isco)",
];

export async function ensureTrustGraphSchema() {
  return withSession(async (session) => {
    for (const stmt of STATEMENTS) {
      await session.run(stmt);
    }
    return { ok: true, applied: STATEMENTS.length };
  });
}
