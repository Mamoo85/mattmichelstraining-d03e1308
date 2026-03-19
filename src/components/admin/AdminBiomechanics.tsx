import { useState, lazy, Suspense, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Upload, CheckCircle, X, Eye, Camera, Image as ImageIcon,
  Plus, Trash2, Save, Users, Copy,
} from "lucide-react";
import { toast } from "sonner";

const SmartCamera = lazy(() => import("./SmartCamera"));

/* ─── Types ─── */
interface Exercise {
  name: string;
  sets: number;
  reps: string;
  intensity_percent?: string;
  tempo?: string;
  notes?: string;
}
interface Phase {
  phase_name: string;
  duration: string;
  focus: string;
  weekly_progression?: string[];
  exercises: Exercise[];
}
interface Program {
  title: string;
  phases: Phase[];
  _meta?: Record<string, any>;
}

/* ─── Constants ─── */
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Experienced", "Advanced"] as const;
const PROGRAM_DURATIONS = ["2-Week Rapid Corrective", "4-Week Volume Accumulation", "8-Week Full Mesocycle"] as const;
const PRIMARY_FOCUSES = ["Corrective/Mobility", "Hypertrophy", "Raw Strength", "Athletic Power"] as const;
const EQUIPMENT_OPTIONS = ["Full Gym", "Dumbbells/Kettlebells Only", "Bodyweight/Bands"] as const;

/* ─── Drag-and-drop upload zone ─── */
const DropZone = ({ disabled, onFiles }: { disabled: boolean; onFiles: (files: File[]) => void }) => {
  const [dragActive, setDragActive] = useState(false);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (files.length) onFiles(files);
    },
    [disabled, onFiles]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (disabled) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.multiple = true;
        input.onchange = () => { const f = Array.from(input.files || []); if (f.length) onFiles(f); };
        input.click();
      }}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
        ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Upload size={28} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center">
        Drag & drop images or video here, or <span className="text-primary underline">browse files</span>
      </p>
      <p className="text-xs text-muted-foreground">Front, side, and back profile shots or squat assessment video</p>
    </div>
  );
};

/* ─── Editable Exercise Row ─── */
const ExerciseRow = ({
  exercise, onChange, onRemove,
}: {
  exercise: Exercise;
  onChange: (updated: Exercise) => void;
  onRemove: () => void;
}) => (
  <div className="grid grid-cols-[1fr_60px_70px_70px_80px_1fr_32px] gap-1 items-center">
    <Input value={exercise.name} onChange={(e) => onChange({ ...exercise, name: e.target.value })} placeholder="Exercise" className="text-xs h-8" />
    <Input type="number" value={exercise.sets} onChange={(e) => onChange({ ...exercise, sets: Number(e.target.value) })} placeholder="Sets" className="text-xs h-8" />
    <Input value={exercise.reps} onChange={(e) => onChange({ ...exercise, reps: e.target.value })} placeholder="Reps" className="text-xs h-8" />
    <Input value={exercise.intensity_percent || ""} onChange={(e) => onChange({ ...exercise, intensity_percent: e.target.value })} placeholder="%" className="text-xs h-8" />
    <Input value={exercise.tempo || ""} onChange={(e) => onChange({ ...exercise, tempo: e.target.value })} placeholder="Tempo" className="text-xs h-8" />
    <Input value={exercise.notes || ""} onChange={(e) => onChange({ ...exercise, notes: e.target.value })} placeholder="Notes" className="text-xs h-8" />
    <Button variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-destructive"><Trash2 size={14} /></Button>
  </div>
);

/* ─── Editable Phase Accordion ─── */
const EditablePhase = ({
  phase, phaseIndex, onUpdate,
}: {
  phase: Phase;
  phaseIndex: number;
  onUpdate: (updated: Phase) => void;
}) => {
  const updateExercise = (exIdx: number, updated: Exercise) => {
    const exercises = [...phase.exercises];
    exercises[exIdx] = updated;
    onUpdate({ ...phase, exercises });
  };
  const removeExercise = (exIdx: number) => {
    onUpdate({ ...phase, exercises: phase.exercises.filter((_, i) => i !== exIdx) });
  };
  const addExercise = () => {
    onUpdate({
      ...phase,
      exercises: [...phase.exercises, { name: "", sets: 3, reps: "10", intensity_percent: "", tempo: "", notes: "" }],
    });
  };

  return (
    <AccordionItem value={`phase-${phaseIndex}`}>
      <AccordionTrigger className="text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0">{phase.duration}</Badge>
          <span className="font-bold uppercase tracking-widest">{phase.phase_name}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pt-2">
        <div className="flex gap-2">
          <Input
            value={phase.focus}
            onChange={(e) => onUpdate({ ...phase, focus: e.target.value })}
            placeholder="Phase focus"
            className="text-xs h-8"
          />
          <Input
            value={phase.duration}
            onChange={(e) => onUpdate({ ...phase, duration: e.target.value })}
            placeholder="Duration"
            className="text-xs h-8 w-32"
          />
        </div>
        {phase.weekly_progression?.length ? (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold">Weekly Progression:</p>
            {phase.weekly_progression.map((w, i) => <p key={i}>• {w}</p>)}
          </div>
        ) : null}
        <div className="hidden md:grid grid-cols-[1fr_60px_70px_70px_80px_1fr_32px] gap-1 text-[10px] font-bold uppercase text-muted-foreground">
          <span>Exercise</span><span>Sets</span><span>Reps</span><span>%</span><span>Tempo</span><span>Notes</span><span />
        </div>
        {phase.exercises.map((ex, i) => (
          <ExerciseRow key={i} exercise={ex} onChange={(u) => updateExercise(i, u)} onRemove={() => removeExercise(i)} />
        ))}
        <Button variant="outline" size="sm" onClick={addExercise} className="text-xs gap-1">
          <Plus size={12} /> Add Exercise
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
};

/* ─── Batch Assign Modal ─── */
const BatchAssignModal = ({
  open, onOpenChange, program, findings, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  program: Program;
  findings: string[];
  onConfirm: (selectedUserIds: string[], templateTitle: string) => void;
}) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [templateTitle, setTemplateTitle] = useState(program.title || "Master Template");
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-batch"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, athlete_name, email").order("full_name");
      return data ?? [];
    },
  });

  const toggleUser = (uid: string) => {
    setSelectedUsers((prev) => prev.includes(uid) ? prev.filter((u) => u !== uid) : [...prev, uid]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold uppercase tracking-widest">
            Save as Master Template & Batch Assign
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground">Template Title</label>
            <Input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} className="mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
              Select Clients ({selectedUsers.length} selected)
            </label>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-border rounded-md p-2">
              {profiles?.map((p) => (
                <label key={p.user_id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedUsers.includes(p.user_id)}
                    onCheckedChange={() => toggleUser(p.user_id)}
                  />
                  {p.athlete_name || p.full_name || p.email}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onConfirm(selectedUsers, templateTitle)}
            disabled={!selectedUsers.length || !templateTitle.trim()}
            className="gap-1"
          >
            <Users size={14} /> Assign to {selectedUsers.length} Client{selectedUsers.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Main Component ─── */
const AdminBiomechanics = () => {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Pre-generation controls
  const [experienceLevel, setExperienceLevel] = useState<string>("Intermediate");
  const [programDuration, setProgramDuration] = useState<string>("8-Week Full Mesocycle");
  const [primaryFocus, setPrimaryFocus] = useState<string>("Corrective/Mobility");
  const [equipment, setEquipment] = useState<string[]>(["Full Gym"]);

  // Editable program state per assessment
  const [editState, setEditState] = useState<Record<string, { findings: string[]; program: Program }>>({});
  const [batchModal, setBatchModal] = useState<{ open: boolean; assessmentId: string } | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-biomechanics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, athlete_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ["client-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_assessments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const getOrInitEdit = (a: any) => {
    if (editState[a.id]) return editState[a.id];
    const findings = Array.isArray(a.ai_findings) ? a.ai_findings : [];
    const program: Program = a.draft_program || { title: "", phases: [] };
    return { findings, program };
  };

  const updateEditState = (id: string, partial: Partial<{ findings: string[]; program: Program }>) => {
    setEditState((prev) => {
      const current = prev[id] || getOrInitEdit(assessments?.find((a: any) => a.id === id));
      return { ...prev, [id]: { ...current, ...partial } };
    });
  };

  const toggleEquipment = (val: string) => {
    setEquipment((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  };

  const handleUploadAndAnalyze = async (fileOrFiles: File | File[]) => {
    if (!selectedClient) { toast.error("Select a client first"); return; }
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (!files.length) return;

    try {
      setUploading(true);
      const mediaUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${selectedClient}/${Date.now()}-${file.name}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("biomechanics_media").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: signedData, error: signedError } = await supabase.storage
          .from("biomechanics_media").createSignedUrl(path, 3600);
        if (signedError) throw signedError;
        mediaUrls.push(signedData.signedUrl);
      }

      setUploading(false);
      setAnalyzing(true);

      const { data, error } = await supabase.functions.invoke("analyze-biomechanics", {
        body: {
          mediaUrl: mediaUrls[0],
          mediaUrls,
          clientUserId: selectedClient,
          experienceLevel,
          programDuration,
          primaryFocus,
          equipment,
        },
      });
      if (error) throw error;
      toast.success(`Scan complete — ${files.length} angle(s) processed`);
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    } catch (e: any) {
      toast.error(e.message || "Upload/analysis failed");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const state = getOrInitEdit(assessments?.find((a: any) => a.id === id));
      const { error } = await supabase
        .from("client_assessments")
        .update({ status: "approved", ai_findings: state.findings, draft_program: state.program as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment approved & assigned to client protocol");
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_assessments").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment rejected");
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const batchAssignMutation = useMutation({
    mutationFn: async ({ assessmentId, selectedUserIds, templateTitle }: { assessmentId: string; selectedUserIds: string[]; templateTitle: string }) => {
      const a = assessments?.find((a: any) => a.id === assessmentId);
      const state = getOrInitEdit(a);

      // Save as master template
      const { error: templateError } = await supabase.from("master_templates" as any).insert({
        title: templateTitle,
        experience_level: state.program._meta?.experienceLevel || experienceLevel,
        program_duration: state.program._meta?.programDuration || programDuration,
        primary_focus: state.program._meta?.primaryFocus || primaryFocus,
        equipment: state.program._meta?.equipment || equipment,
        ai_findings: state.findings,
        program: state.program as any,
        created_by: a?.admin_user_id,
      });
      if (templateError) throw templateError;

      // Batch create assessments for each selected user
      const inserts = selectedUserIds.map((uid) => ({
        client_user_id: uid,
        admin_user_id: a?.admin_user_id,
        media_url: a?.media_url || "",
        ai_findings: state.findings,
        draft_program: state.program as any,
        status: "approved",
      }));
      const { error: batchError } = await supabase.from("client_assessments").insert(inserts);
      if (batchError) throw batchError;
    },
    onSuccess: (_, vars) => {
      toast.success(`Template saved & assigned to ${vars.selectedUserIds.length} client(s)`);
      setBatchModal(null);
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getClientName = (userId: string) => {
    const p = profiles?.find((p) => p.user_id === userId);
    return p?.athlete_name || p?.full_name || p?.email || userId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      {/* Scanner Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            Biomechanics & Posture AI — God Mode Periodization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client selector */}
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger><SelectValue placeholder="Select target client..." /></SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.athlete_name || p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ─── Pre-Generation Control Panel ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-border">
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Experience Level</label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Program Duration</label>
              <Select value={programDuration} onValueChange={setProgramDuration}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROGRAM_DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Primary Focus</label>
              <Select value={primaryFocus} onValueChange={setPrimaryFocus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIMARY_FOCUSES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Equipment</label>
              <div className="flex flex-wrap gap-3">
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <label key={eq} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={equipment.includes(eq)} onCheckedChange={() => toggleEquipment(eq)} />
                    {eq}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DropZone disabled={!selectedClient || uploading || analyzing} onFiles={(files) => handleUploadAndAnalyze(files)} />

          <div className="flex justify-end">
            <Button variant="outline" disabled={!selectedClient || uploading || analyzing} onClick={() => setShowCamera(true)} className="gap-2">
              <Camera size={16} /> Smart Capture
            </Button>
          </div>

          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={16} />
              {uploading ? "Uploading media..." : "Scanning kinetic chain..."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessments List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest">Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAssessments ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
          ) : !assessments?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No assessments yet. Upload media above to start.</p>
          ) : (
            <div className="space-y-6">
              {assessments.map((a: any) => {
                const state = getOrInitEdit(a);
                const isEditing = !!editState[a.id];
                return (
                  <div key={a.id} className="border border-border rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{getClientName(a.client_user_id)}</span>
                        <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>
                          {a.status}
                        </Badge>
                        {a.draft_program?._meta && (
                          <Badge variant="outline" className="text-[10px]">
                            {a.draft_program._meta.experienceLevel} · {a.draft_program._meta.primaryFocus}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Split-screen */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
                      {/* Left: Media */}
                      <div className="p-4 flex flex-col items-center justify-center gap-3 bg-muted/10 min-h-[200px]">
                        {a.media_url ? (
                          a.media_url.match(/\.(mp4|webm|mov)/i) ? (
                            <video src={a.media_url} controls className="max-h-64 rounded" />
                          ) : (
                            <img src={a.media_url} alt="Assessment media" className="max-h-64 rounded object-contain" />
                          )
                        ) : (
                          <ImageIcon size={48} className="text-muted-foreground/30" />
                        )}
                        <a href={a.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
                          <Eye size={12} /> Open full size
                        </a>
                      </div>

                      {/* Right: Editable Findings + Program */}
                      <div className="p-4 space-y-4">
                        {/* Findings */}
                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Analysis Findings</p>
                          {a.status === "draft" ? (
                            <div className="space-y-1">
                              {state.findings.map((f: string, i: number) => (
                                <div key={i} className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <Input
                                    value={f}
                                    onChange={(e) => {
                                      const updated = [...state.findings];
                                      updated[i] = e.target.value;
                                      updateEditState(a.id, { findings: updated });
                                    }}
                                    className="text-xs h-7 flex-1"
                                  />
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                    updateEditState(a.id, { findings: state.findings.filter((_: string, idx: number) => idx !== i) });
                                  }}>
                                    <X size={10} />
                                  </Button>
                                </div>
                              ))}
                              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => {
                                updateEditState(a.id, { findings: [...state.findings, ""] });
                              }}>
                                <Plus size={10} /> Add finding
                              </Button>
                            </div>
                          ) : (
                            <ul className="list-disc list-inside text-xs space-y-0.5">
                              {state.findings.map((f: string, i: number) => <li key={i}>{f}</li>)}
                            </ul>
                          )}
                        </div>

                        {/* Program */}
                        {state.program?.phases?.length ? (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-xs font-bold uppercase text-muted-foreground">Corrective Protocol</p>
                              {a.status === "draft" && (
                                <Input
                                  value={state.program.title}
                                  onChange={(e) => updateEditState(a.id, { program: { ...state.program, title: e.target.value } })}
                                  className="text-xs h-7 max-w-[200px]"
                                />
                              )}
                              {a.status !== "draft" && <span className="text-xs font-semibold">{state.program.title}</span>}
                            </div>
                            {a.status === "draft" ? (
                              <Accordion type="multiple" className="w-full">
                                {state.program.phases.map((phase: Phase, pi: number) => (
                                  <EditablePhase
                                    key={pi}
                                    phase={phase}
                                    phaseIndex={pi}
                                    onUpdate={(updated) => {
                                      const phases = [...state.program.phases];
                                      phases[pi] = updated;
                                      updateEditState(a.id, { program: { ...state.program, phases } });
                                    }}
                                  />
                                ))}
                              </Accordion>
                            ) : (
                              <div className="space-y-3">
                                {state.program.phases.map((phase: Phase, pi: number) => (
                                  <div key={pi} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs shrink-0">{phase.duration}</Badge>
                                      <span className="text-xs font-bold uppercase tracking-widest">{phase.phase_name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{phase.focus}</p>
                                    <ul className="text-xs space-y-0.5 pl-4 list-disc">
                                      {phase.exercises.map((ex, ei) => (
                                        <li key={ei}>
                                          <span className="font-medium">{ex.name}</span> — {ex.sets}×{ex.reps}
                                          {ex.intensity_percent && ` @ ${ex.intensity_percent}`}
                                          {ex.tempo && ` (${ex.tempo})`}
                                          {ex.notes && <span className="text-muted-foreground"> — {ex.notes}</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {/* Actions */}
                        {a.status === "draft" && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(a.id)}
                              disabled={approveMutation.isPending}
                              className="text-xs gap-1 active:scale-95 transition-transform duration-100"
                            >
                              <CheckCircle size={14} /> Assign to Single Client
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setBatchModal({ open: true, assessmentId: a.id })}
                              className="text-xs gap-1"
                            >
                              <Copy size={14} /> Save as Template & Batch Assign
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(a.id)}
                              disabled={rejectMutation.isPending}
                              className="text-xs gap-1"
                            >
                              <X size={14} /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Assign Modal */}
      {batchModal?.open && (() => {
        const a = assessments?.find((a: any) => a.id === batchModal.assessmentId);
        if (!a) return null;
        const state = getOrInitEdit(a);
        return (
          <BatchAssignModal
            open={true}
            onOpenChange={(o) => { if (!o) setBatchModal(null); }}
            program={state.program}
            findings={state.findings}
            onConfirm={(selectedUserIds, templateTitle) => {
              batchAssignMutation.mutate({ assessmentId: batchModal.assessmentId, selectedUserIds, templateTitle });
            }}
          />
        );
      })()}

      {showCamera && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white" size={32} /></div>}>
          <SmartCamera
            onCapture={(files) => { setShowCamera(false); handleUploadAndAnalyze(files); }}
            onClose={() => setShowCamera(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AdminBiomechanics;
