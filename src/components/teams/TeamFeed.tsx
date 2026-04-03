import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  rosterId: string;
}

const TeamFeed = ({ rosterId }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, any[]>>({});
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
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
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [rosterId]);

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    await supabase.from("team_feed").insert({
      roster_id: rosterId,
      user_id: user.id,
      type: "shoutout",
      content: newPost.trim(),
    });
    setNewPost("");
    load();
    setPosting(false);
  };

  const react = async (feedItemId: string, emoji: string) => {
    if (!user) return;
    const existing = (reactions[feedItemId] || []).find(
      (r) => r.user_id === user.id && r.reaction === emoji
    );
    if (existing) {
      await supabase.from("team_feed_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("team_feed_reactions").insert({
        feed_item_id: feedItemId,
        user_id: user.id,
        reaction: emoji,
      });
    }
    load();
  };

  const REACTIONS = ["🔥", "💪", "👏", "💯"];

  const typeEmoji: Record<string, string> = {
    pr: "🏆",
    workout_log: "💪",
    shoutout: "🙌",
    coach_announcement: "📢",
  };

  return (
    <div className="space-y-3 mt-4">
      {/* Post input */}
      <div className="flex gap-2">
        <Input
          placeholder="Shoutout a teammate..."
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handlePost()}
        />
        <Button onClick={handlePost} disabled={posting} size="icon"><Send size={16} /></Button>
      </div>

      {/* Feed items */}
      {items.map((item) => {
        const itemReactions = reactions[item.id] || [];
        return (
          <Card key={item.id} className={`p-3 ${item.is_pinned ? "border-primary bg-primary/5" : ""}`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{typeEmoji[item.type] || "💬"}</span>
                <span className="font-bold uppercase tracking-wider">{item.type.replace("_", " ")}</span>
                <span>·</span>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-foreground">{item.content}</p>
              {/* Reactions */}
              <div className="flex gap-1">
                {REACTIONS.map((emoji) => {
                  const count = itemReactions.filter((r) => r.reaction === emoji).length;
                  const mine = itemReactions.some((r) => r.reaction === emoji && r.user_id === user?.id);
                  return (
                    <button
                      key={emoji}
                      onClick={() => react(item.id, emoji)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        mine ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {emoji} {count > 0 && count}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No posts yet — shoutout a teammate! 🙌</p>
      )}
    </div>
  );
};

export default TeamFeed;
