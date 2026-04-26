import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHelpCard } from "./AdminHelpCard";
import { getAdminGuide } from "@/lib/admin-guides";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, Clock, Building2, Mail, DollarSign } from "lucide-react";

const INTERNAL_EMAILS = ["matt@mattmichelstraining.com", "matt@mattmichelstraining.com", "matthewmichels4@gmail.com"];
const isInternalEmail = (email: string) => INTERNAL_EMAILS.includes(email?.toLowerCase());

// Parse "$199/mo" / "$49-99/mo" / "$199-299/mo" / "$0/mo" → monthly USD (low end if range)
function parsePriceMonthly(p: string): number {
  const m = p.match(/\$(\d+)(?:-(\d+))?\/mo/);
  if (!m) return 0;
  return parseInt(m[1], 10);
}

interface ClientRow {
  service: string;
  price: string;
  businessName: string;
  email: string;
  industry: string | null;
  active: boolean;
  lastDelivery: string | null;
  daysSince: number | null;
  status: "green" | "yellow" | "red";
  isInternal: boolean;
}

const SERVICE_TABLES = [
  { table: "newsletter_service_clients", service: "AI Newsletter", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "faq_refresh_clients", service: "FAQ Refresh", price: "$29/mo", lastField: "last_refreshed_at", freq: 30 },
  { table: "ads_copy_clients", service: "Google Ads Copy", price: "$39/mo", lastField: "last_sent_at", freq: 30 },
  { table: "blog_post_clients", service: "Blog Posts", price: "$79/mo", lastField: "last_sent_at", freq: 30 },
  { table: "competitor_watch_clients", service: "Competitor Watch", price: "$69/mo", lastField: "last_report_at", freq: 7 },
  { table: "local_seo_clients", service: "Local SEO Pages", price: "$59/mo", lastField: "last_generated_at", freq: 30 },
  { table: "price_monitor_clients", service: "Price Monitor", price: "$49/mo", lastField: "last_report_at", freq: 7 },
  { table: "meeting_prep_clients", service: "Meeting Prep", price: "$29/mo", lastField: null, freq: 0 },
  { table: "directory_submitter_clients", service: "Directory Audit", price: "$39/mo", lastField: "last_audit_at", freq: 30 },
  { table: "onboarding_agent_clients", service: "Onboarding Agent", price: "$59/mo", lastField: null, freq: 0 },
  { table: "handbook_clients", service: "Employee Handbook", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "grant_finder_clients", service: "Grant Finder", price: "$149/mo", lastField: "last_sent_at", freq: 7 },
  { table: "review_response_clients", service: "Review Response", price: "$49/mo", lastField: "last_sent_at", freq: 1 },
  { table: "battlecard_clients", service: "Competitive Battlecard", price: "$39/mo", lastField: "last_sent_at", freq: 30 },
  { table: "market_intel_clients", service: "Market Intelligence", price: "$49/mo", lastField: "last_sent_at", freq: 7 },
  { table: "permit_monitor_clients", service: "Permit Monitor", price: "$79/mo", lastField: "last_sent_at", freq: 30 },
  { table: "osha_compliance_clients", service: "OSHA Compliance", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "collections_clients", service: "Late Payment Collector", price: "$49/mo", lastField: "last_sent_at", freq: 7 },
  { table: "inventory_alert_clients", service: "Inventory Alerts", price: "$49/mo", lastField: "last_sent_at", freq: 1 },
  { table: "birthday_campaign_clients", service: "Birthday Campaign", price: "$29/mo", lastField: "last_sent_at", freq: 30 },
  { table: "appointment_reminders", service: "Appointment Reminders", price: "$29/mo", lastField: "last_sent_at", freq: 1 },
  { table: "review_request_clients", service: "Review Request SMS", price: "$29/mo", lastField: "last_sent_at", freq: 7 },
  // ── Core Revenue Streams ─────────────────────────────────────────────────
  { table: "contractor_clients", service: "Contractor Lead Gen", price: "$399/mo", lastField: null, freq: 0 },
  { table: "b2b_subscribers", service: "B2B Dental Database", price: "$49/mo", lastField: null, freq: 0 },
  { table: "social_media_clients", service: "Social Media AI", price: "$99/mo", lastField: "last_post_at", freq: 2 },
  { table: "gbp_saas_clients", service: "GBP SaaS", price: "$49/mo", lastField: "last_post_at", freq: 2 },
  // ── Wave 1: SMS & Monitoring ─────────────────────────────────────────────
  { table: "review_monitor_clients", service: "Review Monitor", price: "$25/mo", lastField: "last_sent_at", freq: 3 },
  { table: "sms_blast_clients", service: "Weekly SMS Blast", price: "$19/mo", lastField: "last_sent_at", freq: 7 },
  { table: "noshow_clients", service: "No-Show Re-Booker", price: "$25/mo", lastField: null, freq: 0 },
  { table: "estimate_drip_clients", service: "Estimate Follow-Up Drip", price: "$39/mo", lastField: null, freq: 0 },
  { table: "invoice_chaser_clients", service: "Invoice Chaser", price: "$29/mo", lastField: null, freq: 0 },
  { table: "afterjob_drip_clients", service: "After-Job Drip", price: "$29/mo", lastField: null, freq: 0 },
  { table: "promo_blaster_clients", service: "Seasonal Promo Blaster", price: "$29/mo", lastField: "last_sent_at", freq: 60 },
  { table: "referral_program_clients", service: "Referral Program", price: "$39/mo", lastField: null, freq: 0 },
  { table: "slow_day_clients", service: "Slow Day SMS", price: "$25/mo", lastField: null, freq: 0 },
  { table: "homeowner_campaign_clients", service: "New Homeowner Campaign", price: "$59/mo", lastField: "last_sent_at", freq: 30 },
  // ── Wave 2 & 3: Autonomous Products ─────────────────────────────────────
  { table: "dark_web_monitor_clients", service: "Dark Web Monitor", price: "$49/mo", lastField: "last_report_at", freq: 7 },
  { table: "gov_contract_clients", service: "Government Contract Monitor", price: "$299/mo", lastField: "last_report_at", freq: 1 },
  { table: "regulatory_monitor_clients", service: "Regulatory Change Monitor", price: "$197/mo", lastField: "last_report_at", freq: 7 },
  { table: "trademark_watch_clients", service: "Trademark Watch Service", price: "$49/mo", lastField: "last_checked_at", freq: 7 },
  { table: "competitor_pricing_clients", service: "Competitor Pricing Intel", price: "$149/mo", lastField: "last_checked_at", freq: 7 },
  { table: "re_newsletter_clients", service: "Real Estate Newsletter", price: "$79/mo", lastField: "last_sent_at", freq: 7 },
  { table: "hoa_secretary_clients", service: "HOA Secretary AI", price: "$149/mo", lastField: "last_sent_at", freq: 30 },
  { table: "hoa_violation_clients", service: "HOA Violation Letters", price: "$149/mo", lastField: null, freq: 0 },
  { table: "rfp_alert_clients", service: "RFP Alert Service", price: "$149/mo", lastField: "last_sent_at", freq: 1 },
  { table: "franchise_analyzer_clients", service: "Franchise FDD Analyzer", price: "$299/mo", lastField: null, freq: 0 },
  { table: "insurance_drip_clients", service: "Insurance Lead Drip", price: "$149/mo", lastField: "last_sent_at", freq: 7 },
  { table: "str_reputation_clients", service: "STR Reputation Manager", price: "$79/mo", lastField: "last_sent_at", freq: 7 },
  { table: "grant_discovery_clients", service: "Grant Discovery", price: "$199/mo", lastField: "last_sent_at", freq: 7 },
  { table: "ag_price_alert_clients", service: "Ag Price Alerts", price: "$79/mo", lastField: "last_sent_at", freq: 7 },
  { table: "landlord_letter_clients", service: "Landlord-Tenant Letters", price: "$149/mo", lastField: null, freq: 0 },
  { table: "trade_show_clients", service: "Trade Show Follow-Up", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "price_intelligence_clients", service: "Competitor Price Intel", price: "$199/mo", lastField: "last_sent_at", freq: 7 },
  { table: "citation_monitor_clients", service: "Citation Monitor", price: "$99/mo", lastField: "last_sent_at", freq: 7 },
  { table: "menu_engineering_clients", service: "Menu Engineering", price: "$99/mo", lastField: "last_sent_at", freq: 30 },
  { table: "fitness_report_clients", service: "Fitness Progress Reports", price: "$79/mo", lastField: "last_sent_at", freq: 30 },
  { table: "gov_meeting_tracker_clients", service: "Gov Meeting Tracker", price: "$199/mo", lastField: "last_sent_at", freq: 7 },
  { table: "podcast_clients", service: "Podcast-to-Revenue Machine", price: "$199/mo", lastField: "last_sent_at", freq: 7 },
  // ── Wave 4: Seven New Products ────────────────────────────────────────────
  { table: "storm_lead_clients", service: "Storm Damage Leads", price: "$29/mo", lastField: null, freq: 0 },
  { table: "recall_alert_clients", service: "Recall Alert Service", price: "$19/mo", lastField: null, freq: 0 },
  { table: "permit_watch_clients", service: "Permit Watch", price: "$29/mo", lastField: "last_report_at", freq: 7 },
  { table: "speed_audit_clients", service: "Website Speed Audit", price: "$29/mo", lastField: "last_report_at", freq: 30 },
  { table: "crime_digest_clients", service: "Neighborhood Crime Digest", price: "$19/mo", lastField: null, freq: 0 },
  { table: "license_monitor_clients", service: "Business License Monitor", price: "$25/mo", lastField: null, freq: 0 },
  // ── High-Ticket Products ─────────────────────────────────────────────────
  { table: "reg_filing_clients", service: "Regulatory Filing Monitor", price: "$497/mo", lastField: "last_scan_at", freq: 1 },
  { table: "bid_intel_clients", service: "Bid Intelligence", price: "$599/mo", lastField: "last_scan_at", freq: 1 },
  { table: "commercial_lease_clients", service: "Commercial Lease Abstractor", price: "$149/mo", lastField: null, freq: 0 },
  { table: "patent_watch_clients", service: "Patent Watch Intelligence", price: "$199/mo", lastField: null, freq: 7 },
  { table: "pe_intelligence_clients", service: "PE/Investor Sector Intelligence", price: "$299/mo", lastField: null, freq: 7 },
  { table: "rd_intelligence_clients", service: "R&D Paper Intelligence", price: "$199/mo", lastField: null, freq: 7 },
  { table: "credit_dispute_clients", service: "Credit Dispute Letters", price: "$79/mo", lastField: null, freq: 0 },
  { table: "medical_bill_clients", service: "Medical Bill Dispute Letters", price: "$79/mo", lastField: null, freq: 0 },
  { table: "supplement_analyzer_clients", service: "Supplement Stack Analyzer", price: "$19/mo", lastField: null, freq: 30 },
  { table: "trade_association_clients", service: "Trade Association Intelligence", price: "$149/mo", lastField: null, freq: 7 },
  { table: "luxury_re_clients", service: "Luxury Real Estate Intelligence", price: "$299/mo", lastField: null, freq: 7 },
  { table: "leads", service: "SMS Leads (Comms Center)", price: "$0/mo", lastField: null, freq: 0 },
  { table: "field_crm_clients", service: "Field Service Management", price: "$199-299/mo", lastField: null, freq: 0 },
  { table: "hire_alert_clients", service: "TechAlert Hiring Monitor", price: "$49-99/mo", lastField: "created_at", freq: 1 },
  { table: "seo_guard_clients", service: "SEO Guard", price: "$29/mo", lastField: "last_report_at", freq: 7 },
  { table: "missed_call_clients", service: "Missed Call Text-Back", price: "$99/mo", lastField: null, freq: 0 },
  { table: "tech_support_tickets", service: "Local Tech Support", price: "$49/session", lastField: null, freq: 0 },
] as const;

function daysBetween(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function getStatus(days: number | null, freq: number): "green" | "yellow" | "red" {
  if (freq === 0 || days === null) return "yellow";
  if (days <= freq) return "green";
  if (days <= freq * 1.5) return "yellow";
  return "red";
}

export default function AdminClientHealth() {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-client-health"],
    queryFn: async () => {
      const rows: ClientRow[] = [];
      const results = await Promise.all(
        SERVICE_TABLES.map(async (cfg) => {
          try {
            const { data } = await (supabase.from as any)(cfg.table)
              .select("business_name, email, industry" + (cfg.lastField ? `, ${cfg.lastField}` : ""))
              .eq("active", true)
              .limit(100);
            return { cfg, data: data || [] };
          } catch {
            return { cfg, data: [] as any[] };
          }
        })
      );

      for (const { cfg, data } of results) {
        for (const r of data) {
          const lastVal = cfg.lastField ? r[cfg.lastField] : null;
          const days = daysBetween(lastVal);
          rows.push({
            service: cfg.service,
            price: cfg.price,
            businessName: r.business_name,
            email: r.email,
            industry: r.industry || null,
            active: true,
            lastDelivery: lastVal ? new Date(lastVal).toLocaleDateString() : null,
            daysSince: days,
            status: getStatus(days, cfg.freq),
            isInternal: isInternalEmail(r.email),
          });
        }
      }
      return rows.sort((a, b) => {
        // Internal goes last
        if (a.isInternal !== b.isInternal) return a.isInternal ? 1 : -1;
        const order = { red: 0, yellow: 1, green: 2 };
        return order[a.status] - order[b.status];
      });
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const [filter, setFilter] = useState<"all" | "at_risk" | "danger">("all");

  const realClients = clients?.filter(c => !c.isInternal) ?? [];
  const internalClients = clients?.filter(c => c.isInternal) ?? [];

  const realCounts = {
    total: realClients.length,
    green: realClients.filter(c => c.status === "green").length,
    yellow: realClients.filter(c => c.status === "yellow").length,
    red: realClients.filter(c => c.status === "red").length,
  };

  // MRR at risk = sum of monthly price for red rows (true paying clients only)
  const mrrAtRisk = realClients
    .filter(c => c.status === "red")
    .reduce((sum, c) => sum + parsePriceMonthly(c.price), 0);

  const filteredRealClients = realClients.filter(c => {
    if (filter === "at_risk") return c.status === "yellow" || c.status === "red";
    if (filter === "danger") return c.status === "red";
    return true;
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  const ClientRow = ({ c, i }: { c: ClientRow; i: number }) => (
    <div key={`${c.email}-${c.service}-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
      {c.status === "green" ? <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" /> :
       c.status === "yellow" ? <Clock size={14} className="text-yellow-400 shrink-0 mt-0.5" /> :
       <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold truncate">{c.businessName}</span>
          {c.isInternal && <Badge variant="outline" className="text-[8px] px-1 py-0 border-muted-foreground/30">INTERNAL</Badge>}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">{c.email}</div>
        {c.industry && <div className="text-[10px] text-muted-foreground/60">{c.industry}</div>}
      </div>
      <div className="text-right shrink-0">
        <Badge variant="outline" className="text-[9px] mb-0.5">{c.service}</Badge>
        <div className="text-[10px] text-muted-foreground">
          {c.daysSince !== null ? (
            <span className={c.status === "red" ? "text-red-400 font-bold" : ""}>
              {c.daysSince}d since delivery
            </span>
          ) : (
            <span className="text-yellow-400">Never delivered</span>
          )}
        </div>
        <div className="text-[10px] font-bold text-muted-foreground">{c.price}</div>
        {(c.status === "yellow" || c.status === "red") && c.email && (
          <a
            href={`mailto:${c.email}?subject=${encodeURIComponent(`Checking in — ${c.service}`)}&body=${encodeURIComponent(`Hi ${c.businessName},\n\nJust checking in on your ${c.service} service. Wanted to make sure everything is running smoothly on your end.\n\nLet me know if you need anything!\n\nBest,\nMatt`)}`}
            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[8px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail size={9} /> Check-in
          </a>
        )}
      </div>
    </div>
  );

  const guide = getAdminGuide("health");

  return (
    <div className="space-y-6">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} />}

      <div>
        <h2 className="text-lg font-bold">Client Health Dashboard</h2>
        <p className="text-xs text-muted-foreground">Service delivery status for all B2B subscribers</p>
      </div>

      {/* Health Score */}
      {realCounts.total > 0 && (() => {
        const healthPct = Math.round((realCounts.green / realCounts.total) * 100);
        const barColor = healthPct >= 80 ? "bg-green-500" : healthPct >= 50 ? "bg-yellow-500" : "bg-red-500";
        const textColor = healthPct >= 80 ? "text-green-400" : healthPct >= 50 ? "text-yellow-400" : "text-red-400";
        return (
          <Card className="border-border/40 bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Overall Health Score</span>
                <span className={`text-2xl font-black ${textColor}`}>{healthPct}%</span>
              </div>
              <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${healthPct}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                {realCounts.green} of {realCounts.total} services delivering on schedule
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Stats - Real clients only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Paying Active", value: realCounts.total, color: "text-foreground", desc: "Real paying clients" },
          { label: "On Track", value: realCounts.green, color: "text-green-400", desc: "Delivered on schedule" },
          { label: "Due Soon", value: realCounts.yellow, color: "text-yellow-400", desc: "Delivery approaching or never sent" },
          { label: "Overdue", value: realCounts.red, color: "text-red-400", desc: "Past delivery deadline" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
              <div className="text-[8px] text-muted-foreground/60 mt-0.5">{s.desc}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Real Clients */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">
            Paying Clients ({realClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {realClients.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No paying B2B clients yet. When customers subscribe through your service pages, they'll appear here.
              </p>
            ) : (
              realClients.map((c, i) => <ClientRow key={i} c={c} i={i} />)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Internal Clients */}
      {internalClients.length > 0 && (
        <Card className="border-border/20 opacity-70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 size={14} className="text-muted-foreground" />
              Internal — Your Own Business ({internalClients.length} services)
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              These are services running for M2 Development. They don't count toward revenue.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {internalClients.map((c, i) => <ClientRow key={i} c={c} i={i} />)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
