import { describe, expect, it } from "vitest";
import {
  LatLng,
  bboxAround,
  coordsFor,
  distanceKm,
  withinRadiusKm,
} from "@/lib/geo";

describe("geo", () => {
  it("rejects out-of-range coordinates", () => {
    expect(() => LatLng.parse({ lat: 100, lng: 0 })).toThrow();
    expect(() => LatLng.parse({ lat: 0, lng: -181 })).toThrow();
    expect(LatLng.parse({ lat: -1.29, lng: 36.82 }).lat).toBeCloseTo(-1.29);
  });

  it("computes haversine distance between Nairobi and Mombasa within 10km of truth", () => {
    const nairobi = { lat: -1.2921, lng: 36.8219 };
    const mombasa = { lat: -4.0435, lng: 39.6682 };
    // True ~440km; allow tolerance.
    const d = distanceKm(nairobi, mombasa);
    expect(d).toBeGreaterThan(430);
    expect(d).toBeLessThan(450);
  });

  it("withinRadiusKm respects the threshold", () => {
    const a = { lat: 0, lng: 0 };
    const close = { lat: 0.01, lng: 0.01 };
    const far = { lat: 5, lng: 5 };
    expect(withinRadiusKm(a, close, 5)).toBe(true);
    expect(withinRadiusKm(a, far, 5)).toBe(false);
  });

  it("coordsFor falls back to country centroid when city is unknown", () => {
    expect(coordsFor({ location: "Westlands, Nairobi", country_code: "KE" })).toEqual({
      lat: -1.2921,
      lng: 36.8219,
    });
    expect(coordsFor({ location: "Some unknown town", country_code: "GH" })).toEqual({
      lat: 5.6037,
      lng: -0.187,
    });
    expect(coordsFor({ location: null, country_code: null })).toBeNull();
  });

  it("bboxAround produces a box that contains the centre", () => {
    const c = { lat: -1.29, lng: 36.82 };
    const box = bboxAround(c, 10);
    expect(c.lat).toBeGreaterThanOrEqual(box.minLat);
    expect(c.lat).toBeLessThanOrEqual(box.maxLat);
    expect(c.lng).toBeGreaterThanOrEqual(box.minLng);
    expect(c.lng).toBeLessThanOrEqual(box.maxLng);
  });
});
