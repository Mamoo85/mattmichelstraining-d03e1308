import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Pin } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rosterId: string | null;
}

const CoachTeamFeed = ({ rosterId }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    if (!rosterId) return;
    const { data } = await supabase
      .from("team_feed")
      .select("*")
      .eq("roster_id", rosterId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data || []);
  };

  useEffect(() => { load(); }, [rosterId]);

  // Poll every 10s
  useEffect(() => {
    if (!rosterId) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [rosterId]);

  const handlePost = async () => {
    if (!newPost.trim() || !rosterId || !user) return;
    setPosting(true);
    const { error } = await supabase.from("team_feed").insert({
      roster_id: rosterId,
      user_id: user.id,
      type: "coach_announcement",
      content: newPost.trim(),
    });
    if (error) toast.error(error.message);
    else { setNewPost(""); load(); }
    setPosting(false);
  };

  if (!rosterId) {
    return <p className="text-center text-sm text-muted-foreground py-8 mt-4">Select a team first</p>;
  }

  const typeEmoji: Record<string, string> = {
    pr: "🏆",
    workout_log: "💪",
    shoutout: "🙌",
    coach_announcement: "📢",
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Coach post */}
      <div className="flex gap-2">
        <Input
          placeholder="Post an announcement..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
        />
        <Button onClick={handlePost} disabled={posting} size="icon">
          <Send size={16} />
        </Button>
      </div>

      {/* Feed */}
      {items.map((item) => (
        <Card key={item.id} className={`p-3 ${item.is_pinned ? "border-primary bg-primary/5" : ""}`}>
          <div className="flex items-start gap-2">
            {item.is_pinned && <Pin size={12} className="text-primary mt-1" />}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>{typeEmoji[item.type] || "💬"}</span>
                <span className="uppercase font-bold tracking-wider">{item.type.replace("_", " ")}</span>
                <span>·</span>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-foreground">{item.content}</p>
            </div>
          </div>
        </Card>
      ))}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No posts yet — be the first!</p>
      )}
    </div>
  );
};

export default CoachTeamFeed;
