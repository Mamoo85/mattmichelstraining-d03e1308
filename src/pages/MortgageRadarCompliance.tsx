import SEOHead from "@/components/layout/SEOHead";
import { ShieldCheck, FileText, Phone, Mail, Printer } from "lucide-react";

const SECTIONS = [
  {
    icon: ShieldCheck,
    title: "FCRA Compliance — No Credit Bureau Trigger Leads",
    body: [
      "Mortgage Radar does NOT use, access, or resell consumer credit bureau data (Equifax, Experian, TransUnion, or any bureau-affiliated trigger-lead vendor).",
      "All signals are sourced exclusively from public records: county court filings, probate records, BSEED building permits, Detroit assessor sales data, FSBO listings, estate sale databases, FEMA flood claims, and SPC storm reports. These are categorically NOT consumer reports under the FCRA (15 U.S.C. § 1681a(d)) and do not require a permissible purpose.",
      "Lead officers using Mortgage Radar are responsible for ensuring their outreach activities comply with applicable FCRA provisions when they obtain separate credit bureau data in their own loan origination workflow. Mortgage Radar signals do not trigger FCRA obligations on their own.",
      "We do not provide credit scores, payment history, account balances, or any data derived from consumer credit files.",
    ],
  },
  {
    icon: FileText,
    title: "TCPA Compliance — Calling & Texting Rules",
    body: [
      "Mortgage Radar provides lead intelligence only — it does not place calls, send SMS messages, or contact homeowners on your behalf without your explicit approval on each lead.",
      "Every lead requires manual approval (status = 'approved') before any outreach is triggered. No auto-dialing or bulk SMS is initiated without that approval gate.",
      "When outreach IS sent via the Mortgage Radar platform, it complies with the Telephone Consumer Protection Act (47 U.S.C. § 227): messages are sent only during permitted hours (8am–9pm recipient local time per FCC 47 C.F.R. § 64.1200), opt-out requests are honored within 10 business days, and all outreach includes required identification language.",
      "Loan officers are responsible for maintaining their own TCPA-compliant do-not-call lists and honoring all revocation requests from consumers they contact through leads sourced from this platform.",
      "Per H.R. 2808 (NANPA Trigger Lead Reform Act, pending): Mortgage Radar's architecture is designed to be compliant with the proposed federal restriction on using credit bureau trigger data. We do not use trigger-lead data today and will not add it.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Data Sources — Public Records Only",
    body: [
      "All property signals are derived from the following public sources:",
      "• Wayne, Oakland, and Macomb County court filings (divorce, probate, estate proceedings)",
      "• Detroit BSEED building permit database (renovation, structural, and improvement permits)",
      "• Detroit Assessor property sales data (recent ownership transfers)",
      "• FSBO listing aggregators and estate sale calendars",
      "• FEMA National Flood Insurance Program (NFIP) claims data",
      "• NOAA Storm Prediction Center (SPC) severe weather reports",
      "• CourtListener public court record database",
      "• U.S. Census Bureau ACS housing data (area-level, not individual)",
      "None of these sources constitute consumer reports under the FCRA. All data is publicly available.",
    ],
  },
  {
    icon: FileText,
    title: "Opt-Out & Data Removal",
    body: [
      "Homeowners who wish to have their property removed from Mortgage Radar's signal database may submit a removal request by emailing matt@detroitwebagent.com with the subject line 'Mortgage Radar Opt-Out' and the property address.",
      "Removal requests are processed within 5 business days. The property address is added to a permanent suppression list that prevents future signal generation.",
      "Loan officers who no longer wish to receive leads may cancel their subscription at any time via the billing portal. Cancellation takes effect at the end of the current billing period.",
    ],
  },
];

export default function MortgageRadarCompliance() {
  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead
        title="Mortgage Radar — FCRA & TCPA Compliance Disclosure"
        description="Full compliance disclosure for Mortgage Radar: FCRA status, TCPA rules, data sources, and opt-out procedures."
      />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#00d4ff]" />
          <span className="font-bold tracking-tight">Mortgage Radar — Compliance Disclosure</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#00d4ff]/70 mb-2">Legal Disclosure</p>
          <h1 className="text-3xl font-black mb-3">FCRA & TCPA Compliance</h1>
          <p className="text-[#94a3b8] text-sm leading-relaxed">
            This document describes how Mortgage Radar (a Detroit Web Agency product) sources lead signals,
            how outreach is handled, and your obligations as a loan officer using this platform.
            Last updated: May 2026.
          </p>
        </div>

        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.title} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-[#00d4ff] flex-shrink-0 mt-0.5" />
                <h2 className="text-lg font-bold leading-snug">{s.title}</h2>
              </div>
              <div className="space-y-3 pl-8">
                {s.body.map((para, i) => (
                  <p key={i} className="text-sm text-[#94a3b8] leading-relaxed">{para}</p>
                ))}
              </div>
            </section>
          );
        })}

        <section className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Contact</h2>
          <div className="space-y-3">
            <a href="mailto:matt@detroitwebagent.com" className="flex items-center gap-2 text-sm text-[#00d4ff] hover:underline">
              <Mail className="w-4 h-4" /> matt@detroitwebagent.com
            </a>
            <a href="tel:+13139921219" className="flex items-center gap-2 text-sm text-[#00d4ff] hover:underline">
              <Phone className="w-4 h-4" /> (313) 992-1219
            </a>
            <p className="text-[11px] text-[#64748b]">Detroit Web Agency · Grosse Pointe, MI</p>
          </div>
        </section>

        <p className="text-[10px] text-[#64748b] text-center">
          This disclosure does not constitute legal advice. Loan officers should consult their compliance officer
          regarding their individual obligations under applicable federal and state law.
        </p>
      </main>
    </div>
  );
}
