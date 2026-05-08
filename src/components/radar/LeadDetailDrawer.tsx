import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ExternalLink, Mail, Phone, MessageSquare, Search, Linkedin,
  MapPin, Briefcase, Building2, Copy, Check, Sparkles, Globe,
} from "lucide-react";
import { toastSuccess } from "@/lib/toast";

export interface LeadDetail {
  id: string;
  company_name: string;
  location?: string | null;
  industry?: string | null;
  signal_type?: string;
  confidence?: number;
  recommended_pitch?: string | null;
  hiring_count?: number;
  hiring_roles?: string[];
  predicted_needs?: string[];
  source_urls?: string[];
  detected_at?: string;
}

interface Props {
  lead: LeadDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function LeadDetailDrawer({ lead, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { if (!open) setCopied(null); }, [open]);

  if (!lead) return null;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toastSuccess("Copied");
    setTimeout(() => setCopied(null), 1200);
  };

  const company = lead.company_name;
  const loc = lead.location || "Michigan";
  const emailDraft = `Hi — I'm reaching out from a local supplier. I noticed ${company} ${
    lead.hiring_count ? `is currently hiring ${lead.hiring_count} ${lead.hiring_roles?.join("/") || "people"}` : "has been active recently"
  }${lead.predicted_needs?.length ? `, which usually means demand for ${lead.predicted_needs.slice(0, 2).join(" and ")}` : ""}. Worth a 5-minute call this week?`;

  const smsDraft = `Hi — saw ${company} is active in ${loc}. We supply ${lead.predicted_needs?.[0] || "industrial materials"} locally. 5-min call?`;

  const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const linkedinSearch = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`;
  const decisionMakerSearch = googleSearch(`"${company}" (CEO OR President OR Owner OR "Procurement Manager") ${loc} contact email phone`);
  const competitorSearch = googleSearch(`"${company}" suppliers OR vendors site:linkedin.com OR site:zoominfo.com`);
  const reviewsSearch = googleSearch(`"${company}" ${loc} reviews`);
  const newsSearch = googleSearch(`"${company}" expansion OR funding OR contract OR award news`);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-[#0a1628] border-l border-[#1e3a5f] text-white p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-white/10 sticky top-0 bg-[#0a1628] z-10">
          <SheetTitle className="text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00d4ff]/15 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold truncate">{company}</div>
                <div className="text-[11px] text-white/50 font-normal flex items-center gap-2 flex-wrap">
                  {loc && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {loc}</span>}
                  {lead.industry && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {lead.industry}</span>}
                  {typeof lead.confidence === "number" && (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                      {lead.confidence}/10
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 py-5">
          <Tabs defaultValue="dossier" className="w-full">
            <TabsList className="grid grid-cols-4 bg-[#0f1f35] border border-white/5 mb-4">
              <TabsTrigger value="dossier" className="text-xs">Dossier</TabsTrigger>
              <TabsTrigger value="outreach" className="text-xs">Outreach</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
              <TabsTrigger value="intel" className="text-xs">Intel</TabsTrigger>
            </TabsList>

            {/* DOSSIER */}
            <TabsContent value="dossier" className="space-y-4 mt-0">
              {lead.hiring_count ? (
                <div className="rounded-lg bg-[#00d4ff]/5 border border-[#00d4ff]/20 p-3">
                  <div className="text-[10px] uppercase text-[#00d4ff] font-bold mb-1">Hiring Signal</div>
                  <div className="text-sm">Active for <strong>{lead.hiring_count}× {lead.hiring_roles?.join(", ") || "open roles"}</strong></div>
                </div>
              ) : null}

              {lead.predicted_needs?.length ? (
                <div>
                  <div className="text-[10px] uppercase text-white/40 font-bold mb-2">Predicted needs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.predicted_needs.map((n, i) => (
                      <Badge key={i} variant="outline" className="border-[#00d4ff]/30 text-[#00d4ff]/80 bg-[#00d4ff]/5 text-[10px]">
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {lead.recommended_pitch && (
                <div className="rounded-lg bg-[#0f1f35] border border-white/10 p-4">
                  <div className="text-[10px] uppercase text-amber-300 font-bold mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI-recommended angle
                  </div>
                  <p className="text-[13px] text-white/80 leading-relaxed italic">{lead.recommended_pitch}</p>
                </div>
              )}

              {lead.source_urls?.length ? (
                <div>
                  <div className="text-[10px] uppercase text-white/40 font-bold mb-2">Source citations</div>
                  <div className="space-y-1.5">
                    {lead.source_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-[#00d4ff] hover:underline truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            {/* OUTREACH */}
            <TabsContent value="outreach" className="space-y-4 mt-0">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase text-white/40 font-bold">Email draft</span>
                  <button
                    onClick={() => copy(emailDraft, "email")}
                    className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1"
                  >
                    {copied === "email" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === "email" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="rounded-lg bg-[#0f1f35] border border-white/10 p-3 text-[13px] text-white/80 whitespace-pre-wrap">
                  {emailDraft}
                </div>
                <Button
                  size="sm"
                  className="w-full mt-2 bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold"
                  onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Quick question for ${company}`)}&body=${encodeURIComponent(emailDraft)}`)}
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Open in email
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase text-white/40 font-bold">SMS draft</span>
                  <button
                    onClick={() => copy(smsDraft, "sms")}
                    className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1"
                  >
                    {copied === "sms" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === "sms" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="rounded-lg bg-[#0f1f35] border border-white/10 p-3 text-[13px] text-white/80">
                  {smsDraft}
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-amber-200/80">
                <strong>Tip:</strong> Reference the specific signal — open rates jump 3–5× when you cite the exact permit, hire, or news event.
              </div>
            </TabsContent>

            {/* CONTACTS */}
            <TabsContent value="contacts" className="space-y-3 mt-0">
              <p className="text-[12px] text-white/60">One-click searches to find the right person fast:</p>

              <a href={decisionMakerSearch} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Search className="h-4 w-4 text-[#00d4ff]" /> Find decision-maker
                  </div>
                  <div className="text-[11px] text-white/40">CEO / Owner / Procurement</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>

              <a href={linkedinSearch} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#0a66c2]/60 transition-colors">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-[#0a66c2]" /> Find on LinkedIn
                  </div>
                  <div className="text-[11px] text-white/40">Company page + employees</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>

              <a href={googleSearch(`"${company}" phone number ${loc}`)} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-400" /> Find phone
                  </div>
                  <div className="text-[11px] text-white/40">Google + business directories</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>

              <a href={googleSearch(`"${company}" official website`)} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-purple-400" /> Find website
                  </div>
                  <div className="text-[11px] text-white/40">Pull contact-us page</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>
            </TabsContent>

            {/* INTEL */}
            <TabsContent value="intel" className="space-y-3 mt-0">
              <a href={competitorSearch} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold">Competitor / vendor scan</div>
                  <div className="text-[11px] text-white/40">Who already supplies them</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>

              <a href={reviewsSearch} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold">Reputation / reviews</div>
                  <div className="text-[11px] text-white/40">Google / Yelp / BBB</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>

              <a href={newsSearch} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold">Recent news</div>
                  <div className="text-[11px] text-white/40">Expansion, funding, contracts</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>

              <a href={googleSearch(`"${company}" similar companies ${loc}`)} target="_blank" rel="noreferrer"
                 className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors">
                <div>
                  <div className="text-sm font-semibold">Similar companies</div>
                  <div className="text-[11px] text-white/40">Find more like this</div>
                </div>
                <ExternalLink className="h-4 w-4 text-white/40" />
              </a>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
