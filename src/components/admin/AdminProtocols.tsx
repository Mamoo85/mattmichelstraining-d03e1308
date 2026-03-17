import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AiAssistButton from "./AiAssistButton";

const AdminProtocols = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ["admin-protocols"] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-protocols"] });
      toast({ title: "Protocol updated" });
      setEditingId(null);
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const toggleDefault = useMutation({
    mutationFn: async ({ id, is_default }: { id: string; is_default: boolean }) => {
      if (is_default) {
        // Unset all others first
        await supabase.from("protocols").update({ is_default: false }).eq("is_template", true);
      }
      const { error } = await supabase.from("protocols").update({ is_default }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-protocols"] });
      toast({ title: "Default protocol updated" });
    },
  });

  const getExercises = (protocolId: string) =>
    exercises.filter((e) => e.protocol_id === protocolId);

  return (
    <div className="space-y-4">
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
          <button
            onClick={() => createProtocol.mutate()}
            disabled={!newTitle.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 disabled:opacity-50"
          >
            Create Template
          </button>
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
            return (
              <div key={protocol.id} className="bg-card shadow-m2 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">{protocol.title}</h3>
                      {protocol.is_default && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {protocol.description && (
                      <p className="text-xs text-muted-foreground mt-1">{protocol.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleDefault.mutate({ id: protocol.id, is_default: !protocol.is_default })}
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 transition-m2 ml-2 ${
                      protocol.is_default
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {protocol.is_default ? "Default ✓" : "Set Default"}
                  </button>
                </div>

                {/* Exercises */}
                {protoExercises.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exercises</p>
                    {protoExercises.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between text-xs bg-muted/50 p-2">
                        <span className="text-foreground font-bold">{ex.exercise_name}</span>
                        <span className="text-muted-foreground">
                          {ex.sets && `${ex.sets}×`}{ex.reps || "—"}
                          {ex.notes && ` · ${ex.notes}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground mt-2">
                  Created {new Date(protocol.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminProtocols;
