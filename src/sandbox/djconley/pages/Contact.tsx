import { useState } from "react";
import SiteLayout from "../SiteLayout";
import { supabase } from "@/integrations/supabase/client";

const departments = [
  { label: "Engineered Solutions", email: "equipment.sales@djconley.com" },
  { label: "Service, Training & Technical Information", email: "service@djconley.com" },
  { label: "Parts", email: "parts@djconley.com" },
  { label: "Human Resources", email: "hresources@djconley.com" },
  { label: "Billing Inquiries", email: "accounting@djconley.com" },
];

const topics = ["Service", "Parts", "Products", "Education", "General Information"];

export default function DJContact() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("General Information");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMsg("Please fill in name, email, and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setStatus("sending");
    try {
      const { data, error } = await supabase.functions.invoke("dj-conley-contact", {
        body: { name, company, email, topic, message, website },
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw new Error(error?.message || (data as { error?: string }).error || "Send failed");
      }
      setStatus("sent");
      setName(""); setCompany(""); setEmail(""); setTopic("General Information"); setMessage("");
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message || "Something went wrong. Please call 248-589-8220.");
    }
  };

  return (
    <SiteLayout title="Contact">
      <div className="mx-auto max-w-[1100px] px-6 py-12 md:px-8">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Left: contact info */}
          <div>
            <h2 className="mb-4 text-2xl font-semibold text-[#222]">D. J. Conley Associates, Inc.</h2>
            <p className="mb-1 text-[15px] text-[#555]">26225 Sherwood</p>
            <p className="mb-4 text-[15px] text-[#555]">Warren, Michigan 48091</p>
            <p className="mb-1 text-[15px] text-[#555]">
              Main: <a href="tel:2485898220" className="text-[#e30613] hover:underline">248-589-8220</a>
            </p>
            <p className="mb-8 text-[15px] text-[#555]">Fax: 248-589-3744</p>

            <a
              href="mailto:service@djconley.com"
              className="mb-10 inline-block rounded-full border-2 border-[#e30613] bg-[#e30613] px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-transparent hover:text-[#e30613]"
            >
              Get Service
            </a>

            <div className="space-y-5">
              {departments.map((d) => (
                <div key={d.email}>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#222]">{d.label}</h4>
                  <a href={`mailto:${d.email}`} className="text-[15px] text-[#e30613] hover:underline">
                    {d.email}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div>
            <h2 className="mb-2 text-2xl font-semibold text-[#222]">Get in touch with us</h2>
            <p className="mb-6 text-sm text-[#888]">Fields marked with an * are required.</p>

            {status === "sent" ? (
              <div className="rounded border border-green-200 bg-green-50 p-6 text-[#1a5d2b]">
                <h3 className="mb-2 text-lg font-semibold">Thanks — we got your message.</h3>
                <p className="text-sm leading-6">
                  A member of our team will be in touch shortly. For urgent service needs, call{" "}
                  <a href="tel:2485898220" className="font-semibold underline">248-589-8220</a>.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-4 text-sm font-semibold text-[#e30613] underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#444]">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    required
                    className="w-full border border-[#ccc] px-4 py-3 text-[15px] focus:border-[#e30613] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#444]">Company</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    maxLength={160}
                    className="w-full border border-[#ccc] px-4 py-3 text-[15px] focus:border-[#e30613] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#444]">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={200}
                    required
                    className="w-full border border-[#ccc] px-4 py-3 text-[15px] focus:border-[#e30613] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#444]">What can we help with?</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full border border-[#ccc] bg-white px-4 py-3 text-[15px] focus:border-[#e30613] focus:outline-none"
                  >
                    {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#444]">Message *</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    required
                    className="w-full border border-[#ccc] px-4 py-3 text-[15px] focus:border-[#e30613] focus:outline-none"
                  />
                </div>

                {/* Honeypot */}
                <div className="absolute left-[-9999px]" aria-hidden="true">
                  <label>If you are a human seeing this field, please leave it empty.</label>
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="rounded-full border-2 border-[#e30613] bg-[#e30613] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-transparent hover:text-[#e30613] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "sending" ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
