import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Lead = {
  id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  signal_type: string;
  score: number;
};

declare global {
  interface Window {
    google?: any;
    __mrMapsLoading?: Promise<void>;
  }
}

function loadGoogleMaps(key: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__mrMapsLoading) return window.__mrMapsLoading;
  window.__mrMapsLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=marker`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Maps failed to load"));
    document.head.appendChild(s);
  });
  return window.__mrMapsLoading;
}

const scoreColor = (s: number) =>
  s >= 9 ? "#00d4ff" : s >= 7 ? "#fbbf24" : "#64748b";

export default function MortgageRadarMap({ leads }: { leads: Lead[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("get-maps-key");
        const key = data?.key;
        if (!key) throw new Error("Map key unavailable");
        await loadGoogleMaps(key);
        if (cancelled || !mapRef.current) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 42.3314, lng: -83.0458 }, // Detroit
          zoom: 10,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0a1628" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#030711" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#030711" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
          ],
          disableDefaultUI: true,
          zoomControl: true,
        });

        const geocoder = new window.google.maps.Geocoder();
        const bounds = new window.google.maps.LatLngBounds();
        const infoWindow = new window.google.maps.InfoWindow();
        let plotted = 0;

        // Geocode in batches to respect rate limits — top 30 only
        const targets = leads.filter(l => l.address).slice(0, 30);
        for (const lead of targets) {
          if (cancelled) return;
          await new Promise<void>((resolve) => {
            geocoder.geocode(
              { address: `${lead.address}, ${lead.city || ""} ${lead.zip || ""}` },
              (results: any, status: string) => {
                if (status === "OK" && results?.[0]) {
                  const pos = results[0].geometry.location;
                  const marker = new window.google.maps.Marker({
                    position: pos,
                    map,
                    title: lead.address || "",
                    icon: {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: lead.score >= 9 ? 12 : 8,
                      fillColor: scoreColor(lead.score),
                      fillOpacity: 0.9,
                      strokeColor: "#030711",
                      strokeWeight: 2,
                    },
                  });
                  marker.addListener("click", () => {
                    infoWindow.setContent(
                      `<div style="color:#0a1628;min-width:180px;padding:4px">
                        <div style="font-weight:800;font-size:13px">${lead.full_name || "Lead"}</div>
                        <div style="font-size:12px;margin-top:2px">${lead.address || ""}</div>
                        <div style="font-size:11px;color:#475569;margin-top:4px">${lead.signal_type.replace(/_/g, " ")} · Score ${lead.score}/10</div>
                      </div>`
                    );
                    infoWindow.open({ anchor: marker, map });
                  });
                  bounds.extend(pos);
                  plotted++;
                }
                resolve();
              }
            );
          });
          // small delay to avoid OVER_QUERY_LIMIT
          await new Promise((r) => setTimeout(r, 80));
        }

        if (plotted > 0) map.fitBounds(bounds);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Map unavailable");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leads]);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#030711]/60 backdrop-blur-sm rounded-lg">
          <p className="text-[#94a3b8] text-sm">Plotting leads on map…</p>
        </div>
      )}
      {error && (
        <div className="bg-[#0a1628] border border-red-900 rounded-lg p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      <div
        ref={mapRef}
        className="w-full h-[500px] rounded-lg border border-[#1e3a5f] bg-[#0a1628]"
      />
      <div className="flex gap-4 mt-3 text-xs text-[#94a3b8] flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#00d4ff]" /> Hot (9–10)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#fbbf24]" /> Warm (7–8)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#64748b]" /> Cool (&lt;7)</span>
        <span className="ml-auto text-[#64748b]">Top 30 by score plotted</span>
      </div>
    </div>
  );
}
