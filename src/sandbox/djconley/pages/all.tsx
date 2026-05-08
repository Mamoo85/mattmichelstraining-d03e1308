import GenericPage from "./Generic";

export const About = () => (
  <GenericPage
    title="About D.J. Conley"
    intro="D.J. Conley Associates, Inc. has been a trusted partner for industrial and commercial boiler customers across Michigan since 1948. Three generations of engineers, technicians, and parts specialists — one mission: keep your boiler room running."
    sections={[
      { title: "Our History", body: "Founded in 1948, family-operated for 75+ years.", bullets: ["Detroit-based", "Family-operated", "75+ years"] },
      { title: "Our Team", body: "NATE-certified technicians, in-house pressure vessel experts, and a parts team that knows every line card." },
      { title: "Territory", body: "Serving all of Michigan with primary coverage in Wayne, Oakland, Macomb, Washtenaw, and Genesee counties." },
      { title: "Certifications", body: "ASME R-Stamp, National Board, factory-trained on every major burner and boiler line we represent." },
    ]}
  />
);

export const Industries = () => (
  <GenericPage
    title="Industries We Serve"
    intro="From hospitals to auto plants, food processing to municipal facilities — wherever steam or hot water keeps the operation running, D.J. Conley delivers."
    sections={[
      { title: "Healthcare", body: "Hospitals, clinics, and medical centers across SE Michigan." , bullets: ["DMC", "Henry Ford Health", "Beaumont"] },
      { title: "Automotive & Manufacturing", body: "Truck plants, stamping, paint, assembly.", bullets: ["Stellantis", "Ford", "GM Tier-1 suppliers"] },
      { title: "Education", body: "K-12 districts, community colleges, universities." },
      { title: "Government & Municipal", body: "City buildings, water plants, county facilities." },
      { title: "Food & Beverage Processing", body: "Steam for cooking, sterilization, and CIP." },
      { title: "Commercial Real Estate", body: "Office towers, hotels, large multi-tenant buildings." },
    ]}
  />
);

export const Service = () => (
  <GenericPage
    title="Service"
    intro="Our service department runs 24/7/365. Emergency response, scheduled maintenance, retrofits, and code compliance — all from factory-trained technicians."
    sections={[
      { title: "Emergency Response", body: "On-call dispatch, average response time under 2 hours in metro Detroit.", bullets: ["24/7/365", "Boiler down? Call now."] },
      { title: "Preventative Maintenance", body: "Annual or quarterly contracts, full inspection, combustion analysis." },
      { title: "Boiler Tune-Up", body: "Optimize efficiency, reduce fuel costs, extend equipment life." },
      { title: "Pressure Vessel Inspections", body: "Code compliance, R-Stamp repair, hydro testing." },
      { title: "Combustion Analysis", body: "Stack analysis, NOx/CO measurement, burner tuning." },
      { title: "Retrofits & Upgrades", body: "Burner conversions, control upgrades, efficiency upgrades." },
    ]}
  />
);

export const Parts = () => (
  <GenericPage
    title="Parts"
    intro="One of the largest in-stock boiler and burner parts inventories in the Midwest. Same-day delivery throughout SE Michigan."
    sections={[
      { title: "Boiler Parts", body: "OEM and aftermarket parts for every boiler we represent." },
      { title: "Burner Parts", body: "Nozzles, ignitors, flame safeguards, motors, blowers." },
      { title: "Controls & Sensors", body: "Honeywell, Siemens, Fireye, Cleaver-Brooks." },
      { title: "Pumps & Valves", body: "Bell & Gossett, Taco, Armstrong, Spirax Sarco." },
      { title: "Same-Day Delivery", body: "Order by 2 PM for same-day metro Detroit delivery." },
      { title: "After-Hours Parts", body: "Emergency parts available 24/7. Call our service line." },
    ]}
  />
);

export const Products = () => (
  <GenericPage
    title="Products"
    intro="We represent the most trusted manufacturers in industrial and commercial boiler equipment."
    sections={[
      { title: "Boilers", body: "Firetube, watertube, condensing, electric — Cleaver-Brooks, Fulton, Bryan, Patterson-Kelley." },
      { title: "Burners", body: "Power Flame, Webster, Coen, Industrial Combustion." },
      { title: "Hot Water & Steam Boilers", body: "Sized 100 MBH to 2,500 BHP." },
      { title: "Heat Exchangers", body: "Plate, shell-and-tube, semi-instantaneous." },
      { title: "Water Treatment", body: "Softeners, RO, chemical feed, blowdown control." },
      { title: "Stacks & Breeching", body: "Single-wall, double-wall, AL-29-4C, fabrication and installation." },
    ]}
  />
);

export const Projects = () => (
  <GenericPage
    title="Projects"
    intro="Recent installations and retrofits across Detroit and SE Michigan. We're proud of the boiler rooms we've built."
    sections={[
      { title: "DMC Boiler Plant Retrofit", body: "Full plant condensing boiler upgrade, $2.4M project." },
      { title: "Stellantis Truck Plant", body: "Steam plant expansion, NFPA compliance upgrade." },
      { title: "Wayne County Schools", body: "District-wide boiler replacement program, 12 buildings." },
      { title: "Henry Ford Health", body: "Emergency boiler replacement, 72-hour turnaround." },
    ]}
  />
);

export const Rentals = () => (
  <GenericPage
    title="Rentals"
    intro="Mobile boiler rentals — daily, weekly, monthly. Fully-trailered units, ready to deploy when your plant goes down or during a planned shutdown."
    sections={[
      { title: "Mobile Steam Boilers", body: "From 100 BHP to 800 BHP, fully self-contained." },
      { title: "Mobile Hot Water Boilers", body: "For temporary heat, construction, or backup." },
      { title: "Heat Exchangers", body: "Trailer-mounted, ready to drop in." },
      { title: "Emergency Deployment", body: "Plant down? We can have a unit on-site within 24 hours." },
    ]}
  />
);

export const Education = () => (
  <GenericPage
    title="Education & Training"
    intro="Boiler operator training, factory schools, and lunch-and-learns for facilities teams."
    sections={[
      { title: "Boiler Operator Training", body: "Annual and on-site training programs." },
      { title: "Factory Schools", body: "Manufacturer-led training events at our Troy facility." },
      { title: "Lunch-and-Learns", body: "We come to you — free training for your team." },
      { title: "Code Compliance Workshops", body: "ASME, NFPA, state and local code reviews." },
    ]}
  />
);

export const Resources = () => (
  <GenericPage
    title="Resources"
    intro="Line cards, territory maps, technical documents, and downloads for facilities professionals."
    sections={[
      { title: "Service Line Card", body: "Full list of equipment we service." },
      { title: "Sales Line Card", body: "Manufacturers we represent." },
      { title: "Territory Map", body: "Counties and regions we serve." },
      { title: "Technical Documents", body: "Spec sheets, installation guides, troubleshooting." },
    ]}
  />
);

export const Careers = () => (
  <GenericPage
    title="Careers"
    intro="Join one of Michigan's most respected boiler service teams. We hire technicians, parts specialists, salespeople, and engineers."
    sections={[
      { title: "Service Technician", body: "Field service, mechanical, NATE/ASME welcomed. Top pay + truck + benefits." },
      { title: "Parts Specialist", body: "In-house parts counter, full benefits." },
      { title: "Sales Engineer", body: "Industrial / commercial boiler sales, base + commission." },
      { title: "Apprentice Program", body: "Learn the trade. Paid apprenticeship." },
    ]}
  />
);

export const Contact = () => (
  <GenericPage
    title="Contact"
    intro="Boiler down? Need a quote? We answer the phone 24/7."
    sections={[
      { title: "Service Line (24/7)", body: "(248) 585-5340" },
      { title: "Parts Counter", body: "(248) 585-5340 ext. 2 — Mon–Fri 7 AM – 5 PM" },
      { title: "Sales", body: "service@djconley.com" },
      { title: "Address", body: "Troy, MI 48083" },
    ]}
  />
);
