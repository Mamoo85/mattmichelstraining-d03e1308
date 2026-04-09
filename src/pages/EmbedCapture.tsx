import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const EmbedCapture = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const { data: inserted, error: insertError } = await supabase
        .from("capture_submissions")
        .insert({
          tenant_id: tenantId,
          email: email.trim(),
          name: name.trim() || null,
          source_url: window.location.href,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Fire enrichment in background — don't block the UI
      if (inserted?.id) {
        supabase.functions.invoke("capture-enrich", {
          body: { submission_id: inserted.id },
        }).catch(console.error);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: "transparent" }}>
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-6 text-center">
          <div className="text-3xl mb-2">✓</div>
          <p className="text-white font-medium">Thank you!</p>
          <p className="text-white/60 text-sm mt-1">We'll be in touch soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: "transparent" }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-6 space-y-4"
      >
        <h2 className="text-white font-semibold text-center">Get in Touch</h2>

        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
        />

        <input
          type="email"
          required
          placeholder="Email address *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
        />

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold py-2.5 text-sm transition disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default EmbedCapture;
