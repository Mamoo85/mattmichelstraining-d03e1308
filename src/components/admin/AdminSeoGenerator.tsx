import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PLACEHOLDER = `[
  { "keyword": "youth hockey strength", "location": "Grosse Pointe", "target_audience": "Youth athletes ages 12-17" },
  { "keyword": "baseball rotational power", "location": "Detroit", "target_audience": "High school baseball players" }
]`;

const AdminSeoGenerator = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    let parsed: unknown[];
    try {
      parsed = JSON.parse(input);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Must be a non-empty array");
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-seo-pages", {
        body: { pages: parsed },
      });
      if (error) throw error;

      const created = (data?.results || []).filter((r: any) => r.status === "created").length;
      const skipped = (data?.results || []).filter((r: any) => r.status === "skipped_duplicate").length;
      const errors = (data?.results || []).filter((r: any) => r.status !== "created" && r.status !== "skipped_duplicate").length;

      toast({
        title: "SEO Pages Generated Successfully",
        description: `${created} created · ${skipped} skipped (duplicate)${errors > 0 ? ` · ${errors} errors` : ""}`,
      });
      setInput("");
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Rocket size={16} className="text-primary" />
          SEO Page Generator
        </CardTitle>
        <CardDescription className="text-xs">
          Paste a JSON array of pages to auto-generate localized SEO landing pages via AI. Each entry needs <code className="text-primary">keyword</code>, optional <code className="text-primary">location</code>, and <code className="text-primary">target_audience</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={8}
          className="w-full bg-muted border border-border px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-y"
          disabled={loading}
        />
        <Button
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="w-full font-bold uppercase tracking-widest text-xs"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin mr-2" />
              Generating… this may take a minute
            </>
          ) : (
            "Ignite SEO Engine"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminSeoGenerator;
