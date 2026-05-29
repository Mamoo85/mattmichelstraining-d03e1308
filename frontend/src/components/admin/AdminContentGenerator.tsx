import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Copy, Check, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TRADES = [
  "Roofing", "HVAC", "Plumbing", "Electrical", "Landscaping",
  "Auto Repair", "Pest Control", "Painting", "Flooring", "Cleaning Services",
  "General Contracting", "Pool Service", "Tree Service", "Appliance Repair",
];

interface SwipeFiles {
  emails: string[];
  linkedin: string[];
  sms: string[];
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg border border-slate-700 bg-slate-900 p-4">
      <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed pr-8">{text}</pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function SkeletonBox() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2 animate-pulse">
      <div className="h-3 bg-slate-700 rounded w-full" />
      <div className="h-3 bg-slate-700 rounded w-5/6" />
      <div className="h-3 bg-slate-700 rounded w-4/6" />
    </div>
  );
}

const AdminContentGenerator = memo(() => {
  const [trade, setTrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SwipeFiles | null>(null);

  const handleGenerate = async () => {
    if (!trade) { toast.error("Select a trade first"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-affiliate-swipe", {
        body: { trade },
      });
      if (error) throw error;
      setResult(data as SwipeFiles);
      toast.success(`Swipe files generated for ${trade}`);
    } catch (err) {
      toast.error("Generation failed. Check Supabase logs.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#e8621a]/10 flex items-center justify-center">
          <Users size={18} className="text-[#e8621a]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Affiliate Swipe File Generator</h2>
          <p className="text-sm text-slate-400">Generate ready-made outreach copy for your referral partners</p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Select value={trade} onValueChange={setTrade}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white w-64">
                <SelectValue placeholder="Select a trade..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {TRADES.map((t) => (
                  <SelectItem key={t} value={t} className="text-white hover:bg-slate-700">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleGenerate}
              disabled={loading || !trade}
              className="bg-[#e8621a] hover:bg-[#d4551a] text-white font-semibold"
            >
              {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
              {loading ? "Generating..." : "Generate Swipe Files"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(loading || result) && (
        <Tabs defaultValue="emails" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="emails" className="data-[state=active]:bg-[#e8621a] data-[state=active]:text-white text-slate-400">
              Cold Emails
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="data-[state=active]:bg-[#e8621a] data-[state=active]:text-white text-slate-400">
              LinkedIn Posts
            </TabsTrigger>
            <TabsTrigger value="sms" className="data-[state=active]:bg-[#e8621a] data-[state=active]:text-white text-slate-400">
              SMS Scripts
            </TabsTrigger>
          </TabsList>

          {(["emails", "linkedin", "sms"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                {tab === "emails" ? "3 Cold Email Templates" : tab === "linkedin" ? "3 LinkedIn Posts" : "3 SMS Scripts"}
                {trade && ` \u2014 ${trade}`}
              </p>
              {loading
                ? [0, 1, 2].map((i) => <SkeletonBox key={i} />)
                : result?.[tab].map((text, i) => (
                    <div key={i}>
                      <p className="text-xs text-slate-500 mb-1.5">Template {i + 1}</p>
                      <CopyBox text={text} />
                    </div>
                  ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {!loading && !result && (
        <div className="rounded-lg border border-dashed border-slate-700 py-16 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-slate-600" />
          <p className="text-slate-500 text-sm">Select a trade and click Generate to create 9 pieces of outreach copy</p>
          <p className="text-slate-600 text-xs mt-1">3 cold emails &middot; 3 LinkedIn posts &middot; 3 SMS scripts</p>
        </div>
      )}
    </div>
  );
});

AdminContentGenerator.displayName = "AdminContentGenerator";
export default AdminContentGenerator;
