import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";

const TRADES = ["HVAC", "Plumbing", "Roofing", "Electrical", "General Contractor", "Landscaping", "Painting", "Other"];

type Step = "form" | "success" | "billing_success";

export default function DeadLeadIntake() {
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [contactsAdded, setContactsAdded] = useState(0);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    phone: "",
    email: "",
    trade: "",
    leads: "",
  });

  const urlParams = new URLSearchParams(window.location.search);
  const billingStatus = urlParams.get("billing");

  // Handle Stripe redirect back
  if (billingStatus === "success" && step === "form") {
    return (
      <Page>
        <Card>
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>
              Billing Active
            </h2>
            <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.6 }}>
              Your card is saved. We'll auto-charge $50 only when a dead lead replies YES —
              no action needed from you.
            </p>
            <p style={{ color: "#00d4ff", fontSize: 13, marginTop: 20 }}>
              Questions? Text Matt: (313) 806-4952
            </p>
          </div>
        </Card>
      </Page>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const lines = form.leads
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError("Please paste at least one phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("dead-lead-intake", {
        body: {
          business_name: form.business_name.trim(),
          owner_name: form.owner_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          trade: form.trade,
          leads: lines,
        },
      });

      if (fnErr || data?.error) {
        throw new Error(data?.error || fnErr?.message || "Submission failed");
      }

      setContractorId(data.contractor_id);
      setContactsAdded(data.contacts_added);
      setStep("success");
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetupBilling() {
    if (!contractorId) return;
    setBillingLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("dead-lead-billing-setup", {
        body: { contractor_id: contractorId },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message);
      if (data?.setup_url) window.location.href = data.setup_url;
    } catch (e: any) {
      setError(e.message || "Could not start billing setup. Text Matt at (313) 806-4952.");
      setBillingLoading(false);
    }
  }

  if (step === "success") {
    return (
      <Page>
        <Card>
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>♻️</div>
            <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>
              Campaign Created!
            </h2>
            <p style={{ color: "#10b981", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {contactsAdded} dead leads ready to drip
            </p>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
              We'll start reaching out within 24 hours using a 3-message SMS sequence —
              white-labeled as your business. You only pay <strong style={{ color: "#fff" }}>$50</strong> when
              a lead replies YES they still need the work.
            </p>

            <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10, padding: "24px", marginBottom: 24, textAlign: "left" }}>
              <p style={{ color: "#00d4ff", fontWeight: 700, fontSize: 14, margin: "0 0 8px", letterSpacing: "0.5px" }}>
                OPTIONAL: SET UP AUTO-BILLING
              </p>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
                Save your card now and we'll auto-charge $50 the moment a lead says YES —
                no invoices, no manual transfers. Skip this and Matt will invoice you manually.
              </p>
              <button
                onClick={handleSetupBilling}
                disabled={billingLoading}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: billingLoading ? "#1e3a5f" : "#00d4ff",
                  color: billingLoading ? "#64748b" : "#0a1628",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: billingLoading ? "not-allowed" : "pointer",
                }}
              >
                {billingLoading ? "Loading…" : "Save Card — Auto-Bill $50/Revival"}
              </button>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <p style={{ color: "#64748b", fontSize: 13 }}>
              Matt has been notified and will review your campaign shortly.
              Questions? Text (313) 806-4952.
            </p>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <SEOHead title="Dead Lead Reactivation — Detroit Web Agency" description="Upload your old unsold leads and let us text them for you. $50 per positive reply. No monthly fee, no contracts. We only get paid when you do." path="/dead-lead-intake" />
      <Card>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>♻️</span>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>
              Dead Lead Reactivation
            </h1>
          </div>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Paste your old estimates and dead leads below. We'll send a 3-message SMS sequence
            on your behalf — <strong style={{ color: "#fff" }}>you pay $50 only when a lead replies YES</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Business Name *">
              <input
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="Smith HVAC LLC"
                style={inputStyle}
              />
            </Field>
            <Field label="Your Name">
              <input
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="John Smith"
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Your Phone *">
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(313) 555-0100"
                style={inputStyle}
              />
            </Field>
            <Field label="Your Email *">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@smithhvac.com"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Trade *">
            <select
              required
              value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select trade…</option>
              {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <Field
            label="Dead Leads — Phone Numbers *"
            hint="One per line. Format: phone  OR  phone, First Name"
          >
            <textarea
              required
              value={form.leads}
              onChange={(e) => setForm({ ...form, leads: e.target.value })}
              placeholder={"3135550101\n3135550102, Sarah\n3135550103, Mike Johnson"}
              rows={8}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
            />
          </Field>

          {error && (
            <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "16px",
              background: submitting ? "#1e3a5f" : "#00d4ff",
              color: submitting ? "#64748b" : "#0a1628",
              border: "none",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 16,
              cursor: submitting ? "not-allowed" : "pointer",
              letterSpacing: "0.3px",
            }}
          >
            {submitting ? "Submitting…" : "Start Reactivation Campaign →"}
          </button>
        </form>

        <p style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 1.5 }}>
          By submitting, you confirm you have prior business relationships with these contacts.
          Opt-outs are honored automatically (TCPA compliant).
        </p>
      </Card>
    </Page>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ color: "#00d4ff", fontSize: 13, fontWeight: 700, letterSpacing: "1px" }}>
            DETROIT WEB AGENCY
          </span>
        </div>
        {children}
        <p style={{ color: "#334155", fontSize: 12, textAlign: "center", marginTop: 24 }}>
          Questions? matt@detroitwebagent.com · (313) 806-4952
        </p>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0f2342",
      border: "1px solid #1e3a5f",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{ background: "#00d4ff", height: 4 }} />
      <div style={{ padding: "28px 32px" }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, letterSpacing: "0.5px" }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ color: "#475569", fontSize: 11 }}>{hint}</span>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0a1628",
  border: "1px solid #1e3a5f",
  borderRadius: 7,
  color: "#fff",
  fontSize: 14,
  padding: "11px 14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
