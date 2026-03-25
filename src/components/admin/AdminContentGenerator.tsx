import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Save, Check, Loader2, Sparkles } from "lucide-react";

const CONTENT_TYPES = [
  { key: "authority", label: "Authority Post", desc: "Training principle that most people get wrong" },
  { key: "client_win", label: "Client Win Post", desc: "Celebrate a client PR", hasInputs: true },
  { key: "youth_athlete", label: "Youth Athlete Post", desc: "Parent-targeted content" },
  { key: "app_feature", label: "App Feature Post", desc: "Showcase an M² app feature", hasInputs: true },
  { key: "studio_community", label: "Studio/Community Post", desc: "Behind-the-scenes studio content" },
] as const;

const APP_FEATURES = ["AI Generator", "PR Tracking", "Form Checks", "Exercise Library", "Progress Charts", "Recovery Logging"];

const AdminContentGenerator = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ caption: string; hashtags: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Client win inputs
  const [exercise, setExercise] = useState("");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [weeks, setWeeks] = useState("");
  const [clientType, setClientType] = useState("Youth");

  // App feature input
  const [featureName, setFeatureName] = useState(APP_FEATURES[0]);

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    setResult(null);
    try {
      const inputs: any = {};
      if (selected === "client_win") Object.assign(inputs, { exercise, before, after, weeks, clientType });
      if (selected === "app_feature") inputs.featureName = featureName;

      const { data, error } = await supabase.functions.invoke("generate-instagram-content", {
        body: { content_type: selected, inputs },
      });
      if (error) throw error;
      setResult({ caption: data.caption, hashtags: data.hashtags || "" });
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const copyCaption = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.caption + "\n\n" + result.hashtags);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!result || !selected) return;
      const { error } = await supabase.from("content_queue" as any).insert({
        content_type: selected,
        caption: result.caption,
        hashtags: result.hashtags,
        status: "draft",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-queue"] });
      toast.success("Saved to queue");
    },
    onError: () => toast.error("Failed to save"),
  });

  // Queue
  const { data: queue = [] } = useQuery({
    queryKey: ["content-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_queue" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return data as any[] ?? [];
    },
  });

  const markPosted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_queue" as any).update({ status: "posted" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-queue"] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Instagram Content Generator</h2>

      {/* Content type buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CONTENT_TYPES.map(ct => (
          <button
            key={ct.key}
            onClick={() => { setSelected(ct.key); setResult(null); }}
            className={`p-3 border text-left transition-all ${
              selected === ct.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            }`}
          >
            <span className="text-xs font-bold block">{ct.label}</span>
            <span className="text-[10px] text-muted-foreground">{ct.desc}</span>
          </button>
        ))}
      </div>

      {/* Inputs for client_win */}
      {selected === "client_win" && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Input placeholder="Exercise name" value={exercise} onChange={e => setExercise(e.target.value)} />
            <div className="flex gap-2">
              <Input placeholder="Before weight" value={before} onChange={e => setBefore(e.target.value)} className="w-1/2" />
              <Input placeholder="After weight" value={after} onChange={e => setAfter(e.target.value)} className="w-1/2" />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Weeks" value={weeks} onChange={e => setWeeks(e.target.value)} className="w-1/2" />
              <Select value={clientType} onValueChange={setClientType}>
                <SelectTrigger className="w-1/2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Youth">Youth</SelectItem>
                  <SelectItem value="Adult">Adult</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inputs for app_feature */}
      {selected === "app_feature" && (
        <Card>
          <CardContent className="pt-4">
            <Select value={featureName} onValueChange={setFeatureName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APP_FEATURES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Generate button */}
      {selected && (
        <Button onClick={generate} disabled={generating} className="w-full">
          {generating ? <><Loader2 size={14} className="mr-2 animate-spin" /> Generating…</> : <><Sparkles size={14} className="mr-2" /> Generate Caption</>}
        </Button>
      )}

      {/* Result preview */}
      {result && (
        <Card className="bg-card border-primary/30">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.caption}</p>
            {result.hashtags && (
              <p className="text-xs text-primary font-medium">{result.hashtags}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyCaption}>
                {copied ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
                {copied ? "Copied" : "Copy Caption"}
              </Button>
              <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <Save size={12} className="mr-1" /> Save to Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Content Queue</h3>
          {queue.map((item: any) => (
            <Card key={item.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={item.status === "posted" ? "default" : "secondary"} className="text-[9px]">
                      {item.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{item.content_type}</span>
                  </div>
                  <p className="text-xs text-foreground line-clamp-2">{item.caption}</p>
                </div>
                {item.status === "draft" && (
                  <Button size="sm" variant="outline" className="text-[10px] flex-shrink-0" onClick={() => markPosted.mutate(item.id)}>
                    Mark Posted
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminContentGenerator;
