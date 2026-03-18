import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Camera, Loader2, Check, X, ScanLine, ChevronDown, ChevronUp, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ScannedSet {
  set: number;
  reps: number;
  weight: number;
}

interface ScannedExercise {
  name: string;
  matchedTitle: string;
  matchedId: string | null;
  sets: ScannedSet[];
}

interface ScanResult {
  exercises: ScannedExercise[];
  notes: string;
}

const WorkoutScanner = ({ onSaved }: { onSaved?: () => void }) => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setScanning(true);
    setResult(null);
    setModalOpen(true);

    try {
      // Convert to base64
      const base64 = await fileToBase64(file);

      // Fetch exercise library for matching
      const { data: exercises } = await supabase
        .from("exercise_library")
        .select("id, title")
        .order("title");

      const { data, error } = await supabase.functions.invoke("scan-workout", {
        body: {
          imageBase64: base64,
          exerciseLibrary: exercises || [],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const scanResult = data?.result as ScanResult;
      if (!scanResult?.exercises?.length) {
        toast({
          title: "No exercises found",
          description: scanResult?.notes || "Try a clearer photo of the workout card.",
          variant: "destructive",
        });
        setResult(null);
      } else {
        setResult(scanResult);
        // Expand all by default
        setExpanded(new Set(scanResult.exercises.map((_, i) => i)));
        toast({ title: `Found ${scanResult.exercises.length} exercises!` });
      }
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
      // Reset input
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // strip data:image/...;base64,
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const removeExercise = (idx: number) => {
    if (!result) return;
    setResult({
      ...result,
      exercises: result.exercises.filter((_, i) => i !== idx),
    });
  };

  const updateSet = (exIdx: number, setIdx: number, field: "reps" | "weight", value: number) => {
    if (!result) return;
    const updated = { ...result };
    updated.exercises = [...updated.exercises];
    updated.exercises[exIdx] = { ...updated.exercises[exIdx] };
    updated.exercises[exIdx].sets = [...updated.exercises[exIdx].sets];
    updated.exercises[exIdx].sets[setIdx] = {
      ...updated.exercises[exIdx].sets[setIdx],
      [field]: value,
    };
    setResult(updated);
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleConfirmSave = async () => {
    if (!user || !result || result.exercises.length === 0) return;
    setSaving(true);

    try {
      // Create workout log
      const { data: log, error: logErr } = await supabase
        .from("workout_logs")
        .insert({
          user_id: user.id,
          date: new Date().toISOString(),
          session_notes: result.notes || "Scanned from workout card",
        } as any)
        .select("id")
        .single();

      if (logErr || !log) throw new Error(logErr?.message || "Failed to create workout log");

      // Build logged_exercises rows
      const rows = result.exercises
        .filter((ex) => ex.matchedId) // only save exercises we matched
        .map((ex) => ({
          log_id: log.id,
          exercise_id: ex.matchedId!,
          sets_reps_weight: ex.sets as any,
          client_notes: `Scanned: ${ex.name}`,
          flag_for_coach: false,
        }));

      if (rows.length > 0) {
        const { error: exErr } = await supabase.from("logged_exercises").insert(rows);
        if (exErr) throw new Error(exErr.message);
      }

      // Also log progress for matched exercises (for stagnation tracking)
      for (const ex of result.exercises) {
        if (!ex.matchedId || !ex.sets.length) continue;
        const maxSet = ex.sets.reduce((best, s) => (s.weight > best.weight ? s : best), ex.sets[0]);
        if (maxSet.weight > 0) {
          await supabase.from("progress_logs").insert({
            user_id: user.id,
            exercise_name: ex.matchedTitle || ex.name,
            weight: maxSet.weight,
            reps: maxSet.reps,
          });
        }
      }

      const matched = result.exercises.filter((e) => e.matchedId).length;
      const unmatched = result.exercises.length - matched;
      toast({
        title: "Workout saved! 💪",
        description: `${matched} exercise${matched !== 1 ? "s" : ""} logged.${unmatched > 0 ? ` ${unmatched} unmatched exercise${unmatched !== 1 ? "s" : ""} skipped.` : ""}`,
      });

      // Points awarded automatically via server-side trigger

      setResult(null);
      setPreview(null);
      setModalOpen(false);
      onSaved?.();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all"
      >
        <ScanLine size={14} />
        Scan Workout Card
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {/* Review Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v && !scanning) { setModalOpen(false); setResult(null); setPreview(null); } }}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <ScanLine size={16} className="text-primary" />
              {scanning ? "Scanning…" : result ? "Review Scanned Workout" : "Scan Workout Card"}
            </DialogTitle>
          </DialogHeader>

          {/* Image Preview */}
          {preview && (
            <div className="rounded overflow-hidden border border-border max-h-40">
              <img src={preview} alt="Workout card" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Loading */}
          {scanning && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Reading your workout card…</p>
              <p className="text-[10px] text-muted-foreground">Matching exercises to M² library</p>
            </div>
          )}

          {/* Results */}
          {result && !scanning && (
            <div className="space-y-3">
              {result.notes && (
                <p className="text-[11px] text-muted-foreground italic bg-muted p-2">{result.notes}</p>
              )}

              {result.exercises.map((ex, i) => (
                <div key={i} className={`border ${ex.matchedId ? "border-border" : "border-amber-500/50"} bg-background`}>
                  <button
                    onClick={() => toggleExpand(i)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {ex.matchedId ? (
                        <Check size={12} className="text-green-500 shrink-0" />
                      ) : (
                        <X size={12} className="text-amber-500 shrink-0" />
                      )}
                      <div className="text-left min-w-0">
                        <span className="text-xs font-bold text-foreground block truncate">
                          {ex.matchedId ? ex.matchedTitle : ex.name}
                        </span>
                        {ex.matchedId && ex.name !== ex.matchedTitle && (
                          <span className="text-[9px] text-muted-foreground block truncate">
                            Card: "{ex.name}"
                          </span>
                        )}
                        {!ex.matchedId && (
                          <span className="text-[9px] text-amber-500">No match — will be skipped</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {ex.sets.length} set{ex.sets.length !== 1 ? "s" : ""}
                      </span>
                      {expanded.has(i) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  </button>

                  {expanded.has(i) && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {ex.sets.map((s, si) => (
                        <div key={si} className="flex items-center gap-2 text-xs">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-8">
                            Set {s.set}
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={s.reps || ""}
                              onChange={(e) => updateSet(i, si, "reps", parseInt(e.target.value) || 0)}
                              className="w-14 bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground text-center focus:ring-1 focus:ring-primary outline-none"
                              style={{ fontSize: "16px" }}
                            />
                            <span className="text-muted-foreground text-[10px]">reps</span>
                          </div>
                          <span className="text-muted-foreground">×</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={s.weight || ""}
                              onChange={(e) => updateSet(i, si, "weight", parseInt(e.target.value) || 0)}
                              className="w-16 bg-muted border border-border px-2 py-1 text-xs font-mono text-foreground text-center focus:ring-1 focus:ring-primary outline-none"
                              style={{ fontSize: "16px" }}
                            />
                            <span className="text-muted-foreground text-[10px]">lbs</span>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => removeExercise(i)}
                        className="flex items-center gap-1 text-[10px] text-destructive hover:underline mt-1"
                      >
                        <Trash2 size={10} /> Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setModalOpen(false); setResult(null); setPreview(null); }}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving || result.exercises.filter((e) => e.matchedId).length === 0}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Confirm & Save
                </button>
              </div>

              {result.exercises.filter((e) => !e.matchedId).length > 0 && (
                <p className="text-[9px] text-amber-500 text-center">
                  {result.exercises.filter((e) => !e.matchedId).length} unmatched exercise(s) will be skipped
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkoutScanner;
