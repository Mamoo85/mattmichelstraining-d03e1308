import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Zap, Trophy, Search, Plus, Minus, Loader2 } from "lucide-react";
import { getLevelInfo } from "@/hooks/usePoints";

interface UserPointRow {
  user_id: string;
  total_points: number;
  level: string;
  is_public: boolean;
  athlete_name: string | null;
  full_name: string | null;
  email: string | null;
}

const AdminPointsManager = () => {
  const [users, setUsers] = useState<UserPointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    // Get all user_points
    const { data: pts } = await supabase
      .from("user_points")
      .select("user_id, total_points, level, is_public")
      .order("total_points", { ascending: false });
    if (!pts || pts.length === 0) { setUsers([]); setLoading(false); return; }

    const userIds = (pts as any[]).map(p => p.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, athlete_name, full_name, email")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    setUsers((pts as any[]).map(p => ({
      ...p,
      athlete_name: profileMap.get(p.user_id)?.athlete_name || null,
      full_name: profileMap.get(p.user_id)?.full_name || null,
      email: profileMap.get(p.user_id)?.email || null,
    })));
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAdjust = async () => {
    if (!adjustUserId || !adjustAmount || !adjustReason.trim()) {
      toast({ title: "Fill in amount and reason", variant: "destructive" });
      return;
    }
    setAdjusting(true);
    const pts = parseInt(adjustAmount);
    if (!pts) { toast({ title: "Enter a valid number", variant: "destructive" }); setAdjusting(false); return; }

    const { error } = await supabase.rpc("award_points", {
      _user_id: adjustUserId,
      _action: pts > 0 ? "admin_award" : "admin_deduct",
      _points: pts,
      _description: adjustReason.trim(),
      _reference_id: null,
    });

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${pts > 0 ? "+" : ""}${pts} points applied` });
      setAdjustUserId(null);
      setAdjustAmount("");
      setAdjustReason("");
      loadUsers();
    }
    setAdjusting(false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.athlete_name || "").toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">M² Points Manager</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{users.length} athletes with points</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search athletes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-muted border border-border pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {/* Adjust Panel */}
      {adjustUserId && (
        <div className="bg-primary/5 border border-primary/20 p-4 space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Adjust Points — {filtered.find(u => u.user_id === adjustUserId)?.athlete_name || "Athlete"}
          </span>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Points (negative to deduct)"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
              className="flex-1 bg-background border border-border px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <input
            type="text"
            placeholder="Reason (required)"
            value={adjustReason}
            onChange={e => setAdjustReason(e.target.value)}
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdjust}
              disabled={adjusting}
              className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
            >
              {adjusting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Apply
            </button>
            <button
              onClick={() => { setAdjustUserId(null); setAdjustAmount(""); setAdjustReason(""); }}
              className="bg-muted text-muted-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {users.length === 0 ? "No athletes have earned points yet." : "No matches."}
        </div>
      ) : (
        <div className="bg-card border border-border overflow-hidden">
          <div className="px-4 py-2 bg-muted flex items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="flex-1">Athlete</span>
            <span className="w-20 text-right">Points</span>
            <span className="w-24 text-center">Level</span>
            <span className="w-16 text-center">Action</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {filtered.map(u => {
              const level = getLevelInfo(u.total_points);
              return (
                <div key={u.user_id} className="flex items-center px-4 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-foreground block truncate">
                      {u.athlete_name || u.full_name || "Athlete"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{u.email}</span>
                  </div>
                  <span className="w-20 text-right font-mono font-bold text-primary text-sm">
                    {u.total_points.toLocaleString()}
                  </span>
                  <span className="w-24 text-center">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${level.color}`}>
                      {level.label}
                    </span>
                  </span>
                  <div className="w-16 flex justify-center">
                    <button
                      onClick={() => setAdjustUserId(u.user_id)}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Adjust
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPointsManager;
