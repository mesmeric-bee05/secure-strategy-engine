import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MLMap, Popup, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { coordsFor, distanceKm, type LatLngT } from "@/lib/geo";
import type { OpportunityCardDTO } from "@/server/opportunities.functions";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export interface OpportunitiesMapProps {
  opportunities: OpportunityCardDTO[];
  userLocation?: LatLngT | null;
  /** Filter opportunities to those within this radius of `userLocation` (km). */
  radiusKm?: number;
  className?: string;
}

interface FeatureProps {
  id: string;
  title: string;
  employer: string;
  location: string;
  match: number;
}

export function OpportunitiesMap({
  opportunities,
  userLocation = null,
  radiusKm = 500,
  className,
}: OpportunitiesMapProps) {
  const mapRef = useRef<MLMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  const features = useMemo(() => {
    const fc: GeoJSON.FeatureCollection<GeoJSON.Point, FeatureProps> = {
      type: "FeatureCollection",
      features: [],
    };
    for (const o of opportunities) {
      const c = coordsFor({ location: o.location, country_code: o.country_code });
      if (!c) continue;
      if (userLocation && distanceKm(userLocation, c) > radiusKm) continue;
      fc.features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
        properties: {
          id: o.id,
          title: o.title,
          employer: o.employer ?? "—",
          location: o.location ?? o.country_code ?? "—",
          match: o.match_pct ?? 0,
        },
      });
    }
    return fc;
  }, [opportunities, userLocation, radiusKm]);

  // Init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [25, 0], // Africa-centric
      zoom: 2.4,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("opps", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 8,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "opps",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#E8A838",
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 20, 20, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0A1020",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "opps",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 11,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#0A1020" },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "opps",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#2DD4BF",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0A1020",
        },
      });

      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const p = f.properties as FeatureProps;
        new Popup({ offset: 10, closeButton: true })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px;color:#0A1020">
              <strong>${escapeHtml(p.title)}</strong><br/>
              <span style="opacity:.7">${escapeHtml(p.employer)} · ${escapeHtml(p.location)}</span><br/>
              <span style="color:#085041;font-weight:600">Match ${p.match}%</span>
            </div>`,
          )
          .addTo(map);
      });
      map.on("mouseenter", "unclustered", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered", () => (map.getCanvas().style.cursor = ""));

      setReady(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Push features whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("opps") as GeoJSONSource | undefined;
    if (src) src.setData(features);
  }, [features, ready]);

  // Recentre on user location.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !userLocation) return;
    map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 5.5, speed: 1.2 });
  }, [userLocation, ready]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Opportunities map"
      className={className ?? "h-[520px] w-full overflow-hidden rounded-xl border border-border-soft"}
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
