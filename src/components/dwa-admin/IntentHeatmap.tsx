import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AccountPoint {
  account_key: string;
  company_name: string | null;
  score: number;
  tier: string | null;
  lat: number;
  lng: number;
  vertical: string | null;
}

interface Props {
  onSelectAccount?: (accountKey: string, companyName: string) => void;
}

// Free OSM tiles via MapLibre demo style — no key required.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export default function IntentHeatmap({ onSelectAccount }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [points, setPoints] = useState<AccountPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("v_latest_intent_scores" as any)
        .select("account_key, company_name, score, tier, lat, lng, vertical")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("score", 30)
        .order("score", { ascending: false })
        .limit(2000);
      if (cancelled) return;
      if (error) {
        console.error("[IntentHeatmap] load failed", error);
        setErr(error.message);
      } else {
        setPoints((data as any) || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_URL,
      center: [-83.05, 42.35], // Detroit
      zoom: 7,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;

    const apply = () => {
      const features = points.map((p) => ({
        type: "Feature" as const,
        properties: {
          account_key: p.account_key,
          company_name: p.company_name || "Unknown",
          score: Number(p.score) || 0,
          tier: p.tier || "cool",
          vertical: p.vertical || "",
        },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      }));
      const geojson = { type: "FeatureCollection" as const, features };

      if (map.getSource("intent")) {
        (map.getSource("intent") as maplibregl.GeoJSONSource).setData(geojson as any);
        return;
      }
      map.addSource("intent", { type: "geojson", data: geojson as any });

      map.addLayer({
        id: "intent-heat",
        type: "heatmap",
        source: "intent",
        maxzoom: 12,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "score"], 0, 0, 100, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 12, 3],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,212,255,0)",
            0.2, "rgba(0,212,255,0.4)",
            0.5, "rgba(255,200,0,0.7)",
            0.8, "rgba(255,80,0,0.85)",
            1, "rgba(255,30,30,0.95)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 12, 40],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 9, 1, 12, 0.3],
        },
      });

      map.addLayer({
        id: "intent-points",
        type: "circle",
        source: "intent",
        minzoom: 8,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 4, 100, 14],
          "circle-color": [
            "case",
            [">=", ["get", "score"], 80], "#ff3030",
            [">=", ["get", "score"], 65], "#ff8800",
            [">=", ["get", "score"], 50], "#ffd000",
            "#00d4ff",
          ],
          "circle-stroke-color": "#0a1628",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9,
        },
      });

      map.on("click", "intent-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props: any = f.properties;
        new maplibregl.Popup({ offset: 12 })
          .setLngLat((f.geometry as any).coordinates)
          .setHTML(
            `<div style="font-family:system-ui;color:#0a1628">
              <div style="font-weight:700">${props.company_name}</div>
              <div style="font-size:11px;opacity:.7">${props.vertical || ""}</div>
              <div style="margin-top:4px"><b>Score:</b> ${Math.round(props.score)} · ${props.tier}</div>
              <button id="open-narr-${props.account_key}" style="margin-top:6px;padding:4px 8px;background:#00d4ff;border:0;border-radius:4px;font-weight:700;cursor:pointer">Open narrative →</button>
            </div>`
          )
          .addTo(map);
        setTimeout(() => {
          const btn = document.getElementById(`open-narr-${props.account_key}`);
          btn?.addEventListener("click", () => onSelectAccount?.(props.account_key, props.company_name));
        }, 0);
      });
      map.on("mouseenter", "intent-points", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "intent-points", () => { map.getCanvas().style.cursor = ""; });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [points, onSelectAccount]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/50 flex items-center justify-between">
        <span>
          🗺️ Heatmap of <span className="text-white font-bold">{points.length}</span> scored accounts (score ≥ 30).
          Zoom in for individual pins. Click a pin to open the narrative.
        </span>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-[#00d4ff]" />}
      </div>
      {err && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">Map load error: {err}</div>}
      <div ref={mapContainer} className="w-full h-[520px] rounded-lg overflow-hidden border border-white/10 bg-[#0a1628]" />
      {!loading && points.length === 0 && !err && (
        <div className="text-white/40 text-xs text-center p-3">
          No geocoded scored accounts yet. Run the geocoding cron (<code className="text-[#00d4ff]">geocode-signals-batch</code>) and intent score recompute to populate the map.
        </div>
      )}
    </div>
  );
}
