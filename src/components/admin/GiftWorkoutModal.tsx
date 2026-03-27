import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Gift, Loader2, Search, X } from "lucide-react";

interface GiftWorkoutModalProps {
  workoutId: string;
  workoutTitle: string;
  workoutExercises: any[];
  workoutDescription: string | null;
  onClose: () => void;
  onGifted: () => void;
}

const GiftWorkoutModal = ({ workoutId, workoutTitle, workoutExercises, workoutDescription, onClose, onGifted }: GiftWorkoutModalProps) => {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [giftMessage, setGiftMessage] = useState("");
  const [gifting, setGifting] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-for-gift-workout", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("user_id, full_name, athlete_name, email").limit(20);
      if (search.trim()) {
        q = q.or(`full_name.ilike.%${search}%,athlete_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const handleGift = async () => {
    if (!selectedUser) return;
    setGifting(true);
    try {
      // Clone the workout into the user's personal library
      const { error: insertErr } = await supabase.from("community_workouts").insert({
        user_id: selectedUser.id,
        title: workoutTitle,
        description: giftMessage
          ? `${workoutDescription || ""}\n\n💬 Coach Matt: ${giftMessage}`.trim()
          : workoutDescription || null,
        creator_name: "Coach Matt",
        exercises: workoutExercises as any,
        is_public: false,
        source_type: "coach_seeded",
      });
      if (insertErr) throw insertErr;

      // Notify user
      await supabase.from("notifications").insert({
        user_id: selectedUser.id,
        type: "workout_gift",
        title: "New Workout from Coach Matt",
        body: giftMessage || `You've been gifted "${workoutTitle}" — check your Workouts tab.`,
        link: "/dashboard",
      });

      toast({ title: `Workout gifted to ${selectedUser.name}` });
      onGifted();
    } catch (err: any) {
      toast({ title: "Gift failed", description: err.message, variant: "destructive" });
    }
    setGifting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-md p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Gift Workout</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Gifting "<span className="text-foreground font-bold">{workoutTitle}</span>" — select a user below.
        </p>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        {selectedUser ? (
          <div className="bg-primary/10 border border-primary/20 p-3 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">{selectedUser.name}</span>
            <button onClick={() => setSelectedUser(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {users.map((u) => {
              const name = u.athlete_name || u.full_name || u.email || "Unknown";
              return (
                <button
                  key={u.user_id}
                  onClick={() => setSelectedUser({ id: u.user_id, name })}
                  className="w-full text-left bg-muted/50 hover:bg-muted p-2 text-xs text-foreground transition-colors"
                >
                  <span className="font-bold">{name}</span>
                  {u.email && <span className="text-muted-foreground ml-2">{u.email}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
            Gift Message (Optional)
          </label>
          <textarea
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="Hey! I put this workout together for you..."
            className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20 resize-none"
          />
        </div>

        <button
          onClick={handleGift}
          disabled={!selectedUser || gifting}
          className="w-full h-10 bg-primary text-primary-foreground flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
        >
          {gifting ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
          {gifting ? "Gifting..." : "Gift Workout"}
        </button>
      </div>
    </div>
  );
};

export default GiftWorkoutModal;
