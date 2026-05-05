import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INDUSTRIES = ["Roofing", "HVAC", "Plumbing", "Electrical", "Pest Control", "Gutters", "Landscaping", "General Contractor", "Other"];

export default function MyDeadLeadReactivation() {
  const { user } = useAuth();
  const [industry, setIndustry] = useState("");
  const [listSize, setListSize] = useState("100");
  const [campaignName, setCampaignName] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ["dead_lead_campaigns", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data: contractor } = await (supabase as any)
        .from("contractor_clients")
        .select("id")
        .ilike("email", user!.email!)
        .maybeSingle();

      if (!contractor) return [];

      const { data } = await (supabase as any)
        .from("dead_lead_campaigns")
        .select(`
          id, campaign_name, industry, status, created_at,
          dead_lead_contacts(count),
          dead_lead_charges(reply_verified, amount_cents)
        `)
        .eq("contractor_id", contractor.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const startCampaign = async () => {
    if (!user?.email || !industry) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-dead-lead-campaign-checkout", {
        body: {
          email: user.email,
          list_size: Number(listSize),
          industry,
          campaign_name: campaignName || `${industry} Re-engagement`,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      alert(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Dead Lead Reactivation</h1>
        <p className="text-slate-400">Re-engage your old leads with AI-powered SMS. Pay only $50 per positive reply.</p>
      </div>

      {/* Stats summary */}
      {campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#162236] border-slate-700">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-cyan-400">{campaigns.length}</div>
              <div className="text-xs text-slate-400 mt-1">Campaigns</div>
            </CardContent>
          </Card>
          <Card className="bg-[#162236] border-slate-700">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {campaigns.reduce((s: number, c: any) => s + (c.dead_lead_charges?.filter((ch: any) => ch.reply_verified).length || 0), 0)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total Replies</div>
            </CardContent>
          </Card>
          <Card className="bg-[#162236] border-slate-700">
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-purple-400">
                ${campaigns.reduce((s: number, c: any) => s + (c.dead_lead_charges?.reduce((cs: number, ch: any) => cs + (ch.amount_cents || 0), 0) || 0), 0) / 100}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total Spent</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaign list */}
      {campaigns && campaigns.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold text-white">Your Campaigns</h2>
          {campaigns.map((c: any) => {
            const replies = c.dead_lead_charges?.filter((ch: any) => ch.reply_verified).length || 0;
            const spent = c.dead_lead_charges?.reduce((s: number, ch: any) => s + (ch.amount_cents || 0), 0) / 100 || 0;
            const contacts = c.dead_lead_contacts?.[0]?.count || 0;
            return (
              <Card key={c.id} className="bg-[#162236] border-slate-700">
                <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-white font-medium">{c.campaign_name}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{c.industry} · {contacts} contacts · Started {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-400">{replies}</div>
                      <div className="text-xs text-slate-400">Replies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-yellow-400">${spent}</div>
                      <div className="text-xs text-slate-400">Spent</div>
                    </div>
                    <Badge className={
                      c.status === "active" ? "bg-green-900 text-green-300" :
                      c.status === "complete" ? "bg-slate-700 text-slate-300" :
                      "bg-yellow-900 text-yellow-300"
                    }>
                      {c.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New campaign form */}
      <Card className="bg-[#162236] border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">Start a New Campaign</CardTitle>
          <p className="text-slate-400 text-sm">Upload your old lead list and we'll text them all. You pay $50 per reply.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Your Trade / Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select your trade…" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i} className="text-slate-300">{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Number of Leads in Your List</Label>
              <Input
                type="number"
                value={listSize}
                onChange={(e) => setListSize(e.target.value)}
                min={1}
                max={10000}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="e.g. 200"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Campaign Name (optional)</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder={`${industry || "Trade"} Re-engagement 2026`}
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="bg-[#1e2d45] rounded-lg p-3 text-sm text-slate-400">
            <strong className="text-white">How it works:</strong> You upload your list of old leads (CSV). We send them a personalized AI text.
            When a lead replies with interest, you're charged $50 and we notify you immediately.
            No reply = no charge. Average campaign returns 5–20 replies.
          </div>
          <Button
            onClick={startCampaign}
            disabled={!industry || loading}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-11"
          >
            {loading ? "Redirecting to checkout…" : "Start Campaign — $0 Setup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
