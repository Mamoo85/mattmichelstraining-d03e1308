import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, Send, RefreshCw, Linkedin, Facebook, CheckCircle, AlertCircle, Copy, Edit3 } from "lucide-react";

export default function SocialMediaLab() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<"linkedin" | "facebook">("linkedin");
  const [businessName, setBusinessName] = useState("M2 Development");
  const [businessType, setBusinessType] = useState("web design & local marketing");
  const [city, setCity] = useState("Grosse Pointe, MI");
  const [brandVoice, setBrandVoice] = useState("Friendly, direct, local-guy-who-gets-results");
  const [contentFocus, setContentFocus] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  const [generatedPost, setGeneratedPost] = useState("");
  const [editablePost, setEditablePost] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [connections, setConnections] = useState<{ linkedin: boolean; facebook: boolean; ai: boolean } | null>(null);

  // Check which connections are available
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("test-social-post", {
          body: { action: "check" },
        });
        if (!error && data) setConnections(data);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setPosted(false);
    try {
      const { data, error } = await supabase.functions.invoke("test-social-post", {
        body: {
          action: "generate",
          platform,
          businessName,
          businessType,
          city,
          brandVoice,
          contentFocus,
          customPrompt: customPrompt.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setGeneratedPost(data.content);
      setEditablePost(data.content);
      toast({ title: "Post generated!", description: `${platform} post ready for review.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePost = async () => {
    if (!editablePost.trim()) {
      toast({ title: "No content", description: "Generate or type a post first.", variant: "destructive" });
      return;
    }
    setPosting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-social-post", {
        body: {
          action: "post",
          platform,
          postContent: editablePost.trim(),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPosted(true);
      toast({ title: `Posted to ${platform}!`, description: "Check your feed." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Post failed", description: msg, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editablePost);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Card className="bg-slate-900 border-orange-500/30 border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-orange-500" />
            Social Media Lab
          </CardTitle>
          <div className="flex items-center gap-2">
            {connections && (
              <>
                <Badge className={connections.linkedin ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                  <Linkedin className="h-3 w-3 mr-1" />
                  {connections.linkedin ? "Connected" : "No Token"}
                </Badge>
                <Badge className={connections.facebook ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                  <Facebook className="h-3 w-3 mr-1" />
                  {connections.facebook ? "Connected" : "No Token"}
                </Badge>
              </>
            )}
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-1">
          Generate AI posts exactly like a customer would receive, then preview or post live.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as "linkedin" | "facebook")}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="linkedin" className="text-white">
                  <span className="flex items-center gap-2"><Linkedin className="h-3 w-3" /> LinkedIn</span>
                </SelectItem>
                <SelectItem value="facebook" className="text-white">
                  <span className="flex items-center gap-2"><Facebook className="h-3 w-3" /> Facebook</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Business Name</Label>
            <Input value={businessName} onChange={e => setBusinessName(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Business Type / Industry</Label>
            <Input value={businessType} onChange={e => setBusinessType(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">City</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Brand Voice</Label>
            <Input value={brandVoice} onChange={e => setBrandVoice(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" placeholder="e.g. Professional, witty, no-nonsense" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Content Focus (optional)</Label>
            <Input value={contentFocus} onChange={e => setContentFocus(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" placeholder="e.g. web design, SEO tips" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">Custom Prompt (overrides all above)</Label>
          <Textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            className="bg-slate-800 border-slate-600 text-white text-sm min-h-[50px]"
            placeholder="Leave empty to use the fields above, or write your own full prompt..."
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
          ) : (
            <><Wand2 className="h-4 w-4 mr-2" /> Generate {platform === "linkedin" ? "LinkedIn" : "Facebook"} Post</>
          )}
        </Button>

        {/* Preview / Edit area */}
        {generatedPost && (
          <div className="space-y-3 pt-2 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 text-sm font-semibold flex items-center gap-2">
                <Edit3 className="h-3 w-3" /> Preview &amp; Edit
              </Label>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopy} className="text-slate-400 hover:text-white h-7 px-2">
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating} className="text-slate-400 hover:text-white h-7 px-2">
                  <RefreshCw className={`h-3 w-3 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
                </Button>
              </div>
            </div>
            <Textarea
              value={editablePost}
              onChange={e => setEditablePost(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white text-sm min-h-[100px]"
            />
            <div className="flex items-center gap-3">
              <Button
                onClick={handlePost}
                disabled={posting || !editablePost.trim()}
                className={`flex-1 ${platform === "linkedin" ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600"} text-white`}
              >
                {posting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Posting...</>
                ) : posted ? (
                  <><CheckCircle className="h-4 w-4 mr-2" /> Posted!</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" /> Post to {platform === "linkedin" ? "LinkedIn" : "Facebook"} Now</>
                )}
              </Button>
              {posted && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" /> Live
                </Badge>
              )}
            </div>
            {connections && platform === "linkedin" && !connections.linkedin && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> LINKEDIN_ACCESS_TOKEN not set — posting will fail.
              </p>
            )}
            {connections && platform === "facebook" && !connections.facebook && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> META_ACCESS_TOKEN / META_PAGE_ID not set — posting will fail.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
