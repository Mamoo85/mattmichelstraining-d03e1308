/**
 * AdminPostcardCampaigns — DWA Admin tab
 * View scraped prospects, generate AI copy, preview postcards,
 * send via Lob, track conversions.
 * 5 audience types × 9 Michigan regions. All powered by existing Lob integration.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, RefreshCw, FileText, BarChart3, Users, MapPin } from "lucide-react";

type AudienceType = "healthcare-agency" | "trades-agency" | "nursing-home" | "contractor" | "supply-house";

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; color: string }[] = [
  { value: "healthcare-agency", label: "Healthcare Staffing Agency", color: "text-emerald-400" },
  { value: "trades-agency", label: "Trades Staffing Agency", color: "text-blue-400" },
  { value: "nursing-home", label: "Nursing Home / Facility", color: "text-emerald-400" },
  { value: "contractor", label: "HVAC / Plumbing / Electrical", color: "text-blue-400" },
  { value: "supply-house", label: "Supply House / Distributor", color: "text-cyan-400" },
];

const COUNTIES = ["Wayne", "Oakland", "Macomb", "Kent", "Ingham", "Washtenaw", "Genesee", "Kalamazoo", "Grand Traverse", "Saginaw", "Muskegon"];

export default function AdminPostcardCampaigns() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState("Wayne");
  const [selectedAudience, setSelectedAudience] = useState<AudienceType>("healthcare-agency");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, c, cv] = await Promise.all([
      supabase.from("postcard_prospects" as any).select("*").order("created_at", { ascending: false }).limit(500),
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
    toast.info("Running business scraper...");
    const { data, error } = await supabase.functions.invoke("lara-business-scraper");
    setScraping(false);
    if (error) { toast.error("Scraper failed: " + error.message); }
    else { toast.success(`${data?.new_prospects || 0} new prospects found`); loadData(); }
  };

  const generateCopy = async () => {
    setGenerating(true);
    toast.info(`Generating ${selectedAudience} copy for ${selectedCounty} County...`);
    const { data, error } = await supabase.functions.invoke("generate-postcard-copy", {
      body: { county: selectedCounty, audience_type: selectedAudience },
    });
    setGenerating(false);
    if (error) { toast.error("Copy generation failed: " + error.message); }
    else { toast.success(`${data?.variants?.length || 1} copy variant(s) generated`); loadData(); }
  };

  const sendPostcards = async (campaignId: string) => {
    setSending(campaignId);
    toast.info("Sending postcards via Lob...");
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: { campaign_id: campaignId },
    });
    setSending(null);
    if (error) { toast.error("Send failed: " + error.message); }
    else { toast.success(`${data?.sent || 0} postcards sent! Audience: ${data?.audience || "unknown"}`); loadData(); }
  };

  const totalSent = campaigns.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0);
  const totalConversions = conversions.filter((c: any) => c.event === "paid").length;
  const prospectsByCounty = (county: string) => prospects.filter((p: any) => p.county?.toLowerCase() === county.toLowerCase());
  const unsentByCounty = (county: string) => prospects.filter((p: any) => p.county?.toLowerCase() === county.toLowerCase() && !p.postcard_sent_at && p.address_line1);

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-[#00d4ff]" />
            <div>
              <div className="text-2xl font-bold text-white">{prospects.length}</div>
              <div className="text-[10px] text-gray-400 uppercase">Total Prospects</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-green-400" />
            <div>
              <div className="text-2xl font-bold text-white">{campaigns.length}</div>
              <div className="text-[10px] text-gray-400 uppercase">Campaigns</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-5 w-5 text-orange-400" />
            <div>
              <div className="text-2xl font-bold text-white">{totalSent}</div>
              <div className="text-[10px] text-gray-400 uppercase">Cards Sent via Lob</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            <div>
              <div className="text-2xl font-bold text-white">{totalConversions}</div>
              <div className="text-[10px] text-gray-400 uppercase">Conversions</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">Audience Type</label>
            <select value={selectedAudience} onChange={e => setSelectedAudience(e.target.value as AudienceType)} className="px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-white text-sm min-w-[200px]">
              {AUDIENCE_OPTIONS.map(a => <option key={a.value} value={a.value} className="bg-gray-900">{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/30 text-[10px] uppercase tracking-wide font-semibold block mb-1">County</label>
            <select value={selectedCounty} onChange={e => setSelectedCounty(e.target.value)} className="px-3 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-white text-sm">
              {COUNTIES.map(c => <option key={c} value={c} className="bg-gray-900">{c} County</option>)}
            </select>
          </div>
          <Button onClick={runScraper} disabled={scraping} size="sm" className="bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30">
            <RefreshCw className={`w-3 h-3 mr-1 ${scraping ? "animate-spin" : ""}`} /> {scraping ? "Scraping..." : "Run Scraper"}
          </Button>
          <Button onClick={generateCopy} disabled={generating} size="sm" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
            <FileText className="w-3 h-3 mr-1" /> {generating ? "Generating..." : "Generate Copy"}
          </Button>
        </div>
        <p className="text-white/20 text-[10px]">
          {unsentByCounty(selectedCounty).length} prospects ready to mail in {selectedCounty} County
          &middot; Design: Matt's photo + "I'll call you personally" + QR to /staffing
          &middot; Powered by Lob API
        </p>
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
            {COUNTIES.map(county => {
              const cp = prospectsByCounty(county);
              const unsent = unsentByCounty(county);
              if (cp.length === 0) return null;
              return (
                <Card key={county} className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex justify-between items-center">
                      <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#00d4ff]" /> {county} County</span>
                      <span className="text-xs text-gray-400">{cp.length} total &middot; <span className="text-emerald-400">{unsent.length} ready</span></span>
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
                          <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                            <td className="p-1 font-medium text-white/80">{p.business_name}</td>
                            <td className="p-1 text-gray-400">{p.city || "—"}</td>
                            <td className="p-1 text-gray-400">{(p.license_types || []).join(", ") || "—"}</td>
                            <td className="p-1">
                              {p.postcard_sent_at ? (
                                <Badge variant="secondary" className="text-[10px] bg-emerald-500/20 text-emerald-400">Sent</Badge>
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
            {prospects.length === 0 && (
              <p className="text-gray-500 text-center py-8">No prospects yet. Run the scraper to find businesses.</p>
            )}
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <div className="space-y-3">
            {campaigns.map((c: any) => (
              <Card key={c.id} className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#00d4ff]/20 text-[#00d4ff] text-xs">{c.county} County</Badge>
                      {c.audience_type && <Badge variant="outline" className="text-xs">{c.audience_type}</Badge>}
                      <Badge variant="outline" className={`text-xs ${c.status === "mailed" ? "border-emerald-500 text-emerald-400" : "border-white/20"}`}>{c.status}</Badge>
                    </div>
                    <div className="text-xs text-gray-400">
                      {c.sent_count || 0} sent &middot; {c.conversion_count || 0} conversions
                    </div>
                  </div>
                  {c.copy_front && (
                    <div className="mb-2">
                      <span className="text-[10px] text-white/30 uppercase">Front: </span>
                      <span className="text-sm text-white/70">{c.copy_front}</span>
                    </div>
                  )}
                  {c.copy_back && (
                    <div className="mb-2">
                      <span className="text-[10px] text-white/30 uppercase">Body: </span>
                      <span className="text-xs text-white/50">{c.copy_back?.substring(0, 150)}...</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-3">QR → {c.qr_url}</div>
                  {c.status === "draft" && (
                    <Button size="sm" onClick={() => sendPostcards(c.id)} disabled={sending === c.id} className="bg-emerald-500 text-white hover:bg-emerald-600">
                      <Send className="w-3 h-3 mr-1" /> {sending === c.id ? "Sending..." : "Send via Lob"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {campaigns.length === 0 && (
              <p className="text-gray-500 text-center py-8">No campaigns yet. Select audience + county and generate copy.</p>
            )}
          </div>
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions">
          <div className="space-y-2">
            {conversions.map((cv: any) => (
              <div key={cv.id} className="flex justify-between items-center bg-white/5 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={cv.event === "paid" ? "bg-green-500/20 text-green-400" : cv.event === "checkout_started" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}>
                    {cv.event === "paid" ? "Paid" : cv.event === "checkout_started" ? "Checkout" : "QR Scan"}
                  </Badge>
                  <span className="text-gray-400">{cv.county || "—"} County</span>
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
