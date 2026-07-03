import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  PHASES,
  STACK,
  FEATURES,
  SECURITY,
  STATS,
} from "@/lib/dashboard-content";

/**
 * Structural contract for the /dashboard content. If the dashboard route
 * ever drifts from the doc (missing tab data, empty group, malformed
 * status), this test fails BEFORE the e2e run.
 */

const Status = z.enum(["shipped", "in-progress", "planned"]);

const PhaseSchema = z.object({
  num: z.number().int().positive(),
  tone: z.enum(["blue", "teal", "purple", "amber", "coral", "green"]),
  title: z.string().min(3),
  time: z.string().min(3),
  status: Status,
  tasks: z.array(z.object({ label: z.string().min(1), detail: z.string().min(1) })).min(3),
});

const StackSchema = z.object({
  category: z.string().min(2),
  tone: z.enum(["blue", "teal", "purple", "amber", "coral", "green"]),
  items: z.array(z.object({ name: z.string().min(1), why: z.string().min(1) })).min(3),
});

const FeatureSchema = z.object({
  num: z.number().int().positive(),
  title: z.string().min(3),
  desc: z.string().min(5),
  route: z.string().startsWith("/").optional(),
  status: Status,
});

const SecuritySchema = z.object({
  letter: z.string().length(1),
  tone: z.enum(["red", "amber", "blue", "teal", "purple"]),
  title: z.string().min(3),
  desc: z.string().min(5),
  status: Status,
});

const StatSchema = z.object({
  label: z.string().min(2),
  value: z.string().min(1),
  tone: z.enum(["gold", "teal", "coral", "lavender"]),
});

describe("dashboard content contract", () => {
  it("PHASES: at least 6, all valid, monotonic numbering", () => {
    expect(PHASES.length).toBeGreaterThanOrEqual(6);
    for (const [i, p] of PHASES.entries()) {
      expect(() => PhaseSchema.parse(p)).not.toThrow();
      expect(p.num).toBe(i + 1);
    }
  });

  it("STACK: at least 4 categories with items", () => {
    expect(STACK.length).toBeGreaterThanOrEqual(4);
    for (const cat of STACK) expect(() => StackSchema.parse(cat)).not.toThrow();
  });

  it("FEATURES: at least 6, unique numbers", () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(6);
    const nums = new Set(FEATURES.map((f) => f.num));
    expect(nums.size).toBe(FEATURES.length);
    for (const f of FEATURES) expect(() => FeatureSchema.parse(f)).not.toThrow();
  });

  it("SECURITY: at least 6 checks", () => {
    expect(SECURITY.length).toBeGreaterThanOrEqual(6);
    for (const s of SECURITY) expect(() => SecuritySchema.parse(s)).not.toThrow();
  });

  it("STATS: exactly 4 stat tiles", () => {
    expect(STATS.length).toBe(4);
    for (const s of STATS) expect(() => StatSchema.parse(s)).not.toThrow();
  });
});
