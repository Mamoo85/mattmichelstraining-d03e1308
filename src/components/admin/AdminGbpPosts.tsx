import { useState, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Copy, Check } from "lucide-react";

interface GbpPost {
  week: number;
  title: string;
  body: string;
  cta: string;
}

const PostCard = ({ post }: { post: GbpPost }) => {
  const [copied, setCopied] = useState(false);
  const fullText = `${post.title}\n\n${post.body}\n\n${post.cta}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Week {post.week}</p>
        <h3 className="font-bold text-foreground text-sm">{post.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{post.body}</p>
        <p className="text-sm italic text-primary">{post.cta}</p>
        <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={handleCopy}>
          {copied ? <><Check size={12} className="text-green-500" /> Copied ✓</> : <><Copy size={12} /> Copy Full Post</>}
        </Button>
      </CardContent>
    </Card>
  );
};

const GbpSection = ({ mode }: { mode: "training" | "webdesign" }) => {
  const [posts, setPosts] = useState<GbpPost[]>([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setPosts([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-gbp-posts", {
        body: { mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.posts)) throw new Error("Invalid response format");
      setPosts(data.posts);
      toast({ title: "Posts generated!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={generate} disabled={loading} className="gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin text-primary" /> Generating posts...</> : "Generate This Month's Posts"}
      </Button>

      {posts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((p) => <PostCard key={p.week} post={p} />)}
        </div>
      )}
    </div>
  );
};

const AdminGbpPosts = memo(() => (
  <Tabs defaultValue="training" className="w-full">
    <TabsList className="bg-muted/50 mb-4">
      <TabsTrigger value="training" className="text-[10px] font-bold uppercase tracking-widest">M² Training</TabsTrigger>
      <TabsTrigger value="webdesign" className="text-[10px] font-bold uppercase tracking-widest">Web Design</TabsTrigger>
    </TabsList>
    <TabsContent value="training"><GbpSection mode="training" /></TabsContent>
    <TabsContent value="webdesign"><GbpSection mode="webdesign" /></TabsContent>
  </Tabs>
));

AdminGbpPosts.displayName = "AdminGbpPosts";
export default AdminGbpPosts;
