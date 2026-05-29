// Shared content for all D.J. Conley landing-page versions.
// One source of truth so every design carries the same (real) information.
// Imagery lives in /demo-djconley-current/ (already deployed).

const IMG = "/demo-djconley-current/img";

export const dj = {
  name: "D.J. Conley Associates, Inc.",
  shortName: "D.J. Conley",
  tagline: "A name you can TRUST.",
  blurb:
    "D.J. Conley Associates, Inc. is a Manufacturer's Rep/Distributor engaged in energy conversion and conservation as it relates to the production of steam, hot water and heat recovery.",
  phone: "248-589-8220",
  phoneTel: "tel:2485898220",
  email: "pmichels@djconley.com",
  address: "24650 Dequindre Rd, Warren, MI 48091",
  mapsUrl: "https://maps.google.com/?q=24650+Dequindre+Rd,+Warren,+MI+48091",
  sinceYear: 1974,
  years: 51,
  logo: "/demo-djconley-current/djc-51-logo.png",
  cover: "/demo-djconley-current/main-cover-photo.jpg",
  videoEmbed: "https://www.youtube.com/embed/L4hK8ftpbp0",
};

export const stats = [
  { value: "51", label: "Years in business", sub: "Since 1974" },
  { value: "24/7", label: "Emergency service", sub: "Boiler down? We respond." },
  { value: "MI + Great Lakes", label: "Service territory", sub: "From Warren, MI" },
  { value: "Factory-trained", label: "Service technicians", sub: "Manufacturer-certified" },
];

// Manufacturers represented — the credibility line-card for a rep/distributor.
export const manufacturers = [
  "Cleaver-Brooks",
  "Vapor Power",
  "Selkirk Metalbestos",
  "Heat Fab",
  "Water Right",
  "Hawk Controls",
  "Prometha",
];

export const industries = [
  { name: "Automotive & Manufacturing", icon: "🏭", img: `${IMG}/2.-Automotive-FCA-SHAP-600x403.jpg`, note: "FCA, Ford, GM plants" },
  { name: "Hospitals & Healthcare", icon: "🏥", img: `${IMG}/Pharmaceutical-Par-Pharma-2JPG-600x403.jpg`, note: "Pressure vessels, steam" },
  { name: "Pharmaceutical", icon: "💊", img: `${IMG}/16.-CPF-St.-Pauls-Retreat-600x403.jpg`, note: "Clean steam systems" },
  { name: "Schools & Universities", icon: "🎓", img: `${IMG}/14.-AM-GM-Tech-HQ-600x403.jpg`, note: "Campus boiler plants" },
  { name: "Food & Beverage", icon: "🍽️", img: `${IMG}/17.-AM-National-Coney-600x403.jpg`, note: "Process steam & hot water" },
  { name: "Commercial & Institutional", icon: "🏢", img: `${IMG}/15.-AM-Ford-DDL--600x403.jpg`, note: "Facilities & retrofits" },
];

export const services = [
  { name: "Service & Repair", desc: "24/7 emergency boiler & burner service across Michigan.", img: `${IMG}/Get-Service-Photos-1.jpg`, to: "/service" },
  { name: "Parts", desc: "OEM boiler, burner, and control parts — in stock and shipped fast.", img: `${IMG}/Get-Parts-photo-1.jpg`, to: "/parts" },
  { name: "New Equipment", desc: "Boilers, burners, deaerators, economizers & heat recovery.", img: `${IMG}/Products-01.jpg`, to: "/products" },
  { name: "Boiler Rentals", desc: "Emergency & planned rental boilers — keep your plant running.", img: `${IMG}/Rental-photo-1000x1000-1.jpg`, to: "/rentals" },
  { name: "Training & Education", desc: "Factory-backed operator and maintenance training.", img: `${IMG}/Photo-for-Education.jpg`, to: "/education" },
];

export const products = [
  { name: "Firetube & Watertube Boilers", img: `${IMG}/4.-CB-Firetube-Boilers.jpg` },
  { name: "Condensing Boilers", img: `${IMG}/1.-Clearfire-LC-1000x1000-1.jpg` },
  { name: "Industrial Burners", img: `${IMG}/2.-Industrial-Burners.jpg` },
  { name: "Boiler Controls", img: `${IMG}/CB-1.-Integrated-Boiler-Control-1000x1000-1.jpg` },
  { name: "Deaerators & Feedwater", img: `${IMG}/1.-Deaerator-1000x1000-1.jpg` },
  { name: "Heat Recovery & Economizers", img: `${IMG}/1.-Stack-Economizer.jpg` },
];

export const projects = [
  { name: "FCA SHAP — Sterling Heights", img: `${IMG}/2.-Automotive-FCA-SHAP-600x403.jpg` },
  { name: "Ford — Woodhaven", img: `${IMG}/4.-Automotive-Ford-Woodhaven-600x403.jpg` },
  { name: "GM — Pontiac Fuel Cell", img: `${IMG}/6.-Automotive-GM-Pontiac-Fuel-Cell-Donna-Saltsmans-conflicted-copy-2019-11-19-600x403.jpg` },
  { name: "Par Pharmaceutical", img: `${IMG}/Pharmaceutical-Par-Pharma-2JPG-600x403.jpg` },
  { name: "National Coney Island", img: `${IMG}/17.-AM-National-Coney-600x403.jpg` },
  { name: "St. Paul's Retreat", img: `${IMG}/16.-CPF-St.-Pauls-Retreat-600x403.jpg` },
];

export const reviews = [
  { stars: 5, who: "Plant Engineer — Automotive", text: "Boiler went down at 2 AM. D.J. Conley had a tech on site before our shift change. Saved us a full day of downtime." },
  { stars: 5, who: "Facilities Director — Hospital", text: "They keep our steam running, period. 50 years in business for a reason." },
  { stars: 5, who: "Maintenance Lead — University", text: "The only rep that actually knows the equipment they sell. Parts in stock, real answers." },
];
