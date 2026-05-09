import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateExtractSkills, validateExplain, sniffImageMime, BadRequest } from "./validation.ts";

// Tiny 1x1 PNG (89 50 4E 47 0D 0A 1A 0A then IHDR...)
const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const JPEG_1x1 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEz/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwE//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwE//8QAFBABAQAAAAAAAAAAAAAAAAAAAAH/2gAIAQEAAT8h/9k=";

Deno.test("sniffImageMime detects PNG", () => {
  const bin = atob(PNG_1x1);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  assertEquals(sniffImageMime(u), "image/png");
});

Deno.test("validateExtractSkills accepts valid text", () => {
  const out = validateExtractSkills({ text: "I weave baskets" });
  assertEquals(out.text, "I weave baskets");
  assertEquals(out.image, null);
});

Deno.test("validateExtractSkills rejects empty input", () => {
  assertThrows(() => validateExtractSkills({}), BadRequest);
});

Deno.test("validateExtractSkills rejects mime mismatch", () => {
  assertThrows(
    () => validateExtractSkills({ imageBase64: PNG_1x1, mimeType: "image/jpeg" }),
    BadRequest,
  );
});

Deno.test("validateExtractSkills accepts matching PNG", () => {
  const out = validateExtractSkills({ imageBase64: PNG_1x1, mimeType: "image/png" });
  assertEquals(out.image?.mime, "image/png");
});

Deno.test("validateExtractSkills rejects oversized text", () => {
  assertThrows(() => validateExtractSkills({ text: "x".repeat(8_001) }), BadRequest);
});

Deno.test("validateExplain accepts a complete payload", () => {
  const out = validateExplain({
    opportunity: { title: "Tailor", required_skills: ["sewing"] },
    personaSummary: "Has 3 years tailoring experience.",
  });
  assertEquals(out.opportunity.title, "Tailor");
});

Deno.test("validateExplain rejects empty persona", () => {
  assertThrows(
    () => validateExplain({ opportunity: { title: "x" }, personaSummary: "" }),
    BadRequest,
  );
});

Deno.test("validateExplain rejects oversized required_skills", () => {
  assertThrows(
    () => validateExplain({
      opportunity: { title: "x", required_skills: new Array(60).fill("s") },
      personaSummary: "ok",
    }),
    BadRequest,
  );
});
