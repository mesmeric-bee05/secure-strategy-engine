/**
 * Pure geo helpers — no DOM dependencies, safe for SSR + tests.
 */
import { z } from "zod";

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLngT = z.infer<typeof LatLng>;

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres between two points (haversine). */
export function distanceKm(a: LatLngT, b: LatLngT): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function withinRadiusKm(origin: LatLngT, point: LatLngT, radiusKm: number): boolean {
  return distanceKm(origin, point) <= radiusKm;
}

/** City → approximate centroid (used as a deterministic stand-in for opportunity coordinates). */
export const CITY_COORDS: Record<string, LatLngT> = {
  Nairobi: { lat: -1.2921, lng: 36.8219 },
  Mombasa: { lat: -4.0435, lng: 39.6682 },
  Kisumu: { lat: -0.0917, lng: 34.768 },
  Accra: { lat: 5.6037, lng: -0.187 },
  Kumasi: { lat: 6.6885, lng: -1.6244 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  Johannesburg: { lat: -26.2041, lng: 28.0473 },
  "Cape Town": { lat: -33.9249, lng: 18.4241 },
  Kigali: { lat: -1.9579, lng: 30.1127 },
  Remote: { lat: 0, lng: 20 },
};

/** Country fallback centroid (used when location isn't a known city). */
export const COUNTRY_COORDS: Record<string, LatLngT> = {
  KE: { lat: -1.2921, lng: 36.8219 },
  GH: { lat: 5.6037, lng: -0.187 },
  NG: { lat: 9.082, lng: 8.6753 },
  ZA: { lat: -30.5595, lng: 22.9375 },
  RW: { lat: -1.9403, lng: 29.8739 },
};

/** Best-effort coordinate lookup for an opportunity. */
export function coordsFor(input: {
  location?: string | null;
  country_code?: string | null;
}): LatLngT | null {
  if (input.location) {
    // exact city match first, then prefix
    if (CITY_COORDS[input.location]) return CITY_COORDS[input.location];
    const key = Object.keys(CITY_COORDS).find((c) => input.location!.includes(c));
    if (key) return CITY_COORDS[key];
  }
  if (input.country_code && COUNTRY_COORDS[input.country_code]) {
    return COUNTRY_COORDS[input.country_code];
  }
  return null;
}

/** Bounding box around a centre with the given radius in km. */
export function bboxAround(centre: LatLngT, radiusKm: number) {
  const dLat = radiusKm / 111; // ~111 km per degree latitude
  const dLng = radiusKm / (111 * Math.cos((centre.lat * Math.PI) / 180) || 1);
  return {
    minLat: centre.lat - dLat,
    maxLat: centre.lat + dLat,
    minLng: centre.lng - dLng,
    maxLng: centre.lng + dLng,
  };
}
