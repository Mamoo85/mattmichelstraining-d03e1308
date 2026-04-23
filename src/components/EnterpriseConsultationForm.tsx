import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Calendar } from "lucide-react";

/**
 * Enterprise consultation form.
 * Replaces self-serve Stripe checkout on $199–$599/mo B2B intel SKUs.
 * Inserts a row into `enterprise_consultation_requests` and notifies Matt.
 *
 * Usage:
 *   <EnterpriseConsultationForm productInterest="Bid Intelligence" priceLabel="$599/mo" />
 */

interface Props {
  /** Display name of the product they're interested in (saved to DB). */
  productInterest: string;
  /** Optional price label shown in the form heading. */
  priceLabel?: string;
  /** Optional accent color (defaults to DWA teal). */
  accent?: string;
}

const consultSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  company: z.string().trim().min(2, "Company is required").max(200),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export default function EnterpriseConsultationForm({ productInterest, priceLabel, accent = "#00d4ff" }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = consultSchema.safeParse({ name, company, email, phone, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check the form");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("enterprise_consultation_requests").insert({
        name: parsed.data.name,
        company: parsed.data.company,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message || null,
        product_interest: productInterest,
        source_url: typeof window !== "undefined" ? window.location.pathname : null,
      });

      if (error) throw error;

      // Fire-and-forget admin SMS notification (graceful failure)
      supabase.functions.invoke("notify-admin-sms", {
        body: {
          message: `📥 ${productInterest} consult request: ${parsed.data.company} (${parsed.data.name}) — ${parsed.data.email}`,
        },
      }).catch(() => { /* silent — DB row is the source of truth */ });

      setSubmitted(true);
      toast.success("Got it — Matt will text you within 24 hours.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          background: "#0a1628",
          border: `2px solid ${accent}`,
          borderRadius: 14,
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: accent }} />
        <h3 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
          Request received
        </h3>
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Matt will text you within 24 hours to schedule a strategy call.
          <br />
          Need it sooner? Text <a href="sms:+13139921219" style={{ color: accent, fontWeight: 700 }}>(313) 992-1219</a>.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#0a1628",
        border: `1px solid ${accent}40`,
        borderRadius: 14,
        padding: "28px 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Calendar className="w-5 h-5" style={{ color: accent }} />
        <h3 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>
          Book a Strategy Call
        </h3>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
        {productInterest}{priceLabel ? ` (${priceLabel})` : ""} is built around your specific accounts and territories.
        Tell us a bit about your operation — Matt will reach out within 24 hours to scope it with you.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="Your name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            disabled={submitting}
            className="bg-[#001a33] border-[#1e3a5f] text-white placeholder:text-[#475569]"
          />
          <Input
            placeholder="Company *"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
            required
            disabled={submitting}
            className="bg-[#001a33] border-[#1e3a5f] text-white placeholder:text-[#475569]"
          />
          <Input
            type="email"
            placeholder="Work email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            required
            disabled={submitting}
            className="bg-[#001a33] border-[#1e3a5f] text-white placeholder:text-[#475569]"
          />
          <Input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
            disabled={submitting}
            className="bg-[#001a33] border-[#1e3a5f] text-white placeholder:text-[#475569]"
          />
        </div>
        <Textarea
          placeholder="What accounts/territories matter most? (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={submitting}
          className="bg-[#001a33] border-[#1e3a5f] text-white placeholder:text-[#475569]"
        />
        <Button
          type="submit"
          disabled={submitting}
          className="w-full font-bold text-base py-6"
          style={{ background: accent, color: "#001a33" }}
        >
          {submitting ? "Sending…" : "Request Strategy Call →"}
        </Button>
        <p style={{ color: "#475569", fontSize: 11, textAlign: "center", margin: "8px 0 0" }}>
          No card required. No automated drip — Matt personally responds within 24 hours.
        </p>
      </form>
    </div>
  );
}
