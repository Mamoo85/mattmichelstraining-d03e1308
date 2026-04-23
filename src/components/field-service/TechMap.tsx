/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
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

const DEMO_LOCATIONS: TechLocation[] = [
  { tech_id: "t1", tech_name: "Mike Johnson",  lat: 42.3152, lng: -83.1544, recorded_at: new Date(Date.now() - 4  * 60000).toISOString() },
  { tech_id: "t2", tech_name: "Tony Radke",    lat: 42.2506, lng: -83.1473, recorded_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { tech_id: "t3", tech_name: "Dan Kowalski",  lat: 42.3557, lng: -83.1767, recorded_at: new Date(Date.now() - 7  * 60000).toISOString() },
  { tech_id: "t4", tech_name: "Chris Oller",   lat: 42.5014, lng: -83.0144, recorded_at: new Date(Date.now() - 2  * 60000).toISOString() },
];

export default function TechMap({ clientId }: TechMapProps) {
  const isDemo = clientId === "demo";
  const [locations, setLocations] = useState<TechLocation[]>(isDemo ? DEMO_LOCATIONS : []);
  const [loading, setLoading] = useState(!isDemo);
  const [mapsApiKey, setMapsApiKey] = useState("");

  // Fetch API key from edge function (skip for demo)
  useEffect(() => {
    if (isDemo) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-maps-key");
        if (!error && data?.key) setMapsApiKey(data.key);
      } catch {}
    })();
  }, [isDemo]);

  const fetchLocations = useCallback(async () => {
    if (isDemo) return; // demo data already set in initial state
    try {
      const { data: locs, error: locErr } = await (supabase
        .from("tech_locations") as any)
        .select("tech_name, lat, lng, updated_at")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false });

      if (locErr) throw locErr;

      // Dedupe by tech_name keeping the most recent
      const seen = new Set<string>();
      const merged: TechLocation[] = [];
      for (const row of (locs || []) as Array<{ tech_name: string; lat: number; lng: number; updated_at: string }>) {
        if (!row.tech_name || row.lat == null || row.lng == null) continue;
        if (seen.has(row.tech_name)) continue;
        seen.add(row.tech_name);
        merged.push({
          tech_id: row.tech_name,
          tech_name: row.tech_name,
          lat: Number(row.lat),
          lng: Number(row.lng),
          recorded_at: row.updated_at,
        });
      }

      setLocations(merged);
    } catch (err) {
      console.error("TechMap fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId, isDemo]);

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
          <p className="text-white font-semibold text-lg mb-2">Map loading...</p>
          <p className="text-gray-400 text-sm">If this persists, the Maps API key may not be configured.</p>
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