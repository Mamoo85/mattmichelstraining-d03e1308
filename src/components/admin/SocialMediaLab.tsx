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
import { Loader2, Wand2, Send, RefreshCw, Linkedin, Facebook, CheckCircle, AlertCircle, Copy, Edit3, Megaphone, Newspaper, Globe, PenTool, TrendingUp } from "lucide-react";

type ContentType = "social_post" | "gbp_post" | "newsletter_excerpt" | "blog_teaser" | "ad_copy" | "email_outreach";
type Platform = "linkedin" | "facebook";

const CONTENT_TYPES: { value: ContentType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "social_post", label: "Social Media Post", icon: <Megaphone className="h-3 w-3" />, desc: "LinkedIn/Facebook post for any business" },
  { value: "gbp_post", label: "Google Business Post", icon: <Globe className="h-3 w-3" />, desc: "GBP update — tips, offers, community" },
  { value: "newsletter_excerpt", label: "Newsletter Blurb", icon: <Newspaper className="h-3 w-3" />, desc: "Short newsletter-style content block" },
  { value: "blog_teaser", label: "Blog Post Teaser", icon: <PenTool className="h-3 w-3" />, desc: "Excerpt from an AI blog post" },
  { value: "ad_copy", label: "Ad Copy", icon: <TrendingUp className="h-3 w-3" />, desc: "Google/Facebook ad headline + body" },
  { value: "email_outreach", label: "Cold Outreach Email", icon: <Send className="h-3 w-3" />, desc: "B2B prospecting email for any service" },
];

const INDUSTRY_PRESETS = [
  "Web design & local marketing",
  "HVAC / Heating & Cooling",
  "Roofing",
  "Plumbing",
  "Dental practice",
  "Real estate",
  "Landscaping",
  "Auto repair / Mechanic",
  "Restaurant / Bar",
  "Law firm",
  "Insurance agency",
  "Fitness / Personal training",
  "Salon / Barbershop",
  "Accounting / Bookkeeping",
  "Electrical contractor",
];

const POST_TOPICS = [
  "General business update",
  "Industry tip / did-you-know",
  "Client success story",
  "Seasonal promotion",
  "New service announcement",
  "Community spotlight",
  "Behind the scenes",
  "FAQ / common question",
  "Before & after showcase",
  "Hiring / team update",
];

const VOICE_PRESETS = [
  "Friendly, direct, local-guy-who-gets-results",
  "Professional and authoritative",
  "Casual and fun",
  "Technical and detailed",
  "Warm and approachable",
  "Bold and confident",
];

export default function SocialMediaLab() {
  const { toast } = useToast();
  const [contentType, setContentType] = useState<ContentType>("social_post");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [businessName, setBusinessName] = useState("M2 Development");
  const [businessType, setBusinessType] = useState("Web design & local marketing");
  const [city, setCity] = useState("Grosse Pointe, MI");
  const [brandVoice, setBrandVoice] = useState("Friendly, direct, local-guy-who-gets-results");
  const [postTopic, setPostTopic] = useState("General business update");
  const [contentFocus, setContentFocus] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  const [generatedPost, setGeneratedPost] = useState("");
  const [editablePost, setEditablePost] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [connections, setConnections] = useState<{ linkedin: boolean; facebook: boolean; ai: boolean } | null>(null);
  const [history, setHistory] = useState<{ type: ContentType; platform: Platform; content: string; posted: boolean; ts: string }[]>([]);

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
          contentType,
          platform,
          businessName,
          businessType,
          city,
          brandVoice,
          postTopic,
          contentFocus,
          targetAudience: targetAudience.trim() || undefined,
          customPrompt: customPrompt.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setGeneratedPost(data.content);
      setEditablePost(data.content);
      toast({ title: "Content generated!", description: `${CONTENT_TYPES.find(c => c.value === contentType)?.label} ready for review.` });
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
        body: { action: "post", platform, postContent: editablePost.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPosted(true);
      setHistory(prev => [{ type: contentType, platform, content: editablePost, posted: true, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
      toast({ title: `Posted to ${platform === "linkedin" ? "LinkedIn" : "Facebook"}!`, description: "Check your feed." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Post failed", description: msg, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editablePost);
    setHistory(prev => [{ type: contentType, platform, content: editablePost, posted: false, ts: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
    toast({ title: "Copied to clipboard" });
  };

  const canPost = contentType === "social_post" || contentType === "gbp_post" || contentType === "blog_teaser";

  return (
    <Card className="bg-slate-900 border-orange-500/30 border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-orange-500" />
            Content Command Center
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
          Generate any content type for any industry → edit it → post to LinkedIn/Facebook or copy. Test exactly what customers receive.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Content type selector */}
        <div className="space-y-1">
          <Label className="text-slate-300 text-xs font-semibold">Content Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CONTENT_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setContentType(ct.value)}
                className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                  contentType === ct.value
                    ? "border-orange-500 bg-orange-500/10 text-white"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-1.5 font-semibold mb-0.5">{ct.icon} {ct.label}</span>
                <span className="text-[10px] opacity-70 leading-tight block">{ct.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Config fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {canPost && (
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Post To</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
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
          )}
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Business Name</Label>
            <Input value={businessName} onChange={e => setBusinessName(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Industry</Label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 max-h-[240px]">
                {INDUSTRY_PRESETS.map(i => (
                  <SelectItem key={i} value={i} className="text-white text-sm">{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">City</Label>
            <Input value={city} onChange={e => setCity(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Brand Voice</Label>
            <Select value={brandVoice} onValueChange={setBrandVoice}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {VOICE_PRESETS.map(v => (
                  <SelectItem key={v} value={v} className="text-white text-sm">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Post Topic</Label>
            <Select value={postTopic} onValueChange={setPostTopic}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 max-h-[240px]">
                {POST_TOPICS.map(t => (
                  <SelectItem key={t} value={t} className="text-white text-sm">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Content Focus (optional)</Label>
            <Input value={contentFocus} onChange={e => setContentFocus(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" placeholder="e.g. spring specials, new service" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Target Audience (optional)</Label>
            <Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="bg-slate-800 border-slate-600 text-white h-9 text-sm" placeholder="e.g. homeowners, business owners" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-slate-300 text-xs">Custom Prompt Override (replaces all above)</Label>
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
            <><Wand2 className="h-4 w-4 mr-2" /> Generate {CONTENT_TYPES.find(c => c.value === contentType)?.label}</>
          )}
        </Button>

        {/* Preview / Edit area */}
        {generatedPost && (
          <div className="space-y-3 pt-3 border-t border-slate-700">
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
              className="bg-slate-800 border-slate-600 text-white text-sm min-h-[120px]"
            />
            <p className="text-slate-500 text-[10px] text-right">{editablePost.length} chars</p>

            <div className="flex items-center gap-3">
              {canPost && (
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
                    <><Send className="h-4 w-4 mr-2" /> Post to {platform === "linkedin" ? "LinkedIn" : "Facebook"}</>
                  )}
                </Button>
              )}
              {!canPost && (
                <Button onClick={handleCopy} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white">
                  <Copy className="h-4 w-4 mr-2" /> Copy to Clipboard
                </Button>
              )}
              {posted && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" /> Live
                </Badge>
              )}
            </div>
            {connections && canPost && platform === "linkedin" && !connections.linkedin && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> LINKEDIN_ACCESS_TOKEN not set — posting will fail.
              </p>
            )}
            {connections && canPost && platform === "facebook" && !connections.facebook && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> META_ACCESS_TOKEN / META_PAGE_ID not set — posting will fail.
              </p>
            )}
          </div>
        )}

        {/* Session history */}
        {history.length > 0 && (
          <div className="pt-3 border-t border-slate-700">
            <Label className="text-slate-400 text-xs font-semibold block mb-2">Session History</Label>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5 text-xs">
                  <span className="text-slate-300 truncate flex-1 mr-2">{h.content.slice(0, 60)}…</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px] py-0 h-5 border-slate-600 text-slate-400">
                      {CONTENT_TYPES.find(c => c.value === h.type)?.label?.split(" ")[0]}
                    </Badge>
                    {h.posted ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] py-0 h-5">
                        Posted
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-600/30 text-slate-400 border-slate-600 text-[10px] py-0 h-5">
                        Copied
                      </Badge>
                    )}
                    <span className="text-slate-500 text-[10px]">{h.ts}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
