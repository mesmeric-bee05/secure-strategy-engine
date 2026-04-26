import { describe, it, expect } from "vitest";

import {
  bandFor,
  bandLabel,
  composeSkillRisks,
  compositeRisk,
  curatedAdjacent,
  projectionDelta,
  recommendAdjacent,
  type FreyOsborneRow,
  RISK_BAND_DURABLE_MAX,
  RISK_BAND_MODERATE_MAX,
} from "@/lib/readiness";

describe("bandFor", () => {
  it("classifies sub-threshold as durable", () => {
    expect(bandFor(0)).toBe("durable");
    expect(bandFor(0.34999)).toBe("durable");
  });
  it("classifies the moderate band exclusively", () => {
    expect(bandFor(RISK_BAND_DURABLE_MAX)).toBe("moderate");
    expect(bandFor(0.5)).toBe("moderate");
    expect(bandFor(0.59999)).toBe("moderate");
  });
  it("classifies exposed at and above the moderate ceiling", () => {
    expect(bandFor(RISK_BAND_MODERATE_MAX)).toBe("exposed");
    expect(bandFor(0.95)).toBe("exposed");
    expect(bandFor(1)).toBe("exposed");
  });
  it("bandLabel returns a non-empty string for every band", () => {
    expect(bandLabel("durable")).toMatch(/Durable/);
    expect(bandLabel("moderate")).toMatch(/Moderate/);
    expect(bandLabel("exposed")).toMatch(/upskill/i);
  });
});

describe("composeSkillRisks", () => {
  const fo: FreyOsborneRow[] = [
    { isco_code: "7531", automation_probability: 0.5 },
    { isco_code: "1439", automation_probability: 0.1 },
  ];
  const skills = [
    { skill_name: "Tailoring", isco_code: "7531", proficiency_level: 9 },
    { skill_name: "Mgmt", isco_code: "1439", proficiency_level: 6 },
    { skill_name: "Mystery", isco_code: "9999", proficiency_level: 4 },
  ];

  it("applies the LMIC calibration multiplier", () => {
    const out = composeSkillRisks(skills, fo, 0.8);
    expect(out[0].rawProbability).toBe(0.5);
    expect(out[0].calibratedProbability).toBeCloseTo(0.4, 6);
    expect(out[1].calibratedProbability).toBeCloseTo(0.08, 6);
  });

  it("clamps calibrated values to [0,1]", () => {
    const high: FreyOsborneRow[] = [
      { isco_code: "7531", automation_probability: 0.9 },
    ];
    const out = composeSkillRisks(skills.slice(0, 1), high, 1.5);
    // 0.9 * 1.2 (clamped from 1.5) = 1.08 → clamped to 1
    expect(out[0].calibratedProbability).toBe(1);
  });

  it("flags missing FO rows as hasData:false instead of dropping", () => {
    const out = composeSkillRisks(skills, fo, 0.8);
    const mystery = out.find((r) => r.iscoCode === "9999")!;
    expect(mystery.hasData).toBe(false);
    expect(mystery.calibratedProbability).toBeNull();
    expect(mystery.band).toBeNull();
  });

  it("preserves input order", () => {
    const out = composeSkillRisks(skills, fo, 0.8);
    expect(out.map((r) => r.iscoCode)).toEqual(["7531", "1439", "9999"]);
  });
});

describe("compositeRisk", () => {
  const fo: FreyOsborneRow[] = [
    { isco_code: "7531", automation_probability: 0.5 },
    { isco_code: "1439", automation_probability: 0.1 },
  ];

  it("returns null when there is no usable data", () => {
    const out = composeSkillRisks([], fo, 1);
    expect(compositeRisk(out)).toBeNull();
  });

  it("weights by proficiency", () => {
    const skills = [
      { skill_name: "A", isco_code: "7531", proficiency_level: 10 },
      { skill_name: "B", isco_code: "1439", proficiency_level: 1 },
    ];
    const out = composeSkillRisks(skills, fo, 1);
    // (10*0.5 + 1*0.1) / 11 ≈ 0.4636
    expect(compositeRisk(out)).toBeCloseTo(0.4636, 3);
  });

  it("ignores skills without FO data when computing composite", () => {
    const skills = [
      { skill_name: "A", isco_code: "7531", proficiency_level: 5 },
      { skill_name: "Mystery", isco_code: "9999", proficiency_level: 10 },
    ];
    const out = composeSkillRisks(skills, fo, 1);
    expect(compositeRisk(out)).toBeCloseTo(0.5, 6);
  });

  it("survives a profile of one durable skill", () => {
    const skills = [
      { skill_name: "Mgmt", isco_code: "1439", proficiency_level: 7 },
    ];
    const out = composeSkillRisks(skills, fo, 1);
    const c = compositeRisk(out);
    expect(c).toBeCloseTo(0.1, 6);
    expect(bandFor(c!)).toBe("durable");
  });
});

describe("projectionDelta", () => {
  it("returns null with fewer than two rows", () => {
    expect(projectionDelta([])).toBeNull();
    expect(
      projectionDelta([
        { year: 2025, primary_pct: 30, secondary_pct: 50, tertiary_pct: 20 },
      ])
    ).toBeNull();
  });

  it("computes pp deltas between earliest and latest years", () => {
    const out = projectionDelta([
      { year: 2025, primary_pct: 40, secondary_pct: 40, tertiary_pct: 20 },
      { year: 2030, primary_pct: 35, secondary_pct: 45, tertiary_pct: 25 },
      { year: 2035, primary_pct: 30, secondary_pct: 45, tertiary_pct: 28 },
    ]);
    expect(out).toEqual({
      startYear: 2025,
      endYear: 2035,
      primaryPP: -10,
      secondaryPP: 5,
      tertiaryPP: 8,
    });
  });

  it("treats nulls as 0 delta safely", () => {
    const out = projectionDelta([
      { year: 2025, primary_pct: 30, secondary_pct: null, tertiary_pct: 20 },
      { year: 2035, primary_pct: 25, secondary_pct: 50, tertiary_pct: null },
    ]);
    expect(out!.primaryPP).toBe(-5);
    expect(out!.secondaryPP).toBe(0);
    expect(out!.tertiaryPP).toBe(0);
  });
});

describe("recommendAdjacent", () => {
  it("filters out skills the user already has", () => {
    const pool = curatedAdjacent();
    const have = new Set(pool.slice(0, 2).map((p) => p.isco_code));
    const out = recommendAdjacent(
      Array.from(have).map((isco) => ({
        skillName: "x",
        iscoCode: isco,
        proficiency: 5,
        rawProbability: null,
        calibratedProbability: null,
        band: null,
        hasData: false,
      })),
      pool,
      pool.length
    );
    expect(out.every((r) => !have.has(r.isco_code))).toBe(true);
    expect(out.length).toBe(pool.length - have.size);
  });

  it("orders by descending resilience_score", () => {
    const pool = [
      { name: "low", isco_code: "0001", rationale: "", resilience_score: 0.4 },
      { name: "hi", isco_code: "0002", rationale: "", resilience_score: 0.9 },
      { name: "mid", isco_code: "0003", rationale: "", resilience_score: 0.7 },
    ];
    const out = recommendAdjacent([], pool, 3);
    expect(out.map((r) => r.name)).toEqual(["hi", "mid", "low"]);
  });

  it("respects topN", () => {
    const pool = curatedAdjacent();
    const out = recommendAdjacent([], pool, 2);
    expect(out.length).toBe(2);
  });
});
