import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Heart, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SectionHeader from "./SectionHeader";
import ExerciseVideoEmbed from "./exercise/ExerciseVideoEmbed";

interface FixItExercise {
  id: string;
  title: string;
  the_why: string;
  equipment_needed: string;
  focus_area: string[];
  fix_it_protocol: string[];
  video_url: string | null;
}

const PROTOCOLS = ["ACL Prevention", "Rotator Cuff", "Back Pain / McGill Big 3", "Concussion Return-to-Play", "Ankle Stability", "Hip Mobility"] as const;

const FixItLibrary = () => {
  const [exercises, setExercises] = useState<FixItExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeProtocol, setActiveProtocol] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("id, title, the_why, equipment_needed, focus_area, fix_it_protocol, video_url")
        .eq("is_fix_it", true)
        .order("title");
      if (!error && data) setExercises(data as FixItExercise[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch = !search || ex.title.toLowerCase().includes(search.toLowerCase()) || ex.the_why.toLowerCase().includes(search.toLowerCase());
      const matchesProtocol = !activeProtocol || ex.fix_it_protocol?.includes(activeProtocol);
      return matchesSearch && matchesProtocol;
    });
  }, [exercises, search, activeProtocol]);

  return (
    <div>
      <SectionHeader title="Fix It Library" timestamp={`${exercises.length} rehab exercises`} />

      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-4 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          Targeted rehab and prehab protocols. Each exercise includes the <span className="text-primary font-bold">WHY</span> — so you understand the science behind your recovery.
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels, M² Training</span>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rehab exercises..."
          className="w-full bg-background border border-border pl-9 pr-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
          <Filter size={10} className="inline mr-1" />Protocol
        </span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveProtocol(null)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${!activeProtocol ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            All
          </button>
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              onClick={() => setActiveProtocol(activeProtocol === p ? null : p)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${activeProtocol === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] font-mono text-muted-foreground mb-3">
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""} found
      </p>

      {loading ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <Heart size={24} className="text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading rehab exercises...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((ex) => {
            const isExpanded = expandedId === ex.id;
            return (
              <div key={ex.id} className="bg-card shadow-m2 hover:bg-m2-surface-hover transition-all cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : ex.id)}>
                <div className="p-4 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {ex.fix_it_protocol?.map((p) => (
                        <span key={p} className="text-[9px] font-bold uppercase tracking-widest bg-destructive/15 text-destructive px-2 py-0.5">{p}</span>
                      ))}
                      {ex.focus_area?.map((fa) => (
                        <span key={fa} className="text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5">{fa}</span>
                      ))}
                    </div>
                    <h3 className="text-sm font-bold text-foreground leading-tight">{ex.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <Heart size={10} className="inline mr-1" />{ex.equipment_needed}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronDown size={16} className="text-muted-foreground flex-shrink-0 mt-1" />}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">The WHY</span>
                    <p className="text-xs text-foreground leading-relaxed">{ex.the_why}</p>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="col-span-full bg-card shadow-m2 p-8 text-center">
              <p className="text-sm text-muted-foreground">No rehab exercises match your filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FixItLibrary;
