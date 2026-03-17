import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Monitor, Filter } from "lucide-react";

const ATHLETE_AGE_RANGES = ["12-13", "14-15", "16-17", "18+"];
const LIFESTYLE_AGE_RANGES = ["18-29", "30-39", "40-49", "50+"];
const SEX_OPTIONS = ["Any", "Male", "Female"];
const SPORT_OPTIONS = ["Baseball", "Football", "Basketball", "Hockey", "Soccer", "Lacrosse", "Track & Field", "Swimming", "Tennis", "Volleyball"];

interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  category: string;
  age_range: string;
  sex: string;
  sport: string | null;
  price: number;
}

const InteractivePrograms = () => {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [category, setCategory] = useState<"Athlete" | "Lifestyle Fitness">("Athlete");
  const [ageRange, setAgeRange] = useState<string>("");
  const [sex, setSex] = useState<string>("");
  const [sport, setSport] = useState<string>("");

  useEffect(() => {
    supabase
      .from("training_programs")
      .select("id, title, description, category, age_range, sex, sport, price")
      .eq("is_active", true)
      .then(({ data }) => {
        setPrograms((data as TrainingProgram[]) || []);
        setLoading(false);
      });
  }, []);

  // Reset dependent filters when category changes
  useEffect(() => {
    setAgeRange("");
    setSport("");
  }, [category]);

  const ageRanges = category === "Athlete" ? ATHLETE_AGE_RANGES : LIFESTYLE_AGE_RANGES;

  const filtered = useMemo(() => {
    return programs.filter((p) => {
      if (p.category !== category) return false;
      if (ageRange && p.age_range !== ageRange) return false;
      if (sex && p.sex !== sex && p.sex !== "Any") return false;
      if (sport && p.sport !== sport) return false;
      return true;
    });
  }, [programs, category, ageRange, sex, sport]);

  const FilterButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Description */}
      <div className="bg-primary/10 border border-primary/20 p-4 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          Comprehensive, multi-week training systems loaded directly into your M² Client Portal. These connect to our full exercise library and include direct form-checks and messaging with Coach Matt. It's exactly like having me on the floor with you, just delivered to your phone.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Category */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">
            <Filter size={10} className="inline mr-1" />Category
          </span>
          <div className="flex gap-1 flex-wrap">
            <FilterButton active={category === "Athlete"} label="Athlete" onClick={() => setCategory("Athlete")} />
            <FilterButton active={category === "Lifestyle Fitness"} label="Lifestyle Fitness" onClick={() => setCategory("Lifestyle Fitness")} />
          </div>
        </div>

        {/* Age Range */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Age Range</span>
          <div className="flex gap-1 flex-wrap">
            <FilterButton active={ageRange === ""} label="All Ages" onClick={() => setAgeRange("")} />
            {ageRanges.map((a) => (
              <FilterButton key={a} active={ageRange === a} label={a} onClick={() => setAgeRange(a)} />
            ))}
          </div>
        </div>

        {/* Sex */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Sex</span>
          <div className="flex gap-1 flex-wrap">
            <FilterButton active={sex === ""} label="All" onClick={() => setSex("")} />
            {SEX_OPTIONS.map((s) => (
              <FilterButton key={s} active={sex === s} label={s} onClick={() => setSex(s)} />
            ))}
          </div>
        </div>

        {/* Sport (Athlete only) */}
        {category === "Athlete" && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Sport</span>
            <div className="flex gap-1 flex-wrap">
              <FilterButton active={sport === ""} label="All Sports" onClick={() => setSport("")} />
              {SPORT_OPTIONS.map((s) => (
                <FilterButton key={s} active={sport === s} label={s} onClick={() => setSport(s)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border p-8 text-center">
          <Monitor size={28} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-1">No programs yet for this filter</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Matt is building new interactive programs regularly. Check back soon or grab a PDF guide in the meantime.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((program) => (
            <div key={program.id} className="bg-card shadow-m2 p-4 flex flex-col hover:bg-accent/50 transition-m2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Interactive Program</span>
                <span className="text-lg font-mono font-bold text-primary">${program.price}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{program.title}</h3>
              <p className="text-[11px] text-muted-foreground mb-2 line-clamp-3">{program.description}</p>
              <div className="flex flex-wrap gap-1 mt-auto pt-2">
                {program.sport && (
                  <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-widest">
                    {program.sport}
                  </span>
                )}
                <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
                  {program.age_range}
                </span>
                <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 font-bold uppercase tracking-widest">
                  {program.sex}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InteractivePrograms;
