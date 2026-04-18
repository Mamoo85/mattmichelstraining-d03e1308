import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ACCENT = "#00d4ff";
const BG = "#0a1628";

export default function HireAlertMSPInquiry() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    agency_name: "", contact_name: "", email: "", phone: "",
    vertical: "Industrial Trades", territory: "", sub_vendor_count: "",
    monthly_placements: "", notes: "",
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.agency_name || !form.email) {
      toast({ title: "Agency name and email required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("msp-inquiry-submit", { body: form });
      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Talent Radar Enterprise — MSP & Vendor Management Inquiry | Detroit Web Agency"
        description="Enterprise hiring intelligence for staffing agencies and MSPs. Statewide territory exclusivity. Signed MSA required."
      />
      <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "system-ui" }}>
        <header style={{ borderBottom: `1px solid ${ACCENT}33`, padding: "16px 24px" }}>
          <Link to="/hire-alert" style={{ color: ACCENT, fontSize: 13, textDecoration: "none" }}>
            ← Back to TechAlert
          </Link>
        </header>

        <section style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
          <p style={{ color: ACCENT, fontWeight: 700, fontSize: 12, letterSpacing: 2, margin: 0 }}>
            ENTERPRISE TIER · MSP / VENDOR MANAGEMENT
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: "8px 0 16px" }}>
            Statewide Hiring Intelligence for Staffing Agencies
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
            For staffing agencies, MSPs, and vendor management platforms. Exclusive territory
            access to our hiring intelligence engine — delivered as a structured monthly brief
            or direct API feed into your VMS. Pricing starts at <b style={{ color: "#fff" }}>$2,500/mo</b>{" "}
            per locked vertical-territory.
          </p>

          <div style={{ background: "#001a33", border: `1px solid ${ACCENT}44`, borderRadius: 8, padding: 20, marginBottom: 32 }}>
            <h3 style={{ color: ACCENT, fontSize: 14, margin: "0 0 12px", letterSpacing: 1 }}>
              ⚠️ ENTERPRISE TERMS
            </h3>
            <ul style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
              <li>Signed Master Services Agreement (MSA) required before first delivery — no clickwrap.</li>
              <li>Manual underwriting: discovery call + agency vetting (24–48 hr turnaround).</li>
              <li>FCRA, TCPA, and state-law indemnification clauses are non-negotiable.</li>
              <li>Sub-vendor / second-tier redistribution requires a separate addendum.</li>
            </ul>
          </div>

          {submitted ? (
            <div style={{ background: "#001a33", border: `1px solid ${ACCENT}`, borderRadius: 8, padding: 32, textAlign: "center" }}>
              <h2 style={{ color: ACCENT, margin: "0 0 12px" }}>Inquiry received.</h2>
              <p style={{ color: "#cbd5e1", margin: 0 }}>
                Matt will reach out within 24 hours to schedule a discovery call. Check your email
                ({form.email}) for confirmation.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input placeholder="Agency / company name *" value={form.agency_name}
                onChange={(e) => update("agency_name", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <Input placeholder="Contact name" value={form.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <Input type="email" placeholder="Work email *" value={form.email}
                onChange={(e) => update("email", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <Input type="tel" placeholder="Phone" value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <select value={form.vertical} onChange={(e) => update("vertical", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff", padding: "12px 14px", borderRadius: 6, fontSize: 14 }}>
                <option>Industrial Trades</option>
                <option>Healthcare (RN/LPN/CNA)</option>
                <option>Both</option>
                <option>Other (describe in notes)</option>
              </select>
              <Input placeholder="Target territory (e.g. Michigan, Tri-County, Wayne+Oakland)"
                value={form.territory} onChange={(e) => update("territory", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <Input placeholder="Number of sub-vendor agencies (if MSP)"
                value={form.sub_vendor_count} onChange={(e) => update("sub_vendor_count", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <Input placeholder="Avg monthly placements"
                value={form.monthly_placements} onChange={(e) => update("monthly_placements", e.target.value)}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />
              <Textarea placeholder="What roles are hardest to fill? Any specific requirements?"
                value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={4}
                style={{ background: "#001a33", border: "1px solid #1e3a5f", color: "#fff" }} />

              <p style={{ color: "#64748b", fontSize: 12, margin: "8px 0 0", lineHeight: 1.5 }}>
                By submitting, you acknowledge this is an inquiry only. No service is initiated
                until a signed MSA is executed. Data delivered under the MSA is a B2B Market
                Intelligence Feed and is not a Consumer Report under FCRA.
              </p>

              <Button onClick={submit} disabled={loading}
                style={{ background: ACCENT, color: BG, fontWeight: 800, padding: "14px", marginTop: 8 }}>
                {loading ? "Submitting..." : "Request Discovery Call →"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
