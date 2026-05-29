import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink } from "lucide-react";

const AdminInstagramPosts = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ image_url: "", caption: "", post_url: "", likes_count: 0, posted_at: "" });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-instagram-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_posts" as any)
        .select("*")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("instagram_posts" as any).insert({
        image_url: form.image_url,
        caption: form.caption,
        post_url: form.post_url,
        likes_count: form.likes_count || 0,
        posted_at: form.posted_at || new Date().toISOString(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-instagram-posts"] });
      setForm({ image_url: "", caption: "", post_url: "", likes_count: 0, posted_at: "" });
      setShowForm(false);
      toast.success("Post added");
    },
    onError: () => toast.error("Failed to add post"),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("instagram_posts" as any).update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-instagram-posts"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("instagram_posts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-instagram-posts"] });
      toast.success("Post deleted");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Instagram Posts</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1" /> Add Post
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input placeholder="Image URL" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
            <Input placeholder="Post URL (Instagram link)" value={form.post_url} onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))} />
            <Textarea placeholder="Caption" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} rows={3} />
            <div className="flex gap-2">
              <Input type="number" placeholder="Likes" value={form.likes_count || ""} onChange={e => setForm(f => ({ ...f, likes_count: Number(e.target.value) }))} className="w-24" />
              <Input type="date" value={form.posted_at} onChange={e => setForm(f => ({ ...f, posted_at: e.target.value }))} />
            </div>
            <Button size="sm" onClick={() => addMut.mutate()} disabled={!form.image_url || !form.post_url || addMut.isPending}>
              {addMut.isPending ? "Saving…" : "Save Post"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No posts yet. Add your first Instagram post above.</p>
      ) : (
        <div className="grid gap-2">
          {posts.map((post: any) => (
            <Card key={post.id} className="overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <img src={post.image_url} alt="" className="w-16 h-16 object-cover rounded bg-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground line-clamp-2">{post.caption || "No caption"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">❤️ {post.likes_count}</span>
                    <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      View <ExternalLink size={8} />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={post.active} onCheckedChange={active => toggleMut.mutate({ id: post.id, active })} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(post.id)}>
                    <Trash2 size={12} className="text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminInstagramPosts;
