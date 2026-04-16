/**
 * AdminPostcardCampaigns — DWA Admin tab
 * View scraped prospects, generate AI copy, preview postcards,
 * send via Lob, track conversions.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPostcardCampaigns() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState("Macomb");

  const counties = ["Macomb", "Wayne", "Oakland"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, c, cv] = await Promise.all([
      supabase.from("postcard_prospects" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("postcard_campaigns" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("postcard_conversions" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setProspects((p.data as any[]) || []);
    setCampaigns((c.data as any[]) || []);
    setConversions((cv.data as any[]) || []);
    setLoading(false);
  };

  const runScraper = async () => {
    setScraping(true);
    toast.info("🔍 Running LARA business scraper...");
    const { data, error } = await supabase.functions.invoke("lara-business-scraper");
    setScraping(false);
    if (error) {
      toast.error("Scraper failed: " + error.message);
    } else {
      toast.success(`✅ ${data?.new_prospects || 0} new prospects found`);
      loadData();
    }
  };

  const generateCopy = async () => {
    setGenerating(true);
    toast.info(`✍️ Generating postcard copy for ${selectedCounty} County...`);
    const { data, error } = await supabase.functions.invoke("generate-postcard-copy", {
      body: { county: selectedCounty },
    });
    setGenerating(false);
    if (error) {
      toast.error("Copy generation failed: " + error.message);
    } else {
      toast.success(`✅ ${data?.variants?.length || 0} copy variants generated`);
      loadData();
    }
  };

  const sendPostcards = async (campaignId: string) => {
    setSending(campaignId);
    toast.info("📬 Sending postcards via Lob...");
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: { campaign_id: campaignId },
    });
    setSending(null);
    if (error) {
      toast.error("Send failed: " + error.message);
    } else {
      toast.success(`✅ ${data?.sent || 0} postcards sent!`);
      loadData();
    }
  };

  const prospectsByCounty = (county: string) =>
    prospects.filter((p: any) => p.county?.toLowerCase() === county.toLowerCase());

  const unsentByCounty = (county: string) =>
    prospects.filter((p: any) => p.county?.toLowerCase() === county.toLowerCase() && !p.postcard_sent_at && p.address_line1);

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#00d4ff]">{prospects.length}</div>
            <div className="text-xs text-gray-400">Total Prospects</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{campaigns.length}</div>
            <div className="text-xs text-gray-400">Campaigns</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-400">
              {campaigns.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0)}
            </div>
            <div className="text-xs text-gray-400">Cards Sent</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {conversions.filter((c: any) => c.event === "paid").length}
            </div>
            <div className="text-xs text-gray-400">Conversions</div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={runScraper} disabled={scraping} variant="outline" className="border-[#00d4ff] text-[#00d4ff]">
          {scraping ? "Scraping..." : "🔍 Run LARA Scraper"}
        </Button>
        <select
          value={selectedCounty}
          onChange={e => setSelectedCounty(e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
        >
          {counties.map(c => (
            <option key={c} value={c} className="bg-gray-900">{c} County</option>
          ))}
        </select>
        <Button onClick={generateCopy} disabled={generating} variant="outline" className="border-green-500 text-green-400">
          {generating ? "Generating..." : "✍️ Generate Copy"}
        </Button>
      </div>

      <Tabs defaultValue="prospects" className="w-full">
        <TabsList className="bg-white/5">
          <TabsTrigger value="prospects">Prospects ({prospects.length})</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns ({campaigns.length})</TabsTrigger>
          <TabsTrigger value="conversions">Conversions ({conversions.length})</TabsTrigger>
        </TabsList>

        {/* Prospects Tab */}
        <TabsContent value="prospects">
          <div className="space-y-2">
            {counties.map(county => {
              const cp = prospectsByCounty(county);
              const unsent = unsentByCounty(county);
              if (cp.length === 0) return null;
              return (
                <Card key={county} className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex justify-between items-center">
                      <span>{county} County</span>
                      <span className="text-xs text-gray-400">{cp.length} total · {unsent.length} ready to mail</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left p-1">Business</th>
                          <th className="text-left p-1">City</th>
                          <th className="text-left p-1">License</th>
                          <th className="text-left p-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cp.slice(0, 30).map((p: any) => (
                          <tr key={p.id} className="border-t border-white/5">
                            <td className="p-1 font-medium">{p.business_name}</td>
                            <td className="p-1 text-gray-400">{p.city || "—"}</td>
                            <td className="p-1 text-gray-400">{(p.license_types || []).join(", ") || "—"}</td>
                            <td className="p-1">
                              {p.postcard_sent_at ? (
                                <Badge variant="secondary" className="text-[10px]">📬 Sent</Badge>
                              ) : p.address_line1 ? (
                                <Badge variant="outline" className="text-[10px] border-green-500 text-green-400">Ready</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-400">No Address</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <div className="space-y-3">
            {campaigns.map((c: any) => (
              <Card key={c.id} className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <Badge className="bg-[#00d4ff]/20 text-[#00d4ff] text-xs">{c.county} County</Badge>
                      <Badge variant="outline" className="ml-2 text-xs">{c.status}</Badge>
                    </div>
                    <div className="text-xs text-gray-400">
                      {c.sent_count || 0} sent · {c.conversion_count || 0} conversions
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-sm font-bold text-[#00d4ff] mb-1">FRONT:</div>
                    <p className="text-sm text-gray-300">{c.copy_front}</p>
                  </div>
                  <div className="mb-3">
                    <div className="text-sm font-bold text-green-400 mb-1">BACK:</div>
                    <p className="text-sm text-gray-300">{c.copy_back}</p>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">QR → {c.qr_url}</div>
                  {c.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => sendPostcards(c.id)}
                      disabled={sending === c.id}
                      className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00b8d9]"
                    >
                      {sending === c.id ? "Sending..." : "📬 Send Postcards via Lob"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {campaigns.length === 0 && (
              <p className="text-gray-500 text-center py-8">No campaigns yet. Generate copy first.</p>
            )}
          </div>
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions">
          <div className="space-y-2">
            {conversions.map((cv: any) => (
              <div key={cv.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 text-sm">
                <div>
                  <Badge className={
                    cv.event === "paid" ? "bg-green-500/20 text-green-400" :
                    cv.event === "checkout_started" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-blue-500/20 text-blue-400"
                  }>
                    {cv.event === "paid" ? "💰 Paid" : cv.event === "checkout_started" ? "🛒 Checkout" : "📱 QR Scan"}
                  </Badge>
                  <span className="ml-2 text-gray-400">{cv.county || "—"} County</span>
                </div>
                <span className="text-xs text-gray-500">{new Date(cv.created_at).toLocaleString()}</span>
              </div>
            ))}
            {conversions.length === 0 && (
              <p className="text-gray-500 text-center py-8">No conversions yet. Send postcards first.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
