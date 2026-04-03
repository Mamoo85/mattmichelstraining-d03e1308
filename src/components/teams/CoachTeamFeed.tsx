import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Pin, PinOff, Trash2, Flame } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rosterId: string | null;
}

const CoachTeamFeed = ({ rosterId }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, any[]>>({});
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

    if (data?.length) {
      const ids = data.map((d) => d.id);
      const { data: rxns } = await supabase
        .from("team_feed_reactions")
        .select("*")
        .in("feed_item_id", ids);
      const grouped: Record<string, any[]> = {};
      (rxns || []).forEach((r) => {
        if (!grouped[r.feed_item_id]) grouped[r.feed_item_id] = [];
        grouped[r.feed_item_id].push(r);
      });
      setReactions(grouped);
    }
  };

  useEffect(() => { load(); }, [rosterId]);
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
      is_pinned: true,
    });
    if (error) toast.error(error.message);
    else { setNewPost(""); load(); toast.success("Announcement posted 📢"); }
    setPosting(false);
  };

  const togglePin = async (itemId: string, currentlyPinned: boolean) => {
    await supabase.from("team_feed").update({ is_pinned: !currentlyPinned }).eq("id", itemId);
    load();
    toast.success(currentlyPinned ? "Unpinned" : "Pinned");
  };

  const deletePost = async (itemId: string) => {
    await supabase.from("team_feed_reactions").delete().eq("feed_item_id", itemId);
    await supabase.from("team_feed").delete().eq("id", itemId);
    load();
    toast.success("Post deleted");
  };

  if (!rosterId) {
    return <p className="text-center text-sm text-muted-foreground py-8 mt-4">Select a team first</p>;
  }

  const REACTIONS = ["🔥", "💪", "👏", "💯"];
  const typeEmoji: Record<string, string> = {
    pr: "🏆", workout_log: "💪", shoutout: "🙌", coach_announcement: "📢",
  };

  return (
    <div className="space-y-4 mt-4">
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

      {items.map((item) => {
        const itemReactions = reactions[item.id] || [];
        return (
          <Card key={item.id} className={`p-3 ${item.is_pinned ? "border-primary bg-primary/5" : ""}`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{typeEmoji[item.type] || "💬"}</span>
                  <span className="uppercase font-bold tracking-wider">{item.type.replace("_", " ")}</span>
                  <span>·</span>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => togglePin(item.id, item.is_pinned)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title={item.is_pinned ? "Unpin" : "Pin"}
                  >
                    {item.is_pinned ? <PinOff size={12} className="text-primary" /> : <Pin size={12} className="text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => deletePost(item.id)}
                    className="p-1 hover:bg-destructive/10 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground">{item.content}</p>

              {/* Reaction counts */}
              <div className="flex gap-1">
                {REACTIONS.map((emoji) => {
                  const count = itemReactions.filter((r) => r.reaction === emoji).length;
                  return (
                    <span
                      key={emoji}
                      className={`text-xs px-2 py-0.5 rounded-full border border-border ${count > 0 ? "bg-primary/5" : "opacity-40"}`}
                    >
                      {emoji} {count > 0 && count}
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No posts yet — be the first!</p>
      )}
    </div>
  );
};

export default CoachTeamFeed;
