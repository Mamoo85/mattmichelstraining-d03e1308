import { useEffect, useState } from "react";
import AdminShell, { AdminPageHeader } from "./AdminShell";
import { SITE_VERSIONS } from "../landings/registry";
import { getSiteVersion, setSiteVersion } from "../landings/useSiteVersion";
import { djPath } from "../links";
import { ExternalLink, Check, Mail } from "lucide-react";

const MATT_EMAIL = "matt@detroitwebagent.com";

export default function SiteVersions() {
  const [selected, setSelected] = useState<string>("classic");

  useEffect(() => { setSelected(getSiteVersion()); }, []);

  const choose = (id: string) => { setSiteVersion(id); setSelected(id); };

  const previewUrl = (id: string) => `${djPath("/v")}/${id}`;

  const tellMatt = (name: string, id: string) => {
    setSiteVersion(id); setSelected(id);
    const subject = `D.J. Conley — we'd like the "${name}" website design`;
    const body = `Hi Matt,\n\nWe reviewed the website options and we'd like to go with:\n\n  ${name}\n  ${window.location.origin}${previewUrl(id)}\n\nLet's move forward with this one.\n\n— D.J. Conley`;
    window.location.href = `mailto:${MATT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <AdminShell>
      <AdminPageHeader
        title="Website Versions"
        subtitle="Compare each design, preview it full-screen, and choose the one you like best. Every version keeps all your current pages, info and links — only the landing page changes."
        accent="Choose Your Design"
      />
      <div className="p-6">
        <div className="grid lg:grid-cols-2 gap-5">
          {SITE_VERSIONS.map((v) => {
            const isSel = selected === v.id;
            return (
              <div key={v.id} className={`bg-[#111d2b] rounded-xl overflow-hidden border transition ${isSel ? "border-[#27CCC0] ring-1 ring-[#27CCC0]/40" : "border-white/8"}`}>
                {/* Live scaled thumbnail */}
                <div className="relative h-[260px] overflow-hidden bg-[#0b1622] border-b border-white/5">
                  <iframe
                    title={`${v.name} preview`}
                    src={previewUrl(v.id)}
                    className="origin-top-left pointer-events-none"
                    style={{ width: "1280px", height: "1000px", transform: "scale(0.43)", border: 0 }}
                    loading="lazy"
                    scrolling="no"
                  />
                  <a
                    href={previewUrl(v.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 grid place-items-center bg-[#0b1622]/0 hover:bg-[#0b1622]/40 transition group"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-2 bg-white text-[#0b1622] font-bold text-sm px-4 py-2 rounded-full">
                      <ExternalLink className="h-4 w-4" /> Open full-screen
                    </span>
                  </a>
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-1 rounded" style={{ background: v.accent }}>Version {v.num}</span>
                    {isSel && <span className="text-[10px] font-bold uppercase tracking-wider bg-[#27CCC0] text-[#0b1622] px-2 py-1 rounded inline-flex items-center gap-1"><Check className="h-3 w-3" /> Selected</span>}
                  </div>
                </div>

                <div className="p-5">
                  <div className="text-lg font-bold text-white">{v.name}</div>
                  <div className="text-[11px] uppercase tracking-wider text-[#27CCC0] mb-2">{v.archetype}</div>
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">{v.blurb}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={previewUrl(v.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold border border-white/15 text-white px-4 py-2 rounded-md hover:bg-white/5 transition">
                      <ExternalLink className="h-4 w-4" /> Preview
                    </a>
                    <button onClick={() => choose(v.id)} disabled={isSel} className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md transition ${isSel ? "bg-[#27CCC0]/20 text-[#27CCC0] cursor-default" : "bg-white/10 text-white hover:bg-white/20"}`}>
                      <Check className="h-4 w-4" /> {isSel ? "Live preview" : "Set as live preview"}
                    </button>
                    <button onClick={() => tellMatt(v.name, v.id)} className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#c12a3b] hover:bg-[#a8222f] text-white px-4 py-2 rounded-md transition">
                      <Mail className="h-4 w-4" /> This is the one
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 mt-6 max-w-[760px]">
          "Set as live preview" updates what shows on your sandbox home page in this browser so you can live with a design before deciding. "This is the one" emails your choice to Detroit Web Agency. Nothing is published to djconley.com until you give the final go-ahead.
        </p>
      </div>
    </AdminShell>
  );
}
