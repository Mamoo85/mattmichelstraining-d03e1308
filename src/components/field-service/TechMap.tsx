import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TechMapProps {
  clientId: string;
}

interface TechLocation {
  tech_id: string;
  tech_name: string;
  lat: number;
  lng: number;
  recorded_at: string;
}

export default function TechMap({ clientId }: TechMapProps) {
  const [locations, setLocations] = useState<TechLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const mapsApiKey = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env.VITE_GOOGLE_MAPS_API_KEY ?? "";

  const fetchLocations = useCallback(async () => {
    try {
      const { data: techs, error: techError } = await supabase
        .from("field_service_techs" as any)
        .select("id, name")
        .eq("client_id", clientId)
        .eq("active", true);

      if (techError) throw techError;
      if (!techs || techs.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      const techIds = techs.map((t) => t.id);

      const locationPromises = techIds.map((techId) =>
        supabase
          .from("tech_locations")
          .select("tech_id, lat, lng, recorded_at")
          .eq("tech_id", techId)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      );

      const results = await Promise.all(locationPromises);

      const merged: TechLocation[] = [];
      results.forEach((res, idx) => {
        if (res.data && techs[idx]) {
          merged.push({
            tech_id: res.data.tech_id,
            tech_name: techs[idx].name,
            lat: res.data.lat,
            lng: res.data.lng,
            recorded_at: res.data.recorded_at,
          });
        }
      });

      setLocations(merged);
    } catch (err) {
      console.error("TechMap fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 60_000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading map...</p>
      </div>
    );
  }

  if (!mapsApiKey) {
    return (
      <div className="px-4 py-6">
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-white font-semibold text-lg mb-2">Map requires Google Maps API key</p>
          <p className="text-gray-400 text-sm">Set VITE_GOOGLE_MAPS_API_KEY in your environment to enable the live tech map.</p>
        </div>
        {locations.length > 0 && <TechList locations={locations} formatRelativeTime={formatRelativeTime} />}
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="px-4 py-6">
        <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">📍</div>
          <p className="text-white font-semibold text-lg mb-2">No tech locations available</p>
          <p className="text-gray-400 text-sm">Locations will appear here once techs start checking in.</p>
        </div>
      </div>
    );
  }

  // Build Google Maps embed URL with markers
  const center = `${locations[0].lat},${locations[0].lng}`;
  const markers = locations
    .map((loc) => `markers=color:blue%7Clabel:${encodeURIComponent(loc.tech_name[0])}%7C${loc.lat},${loc.lng}`)
    .join("&");
  const mapSrc = `https://www.google.com/maps/embed/v1/view?key=${mapsApiKey}&center=${center}&zoom=11&${markers}`;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-2xl overflow-hidden border border-[#1e3a5f]">
        <iframe
          title="Tech Locations Map"
          src={mapSrc}
          width="100%"
          height="400"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <TechList locations={locations} formatRelativeTime={formatRelativeTime} />
    </div>
  );
}

function TechList({
  locations,
  formatRelativeTime,
}: {
  locations: TechLocation[];
  formatRelativeTime: (iso: string) => string;
}) {
  return (
    <div className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide mb-3">Tech Last Ping</p>
      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.tech_id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00d4ff]/20 border border-[#00d4ff]/40 flex items-center justify-center text-[#00d4ff] text-xs font-bold">
                {loc.tech_name[0].toUpperCase()}
              </div>
              <span className="text-white text-sm font-medium">{loc.tech_name}</span>
            </div>
            <span className="text-gray-400 text-xs">{formatRelativeTime(loc.recorded_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
