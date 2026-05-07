import { useEffect, useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import ReceiptStatusBanner from "@/components/checkout/ReceiptStatusBanner";
import CheckEmailCard from "@/components/checkout/CheckEmailCard";
import ActionButton from "@/components/ui/action-button";
import { trackTrialEvent } from "@/lib/trialFunnel";

const PRODUCT_KEY = "dead_lead_reactivation";
const SUPPORT_PHONE_DISPLAY = "(313) 992-1219";
const SUPPORT_PHONE_TEL = "+13139921219";
const SUPPORT_EMAIL = "matt@detroitwebagent.com";

const TRADES = ["HVAC", "Plumbing", "Roofing", "Electrical", "General Contractor", "Landscaping", "Painting", "Other"];

type Step = "form" | "success" | "billing_success";

export default function DeadLeadIntake() {
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [contactsAdded, setContactsAdded] = useState(0);
  const [error, setError] = useState("");
  const [billingRedirectUrl, setBillingRedirectUrl] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const [hasFocused, setHasFocused] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    phone: "",
    email: "",
    trade: "",
    leads: "",
    google_review_link: "",
  });

  // Track page view on mount (Phase 1: visibility)
  useEffect(() => {
    trackTrialEvent("view", PRODUCT_KEY, {
      metadata: { page: "/dead-lead-intake", viewport: typeof window !== "undefined" ? window.innerWidth : null },
    });
  }, []);

  function trackFocus() {
    if (hasFocused) return;
    setHasFocused(true);
    trackTrialEvent("form_focus", PRODUCT_KEY);
  }

  function trackEscape(channel: "call" | "sms" | "email") {
    trackTrialEvent("form_focus", PRODUCT_KEY, { metadata: { escape_hatch: channel } });
  }

  function handleCsvUpload(file: File) {
    setError("");
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      // Strip BOM, split lines
      const rawLines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
      // Detect header row (contains "phone", "email", or "name" word)
      const first = rawLines[0]?.toLowerCase() || "";
      const hasHeader = /phone|email|name|number/.test(first) && !/^\+?\d/.test(rawLines[0]);
      const dataLines = hasHeader ? rawLines.slice(1) : rawLines;

      // Parse: take the first cell that looks like a phone number, then remaining as name
      const parsed = dataLines
        .map((line) => {
          const cells = line.split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
          const phoneCell = cells.find((c) => /\d{10,}/.test(c.replace(/\D/g, "")));
          if (!phoneCell) return null;
          const phone = phoneCell.replace(/[^\d+]/g, "");
          if (phone.replace(/\D/g, "").length < 10) return null;
          const nameCell = cells.find((c) => c !== phoneCell && !/@/.test(c) && /[a-zA-Z]/.test(c));
          return nameCell ? `${phone}, ${nameCell}` : phone;
        })
        .filter((l): l is string => l !== null)
        .slice(0, 500); // match edge function 500 cap

      if (parsed.length === 0) {
        setError("No valid phone numbers found in this file. Make sure each row has a 10+ digit phone number.");
        setCsvPreview([]);
        setForm({ ...form, leads: "" });
        return;
      }

      setCsvPreview(parsed);
      setForm({ ...form, leads: parsed.join("\n") });
    };
    reader.onerror = () => setError("Could not read the file. Try saving as .csv and uploading again.");
    reader.readAsText(file);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const billingStatus = urlParams.get("billing");
  const cidFromUrl = urlParams.get("cid");
  // Handle Stripe redirect back
  if (billingStatus === "success" && step === "form") {
    return (
      <Page>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <ReceiptStatusBanner sessionId={urlParams.get("session_id")} productLabel="Dead Lead Billing" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <CheckEmailCard sessionId={urlParams.get("session_id")} />
          </div>
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
              Questions? Text Matt: (313) 992-1219
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

    trackTrialEvent("form_submit", PRODUCT_KEY, {
      email: form.email,
      metadata: { lead_count: lines.length, trade: form.trade, input_mode: inputMode },
    });

    if (lines.length === 0) {
      setError("Please paste at least one phone number.");
      trackTrialEvent("trial_error", PRODUCT_KEY, { metadata: { reason: "no_leads" } });
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
          google_review_link: form.google_review_link.trim() || undefined,
        },
      });

      // Handle free tier exhausted — show human message + billing redirect
      if (data?.error === "free_tier_exhausted") {
        setBillingRedirectUrl(data.billing_url || null);
        setError("Your free trial (10 leads) has been used. Add a card to continue — you only pay $50 when a lead replies YES.");
        trackTrialEvent("checkout_redirect", PRODUCT_KEY, { email: form.email, metadata: { reason: "free_tier_exhausted" } });
        setSubmitting(false);
        return;
      }

      if (fnErr || data?.error) {
        throw new Error(data?.error || fnErr?.message || "Submission failed");
      }

      setContractorId(data.contractor_id);
      setContactsAdded(data.contacts_added);
      setStep("success");
      trackTrialEvent("trial_success", PRODUCT_KEY, {
        email: form.email,
        metadata: { contacts_added: data.contacts_added, contractor_id: data.contractor_id },
      });
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
      trackTrialEvent("trial_error", PRODUCT_KEY, {
        email: form.email,
        metadata: { error: String(e?.message || e).slice(0, 200) },
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetupBilling() {
    const cid = contractorId || cidFromUrl;
    if (!cid) return;
    setBillingLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("dead-lead-billing-setup", {
        body: { contractor_id: cid },
      });
      if (fnErr || data?.error) throw new Error(data?.error || fnErr?.message);
      if (data?.setup_url) window.location.href = data.setup_url;
    } catch (e: any) {
      setError(e.message || "Could not start billing setup. Text Matt at (313) 992-1219.");
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
              <ActionButton
                onClick={handleSetupBilling}
                busyLabel="Loading…"
              >
                Save Card — Auto-Bill $50/Revival
              </ActionButton>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <p style={{ color: "#64748b", fontSize: 13 }}>
              Matt has been notified and will review your campaign shortly.
              Questions? Text (313) 992-1219.
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
        {urlParams.get("pilot") === "1" && (
          <div style={{ marginBottom: 20, padding: "16px 18px", background: "linear-gradient(135deg, #16a34a25, #16a34a08)", border: "1px solid #16a34a60", borderRadius: 10 }}>
            <p style={{ color: "#4ade80", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", margin: "0 0 4px" }}>✅ $1 Pilot Active</p>
            <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>You're in. One last step.</p>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Paste your old lead list in the form below and we'll text the first batch within 60 minutes. You only pay $50 when someone replies YES — and your first reply is on the house.
            </p>
          </div>
        )}
        <div style={{ marginBottom: 20, padding: "14px 16px", background: "linear-gradient(135deg, #00d4ff15, #00d4ff05)", border: "1px solid #00d4ff40", borderRadius: 10 }}>
          <p style={{ color: "#00d4ff", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", margin: "0 0 4px" }}>🎁 First Reply FREE</p>
          <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Your first positive reply is on the house.</p>
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Paste your old quotes below. We text them for you. <strong style={{ color: "#fff" }}>Zero charge until someone replies YES.</strong> First reply is free — after that, $50 per positive reply. No monthly fee, ever.
          </p>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>♻️</span>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>
              Wake Up Your Dead Leads
            </h1>
          </div>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            We text the old quotes that ghosted you. <strong style={{ color: "#fff" }}>$0 to start. $50 only when someone replies YES.</strong> First reply is on the house.
          </p>
        </div>

        {/* Sample SMS exchange — proof of what they get */}
        <div style={{ marginBottom: 20, padding: 14, background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 10 }}>
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", margin: "0 0 10px" }}>What they receive (real example)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "#1e3a5f", color: "#fff", padding: "8px 12px", borderRadius: "12px 12px 12px 2px", fontSize: 13, lineHeight: 1.4 }}>
              Hey Sarah — Smith HVAC. We quoted your furnace back in March. Still need it done before winter? Reply YES and I'll lock today's pricing.
            </div>
            <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#00d4ff", color: "#0a1628", padding: "8px 12px", borderRadius: "12px 12px 2px 12px", fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
              Yes actually — call me tomorrow morning 👍
            </div>
          </div>
          <p style={{ color: "#10b981", fontSize: 12, fontWeight: 700, margin: "10px 0 0", textAlign: "center" }}>↑ That reply = $50 to us. Closed job = $4,800 to you.</p>
        </div>

        {/* Trust strip */}
        <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, color: "#64748b" }}>
          <span style={{ padding: "4px 9px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 999 }}>✓ TCPA-compliant</span>
          <span style={{ padding: "4px 9px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 999 }}>✓ Carrier-screened</span>
          <span style={{ padding: "4px 9px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 999 }}>✓ Detroit-based</span>
          <span style={{ padding: "4px 9px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 999 }}>✓ Auto opt-out</span>
        </div>

        {/* Mobile / no-form escape hatch */}
        {isMobile && (
          <div style={{ marginBottom: 20, padding: 14, background: "linear-gradient(135deg, #00d4ff20, #00d4ff05)", border: "1px solid #00d4ff60", borderRadius: 10 }}>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>📱 On your phone? Skip the form.</p>
            <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
              Just text Matt your business name + a screenshot of your old quotes. We'll do the rest.
            </p>
            <a
              href={`sms:${SUPPORT_PHONE_TEL}?&body=${encodeURIComponent("Hey Matt — I want to try Dead Lead Reactivation. My business is: ")}`}
              onClick={() => trackEscape("sms")}
              style={{ display: "block", padding: "12px", background: "#00d4ff", color: "#0a1628", borderRadius: 8, fontWeight: 800, fontSize: 14, textAlign: "center", textDecoration: "none" }}
            >
              💬 Text Matt: {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
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
                onFocus={trackFocus}
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
            label="Dead Leads *"
            hint={inputMode === "paste" ? "One per line. Format: phone  OR  phone, First Name" : "Upload a .csv with phone numbers in any column. We auto-detect headers and pull names too."}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button type="button" onClick={() => setInputMode("paste")} style={{ flex: 1, padding: "8px 12px", background: inputMode === "paste" ? "#00d4ff" : "#0a1628", color: inputMode === "paste" ? "#0a1628" : "#94a3b8", border: "1px solid #1e3a5f", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📝 Paste numbers</button>
              <button type="button" onClick={() => setInputMode("csv")} style={{ flex: 1, padding: "8px 12px", background: inputMode === "csv" ? "#00d4ff" : "#0a1628", color: inputMode === "csv" ? "#0a1628" : "#94a3b8", border: "1px solid #1e3a5f", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📂 Upload CSV</button>
            </div>
            {inputMode === "paste" ? (
              <textarea
                required
                value={form.leads}
                onChange={(e) => setForm({ ...form, leads: e.target.value })}
                placeholder={"3135550101\n3135550102, Sarah\n3135550103, Mike Johnson"}
                rows={8}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
              />
            ) : (
              <div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvUpload(f); }}
                  style={{ ...inputStyle, padding: "10px 14px", fontSize: 13 }}
                />
                {csvFileName && csvPreview.length > 0 && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 7 }}>
                    <p style={{ color: "#10b981", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>✓ {csvPreview.length} valid leads parsed from {csvFileName}</p>
                    <pre style={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace", margin: 0, maxHeight: 100, overflow: "auto", whiteSpace: "pre-wrap" }}>{csvPreview.slice(0, 5).join("\n")}{csvPreview.length > 5 ? `\n…and ${csvPreview.length - 5} more` : ""}</pre>
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Google Review Link (optional)" hint="We'll ask dead leads who say no to leave you a review instead">
            <input
              value={form.google_review_link}
              onChange={(e) => setForm({ ...form, google_review_link: e.target.value })}
              placeholder="https://g.page/r/your-business/review"
              style={inputStyle}
            />
          </Field>

          {error && (
            <div>
              <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>
              {billingRedirectUrl && (
                <button
                  onClick={() => window.location.href = billingRedirectUrl}
                  style={{
                    marginTop: 12,
                    padding: "12px 24px",
                    background: "#00d4ff",
                    color: "#0a1628",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Set Up Billing — $50/Revival →
                </button>
              )}
            </div>
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
          Questions? matt@detroitwebagent.com · (313) 992-1219
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
