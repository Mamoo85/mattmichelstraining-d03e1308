import { Link } from "react-router-dom";

const QUICK_LINKS = [
  ["Home", "/sandbox/djconley"],
  ["About D.J. Conley", "/sandbox/djconley/about"],
  ["Industries We Serve", "/sandbox/djconley/industries"],
  ["Contact Us", "/sandbox/djconley/contact"],
  ["Terms & Conditions", "#"],
  ["Sales Line Card", "/sandbox/djconley/products"],
  ["Service Line Card", "/sandbox/djconley/service"],
  ["Blog", "#"],
];
const SERVICES = [
  ["Boiler Parts", "/sandbox/djconley/parts"],
  ["Boiler Services", "/sandbox/djconley/service"],
  ["New Equipment", "/sandbox/djconley/new-boiler-solutions"],
  ["Boiler Rental", "/sandbox/djconley/rentals"],
  ["Training & Education", "/sandbox/djconley/education"],
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#1a1a1a] text-white">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-14 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <h4 className="mb-5 text-2xl font-semibold">Quick Links</h4>
          <ul className="space-y-2">
            {QUICK_LINKS.map(([label, href]) => (
              <li key={label}>
                <Link to={href} className="text-white/80 hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-5 text-2xl font-semibold">Services</h4>
          <ul className="space-y-2">
            {SERVICES.map(([label, href]) => (
              <li key={label}>
                <Link to={href} className="text-white/80 hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <h4 className="mb-5 mt-8 text-2xl font-semibold">Territory</h4>
          <p className="text-white/80">View Map</p>
        </div>

        <div>
          <h4 className="mb-5 text-2xl font-semibold">Location</h4>
          <p className="text-white/80">
            26225 Sherwood
            <br />
            Warren, Michigan&nbsp;&nbsp;48091
          </p>
          <p className="mt-4 text-sm text-white/70">
            If you are located outside of our service area and need Boiler sales or service,
            please visit the Cleaver-Brooks Representatives Association to locate a rep near you.{" "}
            <a href="https://www.cbrep.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#e30613] hover:underline">
              CBRA – Find a rep.
            </a>
          </p>

          <h4 className="mb-3 mt-8 text-2xl font-semibold">Connect with Us</h4>
          <div className="flex gap-3">
            <span className="grid h-10 w-10 place-items-center rounded bg-white/10 text-xs font-bold">f</span>
            <span className="grid h-10 w-10 place-items-center rounded bg-white/10 text-xs font-bold">in</span>
          </div>

          <h4 className="mb-3 mt-8 text-2xl font-semibold">Careers</h4>
          <p className="text-white/80">
            Click below to view current openings.
          </p>
          <Link
            to="/sandbox/djconley/careers"
            className="mt-3 inline-block rounded-full border-2 border-[#e30613] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#e30613] hover:bg-[#e30613] hover:text-white"
          >
            Current Openings
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-white/50">
        © 2026 D.J. Conley.
      </div>
    </footer>
  );
}
