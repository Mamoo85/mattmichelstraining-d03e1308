import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ActionButton from "@/components/ui/action-button";

const SLOT_TIMES = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

function nextBusinessDays(count: number) {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (out.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
}
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function BookDemo() {
  const [params] = useSearchParams();
  const days = useMemo(() => nextBusinessDays(10), []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [demoType, setDemoType] = useState<"discovery_15" | "full_30">("discovery_15");
  const [name, setName] = useState(params.get("name") ?? "");
  const [company, setCompany] = useState(params.get("company") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(params.get("website") ?? "");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Book a demo — Detroit Web Agency";
  }, []);

  async function submit() {
    setError(null);
    if (!selectedDate || !selectedTime) {
      setError("Pick a date and time first.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    const { data, error: e } = await supabase.functions.invoke("create-demo-booking", {
      body: {
        prospect_email: email.trim(),
        prospect_name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        slot_date: isoDate(selectedDate),
        slot_time: selectedTime,
        demo_type: demoType,
        notes: notes.trim() || undefined,
        source: params.get("source") ?? "book-demo-page",
      },
    });
    if (e || (data as { error?: unknown })?.error) {
      setError("Something went wrong. Text Matt at (313) 992-1219 and we'll lock it in.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", color: "#fff", padding: "60px 20px", fontFamily: "-apple-system,Segoe UI,sans-serif" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>🎯</div>
          <h1 style={{ color: "#00d4ff", fontSize: 28, marginTop: 12 }}>You're booked.</h1>
          <p style={{ color: "#94a3b8", marginTop: 12, lineHeight: 1.6 }}>
            {selectedDate && selectedTime
              ? `${fmtDate(selectedDate)} at ${fmtTime(selectedTime)} ET — confirmation email is on the way.`
              : "Confirmation email is on the way."}
          </p>
          <p style={{ color: "#94a3b8", marginTop: 18, fontSize: 14 }}>
            I'll send the meeting link a few hours before. Need anything sooner? Text me at <strong style={{ color: "#fff" }}>(313) 992-1219</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", color: "#fff", padding: "40px 20px 80px", fontFamily: "-apple-system,Segoe UI,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Detroit Web Agency</div>
        <h1 style={{ fontSize: 32, margin: "8px 0 6px", lineHeight: 1.15 }}>Book your demo</h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>Pick a slot — I'll show you exactly what we'd build for your business.</p>

        <div style={{ marginTop: 28 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>Demo type</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(["discovery_15", "full_30"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDemoType(t)}
                style={{
                  padding: "14px 12px",
                  borderRadius: 10,
                  border: `1px solid ${demoType === t ? "#00d4ff" : "#1e3a5f"}`,
                  background: demoType === t ? "rgba(0,212,255,0.08)" : "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: "left",
                }}
              >
                {t === "discovery_15" ? "15-min discovery" : "30-min full demo"}
                <div style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12, marginTop: 4 }}>
                  {t === "discovery_15" ? "Quick fit check, no screenshare." : "Live walkthrough + screenshare."}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>Date</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {days.map((d) => {
              const active = selectedDate && isoDate(selectedDate) === isoDate(d);
              return (
                <button
                  key={isoDate(d)}
                  onClick={() => { setSelectedDate(d); setSelectedTime(null); }}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 84,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${active ? "#00d4ff" : "#1e3a5f"}`,
                    background: active ? "rgba(0,212,255,0.08)" : "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {fmtDate(d)}
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div style={{ marginTop: 24 }}>
            <div style={{ color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>Time (ET)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {SLOT_TIMES.map((t) => {
                const active = selectedTime === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedTime(t)}
                    style={{
                      padding: "12px 6px",
                      borderRadius: 10,
                      border: `1px solid ${active ? "#00d4ff" : "#1e3a5f"}`,
                      background: active ? "rgba(0,212,255,0.08)" : "transparent",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {fmtTime(t)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
          {[
            { label: "Your name *", value: name, set: setName, type: "text", placeholder: "Anne-Abel Smith" },
            { label: "Company", value: company, set: setCompany, type: "text", placeholder: "White Light Electric" },
            { label: "Email *", value: email, set: setEmail, type: "email", placeholder: "you@company.com" },
            { label: "Phone", value: phone, set: setPhone, type: "tel", placeholder: "(248) 555-1234" },
            { label: "Website", value: website, set: setWebsite, type: "url", placeholder: "yourcompany.com" },
          ].map((f) => (
            <label key={f.label} style={{ display: "block" }}>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>{f.label}</div>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #1e3a5f", background: "#0f1d33", color: "#fff", fontSize: 15 }}
              />
            </label>
          ))}
          <label style={{ display: "block" }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>Anything specific you want to see? (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid #1e3a5f", background: "#0f1d33", color: "#fff", fontSize: 15, fontFamily: "inherit" }}
            />
          </label>
        </div>

        {error && <div style={{ marginTop: 16, color: "#fca5a5", fontSize: 14 }}>{error}</div>}

        <div style={{ marginTop: 24 }}>
          <ActionButton onClick={submit} busyLabel="Booking…">Confirm demo</ActionButton>
          <p style={{ color: "#64748b", fontSize: 12, marginTop: 12, textAlign: "center" }}>
            Prefer to text? <a href="sms:+13139921219" style={{ color: "#00d4ff" }}>(313) 992-1219</a>
          </p>
        </div>
      </div>
    </div>
  );
}
