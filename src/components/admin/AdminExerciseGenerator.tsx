import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, Upload, Trash2, Dumbbell, ChevronDown, ChevronUp, Plus,
  Target, Zap, BookOpen, AlertTriangle, ArrowUp, ArrowDown, Trophy, Clock,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import SectionHeader from "@/components/SectionHeader";

interface GeneratedExercise {
  title: string;
  the_why: string;
  focus_area: string[];
  equipment_needed: string;
  level: string;
  coaching_cues: string[];
  common_mistakes: string[];
  progressions: string[];
  regressions: string[];
  sport_transfer: string[];
  sets_reps_guidance: string;
  tempo_recommendation?: string;
  video_search_term?: string;
  coaching_reference: string;
  is_fix_it: boolean;
  fix_it_protocol: string[];
  client_type: string[];
  sport: string[];
}

const CATEGORIES = [
  "Strength", "Power", "Conditioning", "Mobility / Corrective",
  "Core / Stability", "Plyometrics", "Carries", "Olympic Lifting",
];
const EQUIPMENT = [
  "Full Gym", "Barbell + Rack", "Dumbbells/Kettlebells Only",
  "Bodyweight Only", "Resistance Bands", "Minimal (DB + Band)",
  "Specialty (Landmine, TRX, Sled)", "Lacrosse Ball / Foam Roller",
];
const LEVELS = ["beginner", "intermediate", "advanced"];
const AGE_GROUPS = ["Youth (11-13)", "Youth (14-17)", "Adult", "Senior", "All Ages"];
const MOVEMENT_PATTERNS = [
  "All", "Squat Pattern", "Hinge Pattern", "Push (Horizontal)",
  "Push (Vertical)", "Pull (Horizontal)", "Pull (Vertical)",
  "Carry / Loaded Movement", "Rotation / Anti-Rotation", "Single Leg",
  "Explosive / Power", "Ground-Based",
];
const FOCUS_OPTIONS = [
  "Posterior Chain", "Anterior Chain", "Upper Body Push", "Upper Body Pull",
  "Hip Mobility", "Thoracic Spine", "Ankle Mobility", "Shoulder Stability",
  "Core Anti-Extension", "Core Anti-Rotation", "Grip Strength", "Glute Activation",
  "Hamstring Flexibility", "Quad Dominant", "Lat / Back", "Rotator Cuff",
];
const FIX_IT_PROTOCOLS = [
  "Squat Prep", "Deadlift Prep", "Overhead Prep", "Hip Mobility",
  "Ankle Mobility", "T-Spine Mobility", "Shoulder Rehab", "Soft Tissue & Recovery",
  "Low Back / McGill", "Knee Stability", "Anterior Chain Lengthening",
];
const SPORTS = [
  "Football", "Hockey", "Basketball", "Baseball/Softball", "Soccer",
  "Lacrosse", "Wrestling", "Track & Field", "Swimming", "Tennis",
  "Volleyball", "Golf", "General Athletics",
];
const CREATIVITY_LEVELS = [
  { value: "standard", label: "Standard", desc: "Classic SS/BASL movements" },
  { value: "high", label: "Creative", desc: "Unique variations, novel loading" },
  { value: "experimental", label: "Experimental", desc: "Hybrid movements, unconventional" },
];
const COACHING_DETAIL = [
  { value: "brief", label: "Brief", desc: "1-line descriptions" },
  { value: "standard", label: "Standard", desc: "2-3 sentence coaching" },
  { value: "detailed", label: "Detailed", desc: "Full biomechanical breakdown" },
];

const REF_COLORS: Record<string, string> = {
  "Starting Strength": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "Becoming a Supple Leopard": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "McGill": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "Coach Matt": "bg-primary/10 text-primary border-primary/30",
};

const AdminExerciseGenerator = () => {
  const [quantity, setQuantity] = useState(5);
  const [category, setCategory] = useState("Strength");
  const [equipment, setEquipment] = useState("Full Gym");
  const [level, setLevel] = useState("intermediate");
  const [ageGroup, setAgeGroup] = useState("Adult");
  const [movementPattern, setMovementPattern] = useState("All");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [sport, setSport] = useState("");
  const [coachingDetail, setCoachingDetail] = useState("detailed");
  const [creativityLevel, setCreativityLevel] = useState("high");
  const [isFixIt, setIsFixIt] = useState(false);
  const [fixItProtocol, setFixItProtocol] = useState("");
  const [includeProgressions, setIncludeProgressions] = useState(true);
  const [includeRegressions, setIncludeRegressions] = useState(true);
  const [includeCommonMistakes, setIncludeCommonMistakes] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);

  const toggleFocus = (f: string) => {
    setFocusAreas((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setExercises([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-exercises", {
        body: {
          quantity,
          category: category.toLowerCase(),
          equipment,
          level,
          focusAreas,
          movementPattern: movementPattern.toLowerCase(),
          coachingDetail,
          creativityLevel,
          sport: sport || undefined,
          ageGroup,
          includeProgressions,
          includeRegressions,
          includeCommonMistakes,
          isFixIt,
          fixItProtocol: fixItProtocol || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setExercises(data.exercises || []);
      toast({ title: `${data.exercises?.length || 0} exercises generated`, description: "Review before publishing to the library." });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (exercises.length === 0) return;
    setPublishing(true);
    try {
      const rows = exercises.map((ex) => ({
        title: ex.title,
        the_why: ex.the_why,
        focus_area: ex.focus_area,
        equipment_needed: ex.equipment_needed,
        level: ex.level,
        is_fix_it: ex.is_fix_it,
        fix_it_protocol: ex.fix_it_protocol || [],
        client_type: ex.client_type || [],
        sport: ex.sport || [],
      }));

      const { error } = await supabase.from("exercise_library").insert(rows);
      if (error) throw error;

      toast({ title: `${exercises.length} exercises published to library!` });
      setExercises([]);
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const updateExercise = (index: number, field: keyof GeneratedExercise, value: any) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex)));
  };

  const removeExercise = (index: number) => setExercises((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Exercise Generator" />

      {/* Config Controls */}
      <div className="bg-card border border-border p-5 space-y-5">
        {/* Row 1: Quantity + Category + Level */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
              Quantity: {quantity} exercise{quantity > 1 ? "s" : ""}
            </label>
            <Slider min={1} max={20} step={1} value={[quantity]} onValueChange={([v]) => setQuantity(v)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              <Dumbbell size={10} className="inline mr-1" /> Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Experience Level
            </label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Equipment + Age Group + Movement Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Equipment
            </label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Age Group
            </label>
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AGE_GROUPS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Movement Pattern
            </label>
            <Select value={movementPattern} onValueChange={setMovementPattern}>
              <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_PATTERNS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Focus Areas */}
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
            <Target size={10} className="inline mr-1" /> Focus Areas (optional)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFocus(f)}
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  focusAreas.includes(f)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Fix-It Mode Toggle */}
        <div className="flex items-center gap-4 bg-secondary/30 border border-border p-3">
          <Switch checked={isFixIt} onCheckedChange={setIsFixIt} />
          <div>
            <Label className="text-xs font-bold uppercase tracking-widest">Fix-It / Corrective Mode</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Generate mobility, prehab, and corrective exercises (BASL / McGill)</p>
          </div>
          {isFixIt && (
            <Select value={fixItProtocol} onValueChange={setFixItProtocol}>
              <SelectTrigger className="bg-background border-border max-w-[200px] text-xs"><SelectValue placeholder="Protocol..." /></SelectTrigger>
              <SelectContent>
                {FIX_IT_PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Advanced Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-border pt-4">
            {/* Creativity + Coaching Detail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                  <Zap size={10} className="inline mr-1" /> Creativity Level
                </label>
                <div className="space-y-1.5">
                  {CREATIVITY_LEVELS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCreativityLevel(c.value)}
                      className={`w-full text-left px-3 py-2 border text-xs transition-all ${
                        creativityLevel === c.value
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="font-bold">{c.label}</span>
                      <span className="text-[10px] ml-2 opacity-75">— {c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                  Coaching Detail
                </label>
                <div className="space-y-1.5">
                  {COACHING_DETAIL.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCoachingDetail(c.value)}
                      className={`w-full text-left px-3 py-2 border text-xs transition-all ${
                        coachingDetail === c.value
                          ? "bg-primary/10 border-primary text-foreground"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      <span className="font-bold">{c.label}</span>
                      <span className="text-[10px] ml-2 opacity-75">— {c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sport + Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  <Trophy size={10} className="inline mr-1" /> Sport Context (optional)
                </label>
                <Select value={sport} onValueChange={setSport}>
                  <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Any sport..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Any Sport</SelectItem>
                    {SPORTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                  Include in Output
                </label>
                <div className="flex items-center gap-3">
                  <Switch checked={includeProgressions} onCheckedChange={setIncludeProgressions} />
                  <span className="text-xs text-muted-foreground">Progressions</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={includeRegressions} onCheckedChange={setIncludeRegressions} />
                  <span className="text-xs text-muted-foreground">Regressions</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={includeCommonMistakes} onCheckedChange={setIncludeCommonMistakes} />
                  <span className="text-xs text-muted-foreground">Common Mistakes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? `Generating ${quantity} exercises…` : "Generate Exercises"}
        </button>
      </div>

      {/* Review Section */}
      {exercises.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SectionHeader title={`Review ${exercises.length} Exercises`} />
            <div className="flex items-center gap-2 flex-wrap">
              {[...new Set(exercises.map((e) => e.coaching_reference))].map((ref) => (
                <Badge key={ref} variant="outline" className={REF_COLORS[ref] || ""}>
                  📖 {ref} ({exercises.filter((e) => e.coaching_reference === ref).length})
                </Badge>
              ))}
            </div>
          </div>

          <Accordion type="multiple" className="space-y-2">
            {exercises.map((exercise, idx) => (
              <AccordionItem
                key={idx}
                value={`exercise-${idx}`}
                className="border border-border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <Dumbbell size={16} className="text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{exercise.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {exercise.level} • {exercise.equipment_needed} • {exercise.focus_area.join(", ")}
                      </p>
                    </div>
                    <Badge variant="outline" className={REF_COLORS[exercise.coaching_reference] || ""}>
                      <span className="text-[9px]">{exercise.coaching_reference}</span>
                    </Badge>
                    {exercise.is_fix_it && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">
                        Fix-It
                      </Badge>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeExercise(idx); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0 pb-4 space-y-4">
                  {/* Title + Level + Equipment */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Title</label>
                      <Input value={exercise.title} onChange={(e) => updateExercise(idx, "title", e.target.value)} className="bg-background" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Level</label>
                      <Select value={exercise.level} onValueChange={(v) => updateExercise(idx, "level", v)}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Equipment</label>
                      <Input value={exercise.equipment_needed} onChange={(e) => updateExercise(idx, "equipment_needed", e.target.value)} className="bg-background" />
                    </div>
                  </div>

                  {/* The Why */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                      <BookOpen size={10} /> Matt's Why
                    </label>
                    <Textarea
                      value={exercise.the_why}
                      onChange={(e) => updateExercise(idx, "the_why", e.target.value)}
                      rows={3}
                      className="bg-background text-xs"
                    />
                  </div>

                  {/* Sets/Reps Guidance + Tempo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock size={10} /> Sets/Reps Guidance
                      </label>
                      <Input value={exercise.sets_reps_guidance} onChange={(e) => updateExercise(idx, "sets_reps_guidance", e.target.value)} className="bg-background text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Tempo</label>
                      <Input value={exercise.tempo_recommendation || ""} onChange={(e) => updateExercise(idx, "tempo_recommendation", e.target.value)} className="bg-background text-xs" placeholder="e.g., 3-1-2-0" />
                    </div>
                  </div>

                  {/* Coaching Cues */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                      🎯 Coaching Cues
                    </label>
                    <div className="space-y-1">
                      {exercise.coaching_cues.map((cue, cIdx) => (
                        <div key={cIdx} className="flex items-start gap-2">
                          <span className="text-[10px] text-primary font-bold mt-1.5 shrink-0">{cIdx + 1}.</span>
                          <Input
                            value={cue}
                            onChange={(e) => {
                              const updated = [...exercise.coaching_cues];
                              updated[cIdx] = e.target.value;
                              updateExercise(idx, "coaching_cues", updated);
                            }}
                            className="bg-background text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Common Mistakes */}
                  {exercise.common_mistakes.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                        <AlertTriangle size={10} className="text-amber-400" /> Common Mistakes
                      </label>
                      <div className="space-y-1">
                        {exercise.common_mistakes.map((mistake, mIdx) => (
                          <div key={mIdx} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 px-2.5 py-1.5">
                            <span className="text-[10px] text-amber-400 font-bold mt-0.5 shrink-0">⚠</span>
                            <Input
                              value={mistake}
                              onChange={(e) => {
                                const updated = [...exercise.common_mistakes];
                                updated[mIdx] = e.target.value;
                                updateExercise(idx, "common_mistakes", updated);
                              }}
                              className="bg-transparent border-none text-xs h-auto p-0 focus-visible:ring-0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progressions + Regressions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {exercise.progressions.length > 0 && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                          <ArrowUp size={10} className="text-red-400" /> Progressions
                        </label>
                        <div className="space-y-1">
                          {exercise.progressions.map((prog, pIdx) => (
                            <div key={pIdx} className="bg-red-500/5 border border-red-500/20 px-2.5 py-1.5 text-xs text-foreground">
                              {prog}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {exercise.regressions.length > 0 && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                          <ArrowDown size={10} className="text-emerald-400" /> Regressions
                        </label>
                        <div className="space-y-1">
                          {exercise.regressions.map((reg, rIdx) => (
                            <div key={rIdx} className="bg-emerald-500/5 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-foreground">
                              {reg}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sport Transfer */}
                  {exercise.sport_transfer.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Trophy size={10} className="text-primary" /> Sport Transfer
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {exercise.sport_transfer.map((s, sIdx) => (
                          <Badge key={sIdx} variant="outline" className="text-[9px]">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Focus Area Tags */}
                  <div className="flex flex-wrap gap-1">
                    {exercise.focus_area.map((f, fIdx) => (
                      <Badge key={fIdx} variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px]">{f}</Badge>
                    ))}
                    {exercise.fix_it_protocol.map((p, pIdx) => (
                      <Badge key={`fix-${pIdx}`} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">🔧 {p}</Badge>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Publish */}
          <div className="bg-secondary/50 border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {exercises.length} exercise{exercises.length !== 1 ? "s" : ""} with coaching cues, progressions, and references ready to publish.
            </p>
            <button
              onClick={handlePublish}
              disabled={publishing || exercises.length === 0}
              className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Publish to Exercise Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExerciseGenerator;
