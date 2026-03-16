import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Eye, ChevronDown, ChevronUp } from "lucide-react";

const AdminClientList = () => {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: workoutLogs = [] } = useQuery({
    queryKey: ["admin-all-workout-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = profiles.filter(
    (p) =>
      (p.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.athlete_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const getClientLogs = (userId: string) =>
    workoutLogs.filter((l) => l.user_id === userId).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Clients</p>
          <p className="text-2xl font-mono font-bold text-foreground">{profiles.length}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pro Members</p>
          <p className="text-2xl font-mono font-bold text-primary">
            {profiles.filter((p) => p.is_pro).length}
          </p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Workouts</p>
          <p className="text-2xl font-mono font-bold text-foreground">{workoutLogs.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full bg-card border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
        />
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
              return (
                <div key={profile.id}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : profile.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-m2-surface-hover transition-m2 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">
                          {profile.full_name || "No name"}
                        </p>
                        {profile.is_pro && (
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5">
                            PRO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                      {profile.athlete_name && (
                        <p className="text-xs text-muted-foreground">
                          Athlete: <span className="text-foreground">{profile.athlete_name}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                      {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 bg-muted/30">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 mt-2">
                        Recent Workouts
                      </p>
                      {logs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No workout logs yet</p>
                      ) : (
                        <div className="space-y-1">
                          {logs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between text-xs bg-card p-2 shadow-m2">
                              <div>
                                <span className="text-foreground font-bold">{log.exercise_name}</span>
                                <span className="text-muted-foreground ml-2">
                                  {log.sets}×{log.reps} @ {log.weight_lifted}lbs
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{log.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
