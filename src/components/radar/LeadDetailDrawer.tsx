import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ExternalLink, Mail, Phone, MessageSquare, Search, Linkedin,
  MapPin, Briefcase, Building2, Copy, Globe, Printer, Send, Flag, Activity, StickyNote,
} from "lucide-react";
import { toastSuccess } from "@/lib/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import SignalStrengthBars from "./SignalStrengthBars";
import DossierPrintSheet from "./DossierPrintSheet";
import LeadStatusControl from "./LeadStatusControl";
import { useRadarLeadStatus } from "./useRadarLeadStatus";

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

type Channel = "email" | "sms" | "linkedin";

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

export default function LeadDetailDrawer({ lead, open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const [channel, setChannel] = useState<Channel>("email");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, [open, lead?.id]);

  if (!lead) return null;

  const company = lead.company_name;
  const loc = lead.location || "Michigan";

  const emailDraft = `Hi — I'm reaching out from a local supplier. I noticed ${company} ${
    lead.hiring_count ? `is currently hiring ${lead.hiring_count} ${lead.hiring_roles?.join("/") || "people"}` : "has been active recently"
  }${lead.predicted_needs?.length ? `, which usually means demand for ${lead.predicted_needs.slice(0, 2).join(" and ")}` : ""}. Worth a 5-minute call this week?`;
  const smsDraft = `Hi — saw ${company} is active in ${loc}. We supply ${lead.predicted_needs?.[0] || "industrial materials"} locally. 5-min call?`;
  const linkedInDraft = `Hi — saw ${company}'s recent activity in ${loc}. We work with similar teams on ${lead.predicted_needs?.[0] || "ops support"}. Open to connecting?`;

  const drafts: Record<Channel, string> = { email: emailDraft, sms: smsDraft, linkedin: linkedInDraft };
  const activeDraft = drafts[channel];

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toastSuccess("Copied to clipboard");
  };

  const sendToCRM = () => {
    // Best-effort: copies a JSON payload contractors can paste into HubSpot/etc.
    const payload = {
      company: lead.company_name,
      industry: lead.industry,
      location: lead.location,
      signal_type: lead.signal_type,
      signal_strength: lead.confidence,
      predicted_needs: lead.predicted_needs,
      source_urls: lead.source_urls,
      detected_at: lead.detected_at,
      lead_id: lead.id,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toastSuccess("Lead JSON copied — paste into your CRM");
  };

  const flagMailto = `mailto:matt@detroitwebagent.com?subject=${encodeURIComponent(`Incorrect data: ${company}`)}&body=${encodeURIComponent(`Lead ID: ${lead.id}\nCompany: ${company}\n\nWhat looked wrong:\n`)}`;

  const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  const linkedinSearch = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`;
  const decisionMakerSearch = googleSearch(`"${company}" (CEO OR President OR Owner OR "Procurement Manager") ${loc} contact email phone`);
  const competitorSearch = googleSearch(`"${company}" suppliers OR vendors site:linkedin.com OR site:zoominfo.com`);
  const reviewsSearch = googleSearch(`"${company}" ${loc} reviews`);
  const newsSearch = googleSearch(`"${company}" expansion OR funding OR contract OR award news`);

  const Body = (
    <>
      {/* Sticky action header */}
      <div className="sticky top-0 z-20 bg-[#0a1628] border-b border-white/10 px-4 py-3 flex items-center gap-2 print-hide">
        <Button
          size="sm"
          variant="outline"
          className="border-white/15 text-white hover:bg-white/5 h-8 px-2"
          onClick={() => window.open(googleSearch(`"${company}" phone number ${loc}`))}
          title="Find phone"
        >
          <Phone className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/15 text-white hover:bg-white/5 h-8 px-2"
          onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Quick question for ${company}`)}&body=${encodeURIComponent(emailDraft)}`)}
          title="Open email"
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/15 text-white hover:bg-white/5 h-8 px-2"
          onClick={() => { copy(window.location.href); }}
          title="Copy link"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          className="ml-auto bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold h-8"
          onClick={sendToCRM}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" /> Send to CRM
        </Button>
      </div>

      <div className="px-4 sm:px-6 py-5">
        {/* Identity strip */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-[#00d4ff]/15 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-[#00d4ff]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold truncate text-white">{company}</div>
            <div className="text-[11px] text-white/50 font-normal flex items-center gap-2 flex-wrap mt-0.5">
              {loc && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {loc}</span>}
              {lead.industry && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {lead.industry}</span>}
              <SignalStrengthBars value={lead.confidence} />
            </div>
          </div>
        </div>

        <Accordion type="single" collapsible defaultValue="dossier" className="w-full">
          {/* DOSSIER */}
          <AccordionItem value="dossier" className="border-white/10">
            <AccordionTrigger className="text-white hover:no-underline focus-visible:ring-2 focus-visible:ring-[#00d4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628] rounded">
              <span className="flex items-center justify-between w-full pr-2">
                <span className="text-sm font-bold">Dossier</span>
                <button
                  onClick={(e) => { e.stopPropagation(); window.print(); }}
                  className="text-[10px] text-[#00d4ff] hover:underline flex items-center gap-1 print-hide"
                  title="Print or save as PDF"
                >
                  <Printer className="h-3 w-3" /> Save as PDF
                </button>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full bg-white/5" />
                  <Skeleton className="h-4 w-3/4 bg-white/5" />
                  <Skeleton className="h-20 w-full bg-white/5" />
                </div>
              ) : (
                <>
                  {lead.hiring_count ? (
                    <div className="rounded-lg bg-[#00d4ff]/5 border border-[#00d4ff]/20 p-3">
                      <div className="text-[10px] uppercase text-[#00d4ff] font-bold mb-1">Hiring Signal</div>
                      <div className="text-sm text-white">Active for <strong>{lead.hiring_count}× {lead.hiring_roles?.join(", ") || "open roles"}</strong></div>
                    </div>
                  ) : null}

                  {lead.predicted_needs?.length ? (
                    <div>
                      <div className="text-[10px] uppercase text-white/40 font-bold mb-2">Predicted needs</div>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.predicted_needs.map((n, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded border border-[#00d4ff]/30 text-[#00d4ff]/85 bg-[#00d4ff]/5">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {lead.recommended_pitch && (
                    <div className="pl-3 border-l-2 border-[#00d4ff]/60">
                      <div className="text-[10px] uppercase text-amber-300 font-bold mb-2">Automated Intel</div>
                      <p className="text-[13px] text-white/85 leading-relaxed font-serif">{lead.recommended_pitch}</p>
                    </div>
                  )}

                  {lead.source_urls?.length ? (
                    <div>
                      <div className="text-[10px] uppercase text-white/40 font-bold mb-2">Source citations</div>
                      <div className="space-y-1.5">
                        {lead.source_urls.map((url, i) => {
                          const host = hostnameOf(url);
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-[#00d4ff] hover:underline"
                            >
                              <img
                                src={`https://s2.googleusercontent.com/s2/favicons?domain=${host}&sz=32`}
                                alt=""
                                className="w-3.5 h-3.5 shrink-0 rounded-sm"
                                loading="lazy"
                              />
                              <span className="truncate">{host}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* OUTREACH */}
          <AccordionItem value="outreach" className="border-white/10">
            <AccordionTrigger className="text-white hover:no-underline text-sm font-bold">Outreach</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="flex gap-1 p-1 rounded-lg bg-[#0f1f35] border border-white/10">
                {(["email", "sms", "linkedin"] as Channel[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`flex-1 text-[11px] uppercase tracking-wider font-bold py-1.5 rounded transition-colors ${
                      channel === c ? "bg-[#00d4ff] text-[#0a1628]" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="rounded-lg bg-[#0f1f35] border border-white/10 p-3 text-[13px] text-white/85 whitespace-pre-wrap">
                {activeDraft}
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 border-white/15 text-white hover:bg-white/5" onClick={() => copy(activeDraft)}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
                {channel === "email" && (
                  <Button
                    size="sm"
                    className="flex-1 bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold"
                    onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`Quick question for ${company}`)}&body=${encodeURIComponent(activeDraft)}`)}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" /> Open email
                  </Button>
                )}
                {channel === "sms" && (
                  <Button
                    size="sm"
                    className="flex-1 bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold"
                    onClick={() => window.open(`sms:?body=${encodeURIComponent(activeDraft)}`)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Open SMS
                  </Button>
                )}
                {channel === "linkedin" && (
                  <Button
                    size="sm"
                    className="flex-1 bg-[#0a66c2] hover:bg-[#0a66c2]/90 text-white font-bold"
                    onClick={() => window.open(linkedinSearch, "_blank", "noopener,noreferrer")}
                  >
                    <Linkedin className="h-3.5 w-3.5 mr-1.5" /> Find on LinkedIn
                  </Button>
                )}
              </div>

              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-amber-200/80">
                <strong>Tip:</strong> Reference the specific signal — open rates jump 3–5× when you cite the exact permit, hire, or news event.
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* CONTACTS */}
          <AccordionItem value="contacts" className="border-white/10">
            <AccordionTrigger className="text-white hover:no-underline text-sm font-bold">Contacts</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <ContactRow href={decisionMakerSearch} icon={<Search className="h-4 w-4 text-[#00d4ff]" />} title="Find decision-maker" sub="CEO / Owner / Procurement" />
              <ContactRow href={linkedinSearch} icon={<Linkedin className="h-4 w-4 text-[#0a66c2]" />} title="Find on LinkedIn" sub="Company page + employees" />
              <ContactRow href={googleSearch(`"${company}" phone number ${loc}`)} icon={<Phone className="h-4 w-4 text-emerald-400" />} title="Find phone" sub="Google + business directories" />
              <ContactRow href={googleSearch(`"${company}" official website`)} icon={<Globe className="h-4 w-4 text-purple-400" />} title="Find website" sub="Pull contact-us page" />
            </AccordionContent>
          </AccordionItem>

          {/* INTEL */}
          <AccordionItem value="intel" className="border-white/10">
            <AccordionTrigger className="text-white hover:no-underline text-sm font-bold">Intel</AccordionTrigger>
            <AccordionContent className="space-y-2">
              <ContactRow href={competitorSearch} icon={<Search className="h-4 w-4 text-[#00d4ff]" />} title="Competitor / vendor scan" sub="Who already supplies them" />
              <ContactRow href={reviewsSearch} icon={<Search className="h-4 w-4 text-amber-400" />} title="Reputation / reviews" sub="Google / Yelp / BBB" />
              <ContactRow href={newsSearch} icon={<Search className="h-4 w-4 text-emerald-400" />} title="Recent news" sub="Expansion, funding, contracts" />
              <ContactRow href={googleSearch(`"${company}" similar companies ${loc}`)} icon={<Search className="h-4 w-4 text-purple-400" />} title="Similar companies" sub="Find more like this" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-6 pt-4 border-t border-white/10 print-hide">
          <a
            href={flagMailto}
            className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-[#00d4ff] transition-colors"
          >
            <Flag className="h-3 w-3" /> Flag incorrect data →
          </a>
        </div>
      </div>

      {/* Print-only sheet */}
      <DossierPrintSheet lead={lead} />
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-[#0a1628] border-t border-[#1e3a5f] text-white max-h-[92vh] p-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{company}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">{Body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-[#0a1628] border-l border-[#1e3a5f] text-white p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{company}</SheetTitle>
        </SheetHeader>
        {Body}
      </SheetContent>
    </Sheet>
  );
}

function ContactRow({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f35] border border-white/10 hover:border-[#00d4ff]/40 transition-colors focus-visible:ring-2 focus-visible:ring-[#00d4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628] outline-none"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{title}</div>
          <div className="text-[11px] text-white/40 truncate">{sub}</div>
        </div>
      </div>
      <span className="text-[11px] text-white/50 flex items-center gap-1 shrink-0 ml-2">
        Open <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
}
