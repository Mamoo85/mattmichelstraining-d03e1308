import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Dumbbell, Filter, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SectionHeader from "@/components/shared/SectionHeader";
import AiExerciseSubstitution from "@/components/workout/AiExerciseSubstitution";
import ExerciseVideoEmbed from "@/components/exercise/ExerciseVideoEmbed";

interface DbExercise {
  id: string;
  title: string;
  client_type: string[];
  focus_area: string[];
  equipment_needed: string;
  the_why: string;
  sport: string[];
  video_url: string | null;
  level: string;
  image_url: string | null;
}

const CLIENT_TYPES = ["Athlete", "Lifestyle Fitness"] as const;
const FOCUS_AREAS = ["Mobility", "Strength", "Core Stability", "Power", "Rehab", "Stability", "Posture", "Flexibility", "Speed", "Core", "Injury Prevention"] as const;
const LEVELS = ["beginner", "intermediate", "advanced"] as const;

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-600 dark:text-green-400",
  intermediate: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  advanced: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const ExerciseLibrary = () => {
  const [exercises, setExercises] = useState<DbExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeClientType, setActiveClientType] = useState<string | null>(null);
  const [activeFocusArea, setActiveFocusArea] = useState<string | null>(null);
  const [activeSport, setActiveSport] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [substitutionExercise, setSubstitutionExercise] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);

  useEffect(() => {
    const fetchExercises = async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("*")
        .order("title");
      if (!error && data) setExercises(data);
      setLoading(false);
    };
    fetchExercises();
  }, []);

  // Collect unique sports dynamically
  const allSports = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => e.sport?.forEach((s) => { if (s && s !== "All") set.add(s); }));
    return [...set].sort();
  }, [exercises]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch =
        !search ||
        ex.title.toLowerCase().includes(search.toLowerCase()) ||
        ex.the_why.toLowerCase().includes(search.toLowerCase());
      const matchesClient =
        !activeClientType || ex.client_type.includes(activeClientType);
      const matchesFocus =
        !activeFocusArea || ex.focus_area.includes(activeFocusArea);
      const matchesSport =
        !activeSport || ex.sport?.includes(activeSport) || ex.sport?.includes("All");
      const matchesLevel = !activeLevel || ex.level === activeLevel;
      return matchesSearch && matchesClient && matchesFocus && matchesSport && matchesLevel;
    });
  }, [exercises, search, activeClientType, activeFocusArea, activeSport, activeLevel]);

  const clearFilters = () => {
    setActiveClientType(null);
    setActiveFocusArea(null);
    setActiveSport(null);
    setActiveLevel(null);
    setSearch("");
  };

  const hasActiveFilters = !!activeClientType || !!activeFocusArea || !!activeSport || !!activeLevel || !!search;

  return (
    <div>
      <SectionHeader
        title="Exercise Library"
        timestamp={`${exercises.length} exercises · Built on 20 years of hands-on experience`}
      />

      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-4 mb-6">
        <p className="text-sm text-foreground text-balance leading-relaxed">
          Zero filler, zero &lsquo;bad&rsquo; exercises. Every entry details the{" "}
          <span className="text-primary font-bold">WHY</span> — the biomechanics
          and physics behind the movement.
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">
          — Matt Michels, M² Training
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={14}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises by title or description..."
          className="w-full bg-background border border-border pl-9 pr-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {/* Client Type filter */}
      <div className="mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
          <Filter size={10} className="inline mr-1" />
          Client Type
        </span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveClientType(null)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
              !activeClientType
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {CLIENT_TYPES.map((ct) => (
            <button
              key={ct}
              onClick={() =>
                setActiveClientType(activeClientType === ct ? null : ct)
              }
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeClientType === ct
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {ct}
            </button>
          ))}
        </div>
      </div>

      {/* Focus Area filter */}
      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
          <Filter size={10} className="inline mr-1" />
          Focus Area
        </span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveFocusArea(null)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
              !activeFocusArea
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {FOCUS_AREAS.map((fa) => (
            <button
              key={fa}
              onClick={() =>
                setActiveFocusArea(activeFocusArea === fa ? null : fa)
              }
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeFocusArea === fa
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {fa}
            </button>
          ))}
        </div>
      </div>

      {/* Level filter */}
      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
          <Filter size={10} className="inline mr-1" />
          Level
        </span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActiveLevel(null)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
              !activeLevel
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Levels
          </button>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setActiveLevel(activeLevel === lv ? null : lv)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeLevel === lv
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>
      {/* Sport filter */}
      {allSports.length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            <Filter size={10} className="inline mr-1" />
            Sport
          </span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setActiveSport(null)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                !activeSport
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Sports
            </button>
            {allSports.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSport(activeSport === s ? null : s)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeSport === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono text-muted-foreground">
          {filtered.length} exercise{filtered.length !== 1 ? "s" : ""} found
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[10px] text-primary font-bold hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <Dumbbell size={24} className="text-muted-foreground mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading exercises...</p>
        </div>
      ) : (
        /* Exercise cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((ex) => {
            const isExpanded = expandedId === ex.id;
            return (
              <div
                key={ex.id}
                className="bg-card shadow-m2 hover:bg-m2-surface-hover transition-all cursor-pointer flex flex-col"
                onClick={() => setExpandedId(isExpanded ? null : ex.id)}
              >
                <div className="p-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {ex.image_url && (
                      <img
                        src={ex.image_url}
                        alt={ex.title}
                        className="w-12 h-12 object-cover rounded border border-border flex-shrink-0"
                        loading="lazy"
                      />
                    )}
                  <div className="flex-1 min-w-0">
                    {/* Tags row */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {ex.level && (
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${LEVEL_COLORS[ex.level] || LEVEL_COLORS.intermediate}`}>
                          {ex.level}
                        </span>
                      )}
                      {ex.focus_area.map((fa) => (
                        <span
                          key={fa}
                          className="text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5"
                        >
                          {fa}
                        </span>
                       ))}
                       {ex.sport?.filter(Boolean).map((s) => (
                         <span
                           key={s}
                           className="text-[9px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-2 py-0.5"
                         >
                           {s}
                         </span>
                       ))}
                     </div>
                     <h3 className="text-sm font-bold text-foreground leading-tight">
                      {ex.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <Dumbbell size={10} className="inline mr-1" />
                      {ex.equipment_needed}
                    </p>
                    {/* Client type badges */}
                    <div className="flex gap-1 mt-2">
                      {ex.client_type.map((ct) => (
                        <span
                          key={ct}
                          className="text-[9px] font-mono uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5"
                        >
                          {ct}
                        </span>
                      ))}
                    </div>
                  </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {ex.image_url && (
                      <img
                        src={ex.image_url}
                        alt={ex.title}
                        className="w-full max-h-64 object-contain rounded border border-border bg-muted/30"
                        loading="lazy"
                      />
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
                        The WHY
                      </span>
                      <p className="text-xs text-foreground leading-relaxed mb-2 whitespace-pre-line break-words">
                        {ex.the_why}
                      </p>
                    </div>

                    {/* Video embed */}
                    <ExerciseVideoEmbed
                      videoUrl={ex.video_url}
                      exerciseTitle={ex.title}
                    />

                    <button
                      onClick={(e) => { e.stopPropagation(); setSubstitutionExercise(substitutionExercise === ex.title ? null : ex.title); }}
                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-m2"
                    >
                      <RefreshCw size={10} /> Find a Substitute
                    </button>
                    {substitutionExercise === ex.title && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <AiExerciseSubstitution
                          exerciseName={ex.title}
                          onClose={() => setSubstitutionExercise(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-full bg-card shadow-m2 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No exercises match your filters.
              </p>
              <button
                onClick={clearFilters}
                className="text-xs text-primary font-bold mt-2 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExerciseLibrary;
