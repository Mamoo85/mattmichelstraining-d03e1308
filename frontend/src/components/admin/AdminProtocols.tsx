import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Save, Gift, Edit3, Upload, X, ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AiAssistButton from "./AiAssistButton";
import GiftProtocolModal from "./GiftProtocolModal";
import AddExerciseModal from "./AddExerciseModal";

const AdminProtocols = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [giftProtocol, setGiftProtocol] = useState<{ id: string; title: string } | null>(null);
  const [addExerciseTo, setAddExerciseTo] = useState<{ id: string; count: number } | null>(null);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [exForm, setExForm] = useState<Record<string, any>>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  // Flags query
  const { data: flags = [] } = useQuery({
    queryKey: ["admin-protocol-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocol_exercise_flags")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: protocols = [], isLoading } = useQuery({
    queryKey: ["admin-protocols"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocols")
        .select("*")
        .eq("is_template", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ["admin-protocol-exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("protocol_exercises")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-protocols"] });
    queryClient.invalidateQueries({ queryKey: ["admin-protocol-exercises"] });
    queryClient.invalidateQueries({ queryKey: ["admin-protocol-flags"] });
  }, [queryClient]);

  const createProtocol = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("protocols").insert({
        title: newTitle,
        description: newDesc || null,
        is_template: true,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Protocol template created" });
      setNewTitle("");
      setNewDesc("");
      setShowCreate(false);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateProtocol = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string }) => {
      const { error } = await supabase.from("protocols").update({ title, description: description || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Protocol updated" });
      setEditingId(null);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const toggleDefault = useMutation({
    mutationFn: async ({ id, is_default }: { id: string; is_default: boolean }) => {
      if (is_default) {
        await supabase.from("protocols").update({ is_default: false }).eq("is_template", true);
      }
      const { error } = await supabase.from("protocols").update({ is_default }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Default protocol updated" });
    },
  });

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("protocol_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Exercise removed" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateExercise = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("protocol_exercises").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Exercise updated" });
      setEditingExercise(null);
      setExForm({});
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const respondToFlag = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { data: flag, error: fetchErr } = await supabase
        .from("protocol_exercise_flags")
        .select("user_id")
        .eq("id", id)
        .single();
      if (fetchErr) throw fetchErr;

      const { error } = await supabase
        .from("protocol_exercise_flags")
        .update({ admin_response: response, status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Notify user
      if (flag) {
        await supabase.from("notifications").insert({
          user_id: flag.user_id,
          type: "flag_response",
          title: "Coach Matt Responded",
          body: response.substring(0, 150),
          link: "/dashboard",
        });
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Response sent" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const handleImageUpload = async (exerciseId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5 MB", variant: "destructive" });
      return;
    }
    setUploadingImage(exerciseId);
    try {
      const ext = file.name.split(".").pop();
      const path = `${exerciseId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("exercise_reference_images")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("exercise_reference_images")
        .getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("protocol_exercises")
        .update({ image_url: urlData.publicUrl })
        .eq("id", exerciseId);
      if (updateErr) throw updateErr;

      invalidateAll();
      toast({ title: "Reference image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploadingImage(null);
  };

  const getExercises = (protocolId: string) =>
    exercises.filter((e) => e.protocol_id === protocolId);

  const startEditExercise = (ex: any) => {
    setEditingExercise(ex.id);
    setExForm({
      exercise_name: ex.exercise_name,
      sets: ex.sets,
      reps: ex.reps,
      rpe: ex.rpe,
      notes: ex.notes || "",
      coach_notes: ex.coach_notes || "",
    });
  };

  return (
    <div className="space-y-4">
      {/* Flagged Questions */}
      {flags.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-destructive">
            {flags.length} Open Question{flags.length !== 1 ? "s" : ""} from Athletes
          </p>
          {flags.slice(0, 5).map((flag) => (
            <FlagResponseCard key={flag.id} flag={flag} onRespond={(id, text) => respondToFlag.mutate({ id, response: text })} />
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Templates</p>
          <p className="text-2xl font-mono font-bold text-foreground">{protocols.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Default</p>
          <p className="text-sm font-bold text-primary truncate">
            {protocols.find((p) => p.is_default)?.title || "None set"}
          </p>
        </div>
      </div>

      {/* Create new */}
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="w-full bg-muted px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-m2 flex items-center justify-center gap-1.5"
      >
        <Plus size={12} /> Create Protocol Template
      </button>

      {showCreate && (
        <div className="bg-card shadow-m2 p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Title</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              placeholder="e.g. Beginner Hockey Program"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20"
              placeholder="Optional description..."
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createProtocol.mutate()}
              disabled={!newTitle.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50"
            >
              Create Template
            </button>
            {newTitle.trim() && (
              <AiAssistButton
                type="protocol"
                context={{ title: newTitle, description: newDesc }}
                onResult={(text) => {
                  try {
                    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
                    const exs = JSON.parse(cleaned);
                    if (Array.isArray(exs)) {
                      (async () => {
                        const { data: proto, error } = await supabase.from("protocols").insert({
                          title: newTitle, description: newDesc || null, is_template: true, is_default: false,
                        }).select("id").single();
                        if (error || !proto) { toast({ title: "Error creating protocol", variant: "destructive" }); return; }
                        const rows = exs.map((ex: any, i: number) => ({
                          protocol_id: proto.id, exercise_name: ex.exercise_name,
                          sets: ex.sets || null, reps: ex.reps || null, weight: ex.weight || null,
                          rpe: ex.rpe || null, notes: ex.notes || null, sort_order: i + 1,
                        }));
                        await supabase.from("protocol_exercises").insert(rows);
                        toast({ title: "Protocol created with AI exercises!" });
                        setNewTitle(""); setNewDesc(""); setShowCreate(false);
                        invalidateAll();
                      })();
                    }
                  } catch { toast({ title: "Failed to parse AI result", variant: "destructive" }); }
                }}
                label="AI Generate"
              />
            )}
          </div>
        </div>
      )}

      {/* Protocol list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground p-4">Loading...</p>
      ) : protocols.length === 0 ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <p className="text-sm text-foreground font-bold">No protocol templates</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first template above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocols.map((protocol) => {
            const protoExercises = getExercises(protocol.id);
            const isEditing = editingId === protocol.id;
            return (
              <div key={protocol.id} className="bg-card shadow-m2 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-background border border-border px-2 py-1 text-sm font-bold text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                        <textarea
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none h-14 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateProtocol.mutate({ id: protocol.id, title: editTitle, description: editDesc })}
                            className="bg-primary text-primary-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                          >
                            <Save size={10} className="inline mr-1" /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-foreground">{protocol.title}</h3>
                          {protocol.is_default && (
                            <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">DEFAULT</span>
                          )}
                          <button
                            onClick={() => { setEditingId(protocol.id); setEditTitle(protocol.title); setEditDesc(protocol.description || ""); }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                        {protocol.description && (
                          <p className="text-xs text-muted-foreground mt-1">{protocol.description}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => setGiftProtocol({ id: protocol.id, title: protocol.title })}
                      className="text-muted-foreground hover:text-primary p-1 transition-colors" title="Gift to user"
                    >
                      <Gift size={14} />
                    </button>
                    <button
                      onClick={() => toggleDefault.mutate({ id: protocol.id, is_default: !protocol.is_default })}
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 transition-m2 ${
                        protocol.is_default ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {protocol.is_default ? "Default ✓" : "Set Default"}
                    </button>
                  </div>
                </div>

                {/* Exercises */}
                {protoExercises.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exercises</p>
                    {protoExercises.map((ex) => (
                      <div key={ex.id} className="bg-muted/50 p-2">
                        {editingExercise === ex.id ? (
                          <div className="space-y-2">
                            <input value={exForm.exercise_name || ""} onChange={(e) => setExForm({ ...exForm, exercise_name: e.target.value })}
                              className="w-full bg-background border border-border px-2 py-1 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary outline-none" />
                            <div className="grid grid-cols-3 gap-1">
                              <input value={exForm.sets || ""} onChange={(e) => setExForm({ ...exForm, sets: e.target.value })} placeholder="Sets" type="number"
                                className="bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
                              <input value={exForm.reps || ""} onChange={(e) => setExForm({ ...exForm, reps: e.target.value })} placeholder="Reps"
                                className="bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
                              <input value={exForm.rpe || ""} onChange={(e) => setExForm({ ...exForm, rpe: e.target.value })} placeholder="RPE" type="number"
                                className="bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
                            </div>
                            <input value={exForm.notes || ""} onChange={(e) => setExForm({ ...exForm, notes: e.target.value })} placeholder="Notes"
                              className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
                            <textarea value={exForm.coach_notes || ""} onChange={(e) => setExForm({ ...exForm, coach_notes: e.target.value })}
                              placeholder="Coach notes (visible to athlete)..."
                              className="w-full bg-background border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none h-12 resize-none" />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateExercise.mutate({
                                  id: ex.id,
                                  updates: {
                                    exercise_name: exForm.exercise_name,
                                    sets: parseInt(exForm.sets) || null,
                                    reps: exForm.reps || null,
                                    rpe: parseFloat(exForm.rpe) || null,
                                    notes: exForm.notes || null,
                                    coach_notes: exForm.coach_notes || null,
                                  },
                                })}
                                className="bg-primary text-primary-foreground px-2 py-1 text-[10px] font-bold uppercase"
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingExercise(null)} className="text-[10px] text-muted-foreground">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {ex.image_url && (
                                <img src={ex.image_url} alt="" className="h-8 w-8 object-cover rounded shrink-0" />
                              )}
                              <div className="min-w-0">
                                <span className="text-xs text-foreground font-bold block truncate">{ex.exercise_name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {ex.sets && `${ex.sets}×`}{ex.reps || "—"}
                                  {ex.notes && ` · ${ex.notes}`}
                                </span>
                                {ex.coach_notes && (
                                  <span className="text-[10px] text-primary block">Coach: {ex.coach_notes}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <label className="cursor-pointer text-muted-foreground hover:text-foreground p-1" title="Upload reference image">
                                <ImageIcon size={12} />
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(ex.id, e.target.files[0]); }}
                                  disabled={uploadingImage === ex.id}
                                />
                              </label>
                              <button onClick={() => startEditExercise(ex)} className="text-muted-foreground hover:text-foreground p-1">
                                <Edit3 size={12} />
                              </button>
                              <button onClick={() => deleteExercise.mutate(ex.id)} className="text-muted-foreground hover:text-destructive p-1">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Exercise Button */}
                <button
                  onClick={() => setAddExerciseTo({ id: protocol.id, count: protoExercises.length })}
                  className="mt-2 w-full bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={10} /> Add Exercise
                </button>

                <p className="text-[10px] text-muted-foreground mt-2">
                  Created {new Date(protocol.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {giftProtocol && (
        <GiftProtocolModal
          protocolId={giftProtocol.id}
          protocolTitle={giftProtocol.title}
          onClose={() => setGiftProtocol(null)}
          onGifted={() => { setGiftProtocol(null); invalidateAll(); }}
        />
      )}
      {addExerciseTo && (
        <AddExerciseModal
          protocolId={addExerciseTo.id}
          currentCount={addExerciseTo.count}
          onClose={() => setAddExerciseTo(null)}
          onAdded={() => { setAddExerciseTo(null); invalidateAll(); }}
        />
      )}
    </div>
  );
};

/* Small inline component for flag responses */
const FlagResponseCard = ({ flag, onRespond }: { flag: any; onRespond: (id: string, text: string) => void }) => {
  const [response, setResponse] = useState("");
  return (
    <div className="bg-background border border-border p-3 space-y-2">
      <p className="text-xs text-foreground">"{flag.question}"</p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Your response..."
        className="w-full bg-muted border border-border px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none h-12 resize-none"
      />
      <button
        onClick={() => { if (response.trim()) onRespond(flag.id, response.trim()); }}
        disabled={!response.trim()}
        className="bg-primary text-primary-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
      >
        Respond
      </button>
    </div>
  );
};

export default AdminProtocols;
