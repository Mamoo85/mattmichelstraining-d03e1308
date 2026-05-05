import { ShieldCheck, Mail } from "lucide-react";

interface LeadGuaranteeBarProps {
  productName: string;
  creditEmail?: string;
  reasons?: { label: string; detail: string }[];
}

const DEFAULT_REASONS = [
  { label: "Invalid address", detail: "Property address doesn't exist or can't be located" },
  { label: "Duplicate lead", detail: "Same address already delivered within the last 30 days" },
  { label: "Out-of-area lead", detail: "ZIP code falls outside your subscribed service area" },
  { label: "Wrong signal", detail: "Permit or record clearly mismatched to your trade vertical" },
];

export default function LeadGuaranteeBar({
  productName,
  creditEmail = "matt@detroitwebagent.com",
  reasons = DEFAULT_REASONS,
}: LeadGuaranteeBarProps) {
  const subject = `Lead Credit Request — ${productName}`;
  const body = `Hi Matt,\n\nI'd like to request a credit for a lead that didn't meet quality standards.\n\nProduct: ${productName}\nLead address: [paste address here]\nReason: [invalid address / duplicate / out-of-area / wrong signal]\n\nDetails:\n[describe the issue]\n\nThanks`;
  return (
    <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <ShieldCheck className="w-5 h-5 text-[#00d4ff] flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-bold text-white">Lead Quality Guarantee</h2>
          <p className="text-sm text-[#94a3b8] mt-1 leading-relaxed">
            Every lead is sourced from verified public records. If a lead doesn't meet our quality standards, request a credit — no questions asked.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {reasons.map((item) => (
          <div key={item.label} className="flex items-start gap-2 bg-[#030711] border border-[#1e3a5f]/60 rounded-lg px-3 py-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00d4ff] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-white">{item.label}</p>
              <p className="text-[11px] text-[#64748b] leading-relaxed">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <a
        href={`mailto:${creditEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#00d4ff] hover:text-white transition-colors border border-[#00d4ff]/40 hover:border-white/40 rounded-lg px-4 py-2"
      >
        <Mail className="w-4 h-4" />
        Request a lead credit →
      </a>
      <p className="text-[10px] text-[#64748b] mt-3">
        Credits issued as a one-month deduction on your next billing cycle. One credit request per lead.
      </p>
    </div>
  );
}
