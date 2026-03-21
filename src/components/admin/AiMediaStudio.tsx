import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wand2, Download, RefreshCw, Loader2, Sparkles, X } from "lucide-react";

interface SelectedFile {
  id: string;
  url: string;
  name: string;
  type: string;
}

interface Props {
  selectedFiles: SelectedFile[];
  onClose: () => void;
}

const STYLES = [
  { value: "bold/energetic", label: "Bold & Energetic" },
  { value: "clean/minimal", label: "Clean & Minimal" },
  { value: "dark/cinematic", label: "Dark & Cinematic" },
  { value: "retro/gritty", label: "Retro & Gritty" },
];

const OUTPUT_TYPES = [
  { value: "social post", label: "Social Post" },
  { value: "promo banner", label: "Promo Banner" },
  { value: "composite", label: "Photo Composite" },
  { value: "branded graphic", label: "Branded Graphic" },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 Square" },
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Story/Reel" },
  { value: "4:5", label: "4:5 Portrait" },
];

const AiMediaStudio = ({ selectedFiles, onClose }: Props) => {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("bold/energetic");
  const [outputType, setOutputType] = useState("social post");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [textOverlay, setTextOverlay] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const imageFiles = selectedFiles.filter(f => f.type === "image");

  const generateMut = useMutation({
    mutationFn: async () => {
      if (imageFiles.length === 0) throw new Error("Select at least one image");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create job record
      const { data: job, error: jobErr } = await supabase.from("ai_media_jobs" as any).insert({
        source_file_ids: imageFiles.map(f => f.id),
        prompt: prompt || "Create a professional branded image",
        parameters: { style, outputType, aspectRatio, textOverlay },
        status: "pending",
        created_by: user.id,
      }).select("id").single();

      if (jobErr) throw jobErr;

      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-media-studio`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
          },
          body: JSON.stringify({
            sourceUrls: imageFiles.map(f => f.url),
            prompt: prompt || undefined,
            parameters: { style, outputType, aspectRatio, textOverlay },
            jobId: (job as any).id,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }

      const result = await resp.json();
      return result.resultUrl;
    },
    onSuccess: (url) => {
      setResultUrl(url);
      qc.invalidateQueries({ queryKey: ["admin-media-files"] });
      toast.success("Image generated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-primary" />
        <h3 className="text-sm font-bold tracking-wider uppercase">AI Creative Studio</h3>
        <Badge variant="secondary" className="text-[9px]">{imageFiles.length} image(s) selected</Badge>
      </div>

      {/* Source preview */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {selectedFiles.map(f => (
          <div key={f.id} className="relative shrink-0 w-20 h-20 rounded border overflow-hidden">
            {f.type === "image" ? (
              <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground">{f.type}</div>
            )}
          </div>
        ))}
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Style</label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{STYLES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Output Type</label>
          <Select value={outputType} onValueChange={setOutputType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{OUTPUT_TYPES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Aspect Ratio</label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ASPECT_RATIOS.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Text Overlay (optional)</label>
        <Input value={textOverlay} onChange={e => setTextOverlay(e.target.value)} placeholder="e.g. 'Train Different'" className="h-8 text-xs" />
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Custom Prompt (optional)</label>
        <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe what you want... e.g. 'Create a before/after transformation post with my logo'" className="text-xs min-h-[60px]" />
      </div>

      <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending || imageFiles.length === 0} className="w-full gap-2">
        {generateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
        {generateMut.isPending ? "Generating..." : "Generate"}
      </Button>

      {/* Result */}
      {resultUrl && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider">Result</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
                <RefreshCw size={12} /> Regenerate
              </Button>
              <a href={resultUrl} download target="_blank" rel="noreferrer">
                <Button size="sm" variant="default" className="gap-1 text-xs h-7">
                  <Download size={12} /> Download
                </Button>
              </a>
            </div>
          </div>
          <img src={resultUrl} alt="AI Generated" className="w-full max-w-lg mx-auto rounded-md border" />
        </Card>
      )}
    </div>
  );
};

export default AiMediaStudio;
