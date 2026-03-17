import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronDown, ChevronUp, Dumbbell, ShoppingBag, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import AiAssistButton from "./AiAssistButton";

const AdminClientList = () => {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workoutLogs = [] } = useQuery({
    queryKey: ["admin-all-workout-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("workout_logs").select("*").order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: activePrograms = [] } = useQuery({
    queryKey: ["admin-all-active-programs"],
    queryFn: async () => {
      const { data } = await supabase.from("user_active_programs").select("*, training_programs(title, category)");
      return data || [];
    },
  });

  const { data: progressLogs = [] } = useQuery({
    queryKey: ["admin-all-progress-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("progress_logs").select("user_id, exercise_name, weight, reps, logged_at").order("logged_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ["admin-all-gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("gifted_products").select("*");
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["admin-all-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*");
      return data || [];
    },
  });

  const toggleInPerson = useMutation({
    mutationFn: async ({ profileId, value }: { profileId: string; value: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_in_person: value }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Client status updated");
    },
    onError: () => toast.error("Failed to update client status"),
  });

  const filtered = profiles.filter(
    (p) =>
      (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.athlete_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const getClientLogs = (userId: string) => workoutLogs.filter((l) => l.user_id === userId).slice(0, 5);
  const getClientPrograms = (userId: string) => activePrograms.filter((p: any) => p.user_id === userId);
  const getClientProgress = (userId: string) => progressLogs.filter((l) => l.user_id === userId).slice(0, 5);
  const getClientGifts = (userId: string) => gifts.filter((g) => g.user_id === userId);

  // Stats
  const activeUsers7d = new Set(workoutLogs.filter((l) => new Date(l.date) > new Date(Date.now() - 7 * 86400000)).map((l) => l.user_id)).size;
  const inPersonCount = profiles.filter((p) => p.is_in_person).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Clients</p>
          <p className="text-2xl font-mono font-bold text-foreground">{profiles.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pro Members</p>
          <p className="text-2xl font-mono font-bold text-primary">{profiles.filter((p) => p.is_pro).length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active (7d)</p>
          <p className="text-2xl font-mono font-bold text-foreground">{activeUsers7d}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Workouts</p>
          <p className="text-2xl font-mono font-bold text-foreground">{workoutLogs.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">In-Person</p>
          <p className="text-2xl font-mono font-bold text-primary">{inPersonCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full bg-card border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
      </div>

      {/* Client list */}
      <div className="bg-card shadow-m2">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No clients found</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((profile) => {
              const expanded = expandedId === profile.id;
              const logs = expanded ? getClientLogs(profile.user_id) : [];
              const progs = expanded ? getClientPrograms(profile.user_id) : [];
              const progress = expanded ? getClientProgress(profile.user_id) : [];
              const clientGifts = expanded ? getClientGifts(profile.user_id) : [];

              return (
                <div key={profile.id}>
                  <button onClick={() => setExpandedId(expanded ? null : profile.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-m2 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground truncate">{profile.full_name || "No name"}</p>
                        {profile.is_in_person && <span className="text-[9px] font-bold uppercase tracking-widest bg-green-600/20 text-green-400 px-1.5 py-0.5 flex items-center gap-0.5"><MapPin size={8} />IN-PERSON</span>}
                        {profile.is_pro && <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">PRO</span>}
                        {profile.subscription_tier && profile.subscription_tier !== "free" && (
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-1.5 py-0.5">{profile.subscription_tier}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                        {profile.athlete_name && <p className="text-xs text-muted-foreground">· Athlete: <span className="text-foreground">{profile.athlete_name}</span></p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-[10px] text-muted-foreground">{new Date(profile.created_at).toLocaleDateString()}</span>
                      {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 bg-muted/20 space-y-4">
                      {/* In-Person Toggle */}
                      <div className="mt-2 flex items-center justify-between bg-card p-3 shadow-m2">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-muted-foreground" />
                          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">In-Person Client</span>
                        </div>
                        <button
                          onClick={() => toggleInPerson.mutate({ profileId: profile.id, value: !profile.is_in_person })}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            profile.is_in_person
                              ? "bg-green-600/20 text-green-400 hover:bg-red-600/20 hover:text-red-400"
                              : "bg-muted text-muted-foreground hover:bg-green-600/20 hover:text-green-400"
                          }`}
                        >
                          {profile.is_in_person ? "Remove" : "Mark In-Person"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        <div className="bg-card p-2.5 shadow-m2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Joined</p>
                          <p className="text-xs font-bold text-foreground">{new Date(profile.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-card p-2.5 shadow-m2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tier</p>
                          <p className="text-xs font-bold text-foreground">{profile.subscription_tier || "Free"}</p>
                        </div>
                        <div className="bg-card p-2.5 shadow-m2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Programs</p>
                          <p className="text-xs font-bold text-foreground">{getClientPrograms(profile.user_id).length}</p>
                        </div>
                        <div className="bg-card p-2.5 shadow-m2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Workouts</p>
                          <p className="text-xs font-bold text-foreground">{workoutLogs.filter((l) => l.user_id === profile.user_id).length}</p>
                        </div>
                      </div>

                      {/* Active Programs */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5"><ShoppingBag size={10} className="inline mr-1" />Active Programs</p>
                        {progs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No programs</p>
                        ) : (
                          <div className="space-y-1">
                            {progs.map((p: any) => (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-card p-2 shadow-m2">
                                <span className="text-foreground font-bold">{p.training_programs?.title || "Program"}</span>
                                <span className="text-[9px] text-muted-foreground">{p.training_programs?.category} · {p.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Gifts */}
                      {clientGifts.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">🎁 Gifts Received</p>
                          <div className="space-y-1">
                            {clientGifts.map((g) => (
                              <div key={g.id} className="text-xs bg-card p-2 shadow-m2">
                                <span className="font-bold text-foreground uppercase">{g.gift_type}</span>
                                {g.notes && <span className="text-muted-foreground ml-2">{g.notes}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Progress */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5"><Dumbbell size={10} className="inline mr-1" />Recent Progress Logs</p>
                        {progress.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No progress logs</p>
                        ) : (
                          <div className="space-y-1">
                            {progress.map((l, i) => (
                              <div key={i} className="flex items-center justify-between text-xs bg-card p-2 shadow-m2">
                                <div>
                                  <span className="text-foreground font-bold">{l.exercise_name}</span>
                                  <span className="text-muted-foreground ml-2">{l.weight}lbs × {l.reps}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{new Date(l.logged_at).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recent Workouts */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5"><Calendar size={10} className="inline mr-1" />Recent Workouts</p>
                        {logs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No workout logs yet</p>
                        ) : (
                          <div className="space-y-1">
                            {logs.map((log) => (
                              <div key={log.id} className="flex items-center justify-between text-xs bg-card p-2 shadow-m2">
                                <div>
                                  <span className="text-foreground font-bold">Workout Session</span>
                                  {log.session_notes && <span className="text-muted-foreground ml-2">{log.session_notes}</span>}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{new Date(log.date).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminClientList;
