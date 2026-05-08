import SiteLayout from "../SiteLayout";

interface Section {
  title: string;
  body: string;
  bullets?: string[];
}

interface Props {
  title: string;
  intro: string;
  sections?: Section[];
}

/** Reusable page template for the secondary nav routes. */
export default function GenericPage({ title, intro, sections = [] }: Props) {
  return (
    <SiteLayout title={title}>
      <div className="max-w-[1100px] mx-auto px-5 py-16">
        <p className="text-xl text-slate-700 leading-relaxed mb-12 max-w-3xl">{intro}</p>

        <div className="grid md:grid-cols-2 gap-8">
          {sections.map((s) => (
            <div key={s.title} className="border-l-4 border-[#27CCC0] pl-5">
              <h2 className="text-xl font-bold mb-2">{s.title}</h2>
              <p className="text-slate-600 mb-3">{s.body}</p>
              {s.bullets && (
                <ul className="space-y-1 text-sm text-slate-700">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-[#c12a3b]">▸</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
