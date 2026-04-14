import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ===== Corporate Name Filter Tests =====
// Reimplemented from index.ts to test in isolation

const CORPORATE_PATTERN = /\b(LLC|Inc|Corp|School|Casino|Hospital|Health\s*System|University|Energy|Solutions|Administration|Academy|Institute|Staffing|Group|Services|Sons|Mechanical|Electric|Company|Associates|Enterprises|Foundation|Authority|Board|Commission|Department|District|Center|Clinic|Medical|Nursing\s+Home|Assisted\s+Living|Home\s+Care|Senior\s+Living|Public\s+Schools|Community\s+College|Rehabilitation|Management|Consulting|Industries|Manufacturing|Plumbing|Heating|Cooling|Roofing|Construction|Contractors|Builders|Supply|Wholesale|Distributors|Holdings|Properties|Realty|Insurance|Financial|Bank|Credit\s+Union|Transit|Utility|Utilities|Water|Sewer|Electric\s+Co|Power|Township|County|City\s+of|State\s+of|Federal)\b/i;

function isCorporateName(name: string): boolean {
  if (!name) return true;
  if (CORPORATE_PATTERN.test(name)) return true;
  if (name === name.toUpperCase() && name.split(/\s+/).length > 3) return true;
  if (/\b(of the|of)\b/i.test(name) && name.split(/\s+/).length > 3) return true;
  if (name.trim().split(/\s+/).length === 1 && name.length > 3) return true;
  if (/\s&\s/.test(name)) return true;
  return false;
}

// --- Corporate names that MUST be filtered ---
Deno.test("Filters corporate names with LLC/Inc/Corp", () => {
  assertEquals(isCorporateName("ABC Plumbing LLC"), true);
  assertEquals(isCorporateName("Johnson Electric Inc"), true);
  assertEquals(isCorporateName("Metro HVAC Corp"), true);
});

Deno.test("Filters schools and casinos", () => {
  assertEquals(isCorporateName("Detroit Academy of Arts & Sciences"), true);
  assertEquals(isCorporateName("MotorCity Casino"), true);
  assertEquals(isCorporateName("Wayne State University"), true);
});

Deno.test("Filters staffing agencies and hospitals", () => {
  assertEquals(isCorporateName("Veolia Energy"), true);
  assertEquals(isCorporateName("Beaumont Hospital"), true);
  assertEquals(isCorporateName("ProCare Staffing"), true);
  assertEquals(isCorporateName("Henry Ford Health System"), true);
});

Deno.test("Filters single-word names (likely org abbreviations)", () => {
  assertEquals(isCorporateName("Veolia"), true);
  assertEquals(isCorporateName("Consumers"), true);
});

Deno.test("Filters all-caps multi-word names (likely orgs)", () => {
  assertEquals(isCorporateName("DETROIT PUBLIC SCHOOLS COMMUNITY DISTRICT"), true);
  assertEquals(isCorporateName("MICHIGAN STATE POLICE DEPARTMENT"), true);
});

Deno.test("Filters names with 'of' pattern (likely orgs)", () => {
  assertEquals(isCorporateName("City of Detroit Water Department"), true);
  assertEquals(isCorporateName("Board of Education of the City"), true);
});

Deno.test("Filters names with ampersand (likely firms)", () => {
  assertEquals(isCorporateName("Smith & Sons Plumbing"), true);
  assertEquals(isCorporateName("Johnson & Johnson"), true);
});

// --- Real people names that MUST pass ---
Deno.test("Passes normal two-word person names", () => {
  assertEquals(isCorporateName("Robert Chen"), false);
  assertEquals(isCorporateName("Angela Peters"), false);
  assertEquals(isCorporateName("James Williams"), false);
  assertEquals(isCorporateName("Maria Rodriguez"), false);
});

Deno.test("Passes three-word person names", () => {
  assertEquals(isCorporateName("Mary Jane Watson"), false);
  assertEquals(isCorporateName("John Paul Smith"), false);
});

Deno.test("Passes hyphenated last names", () => {
  assertEquals(isCorporateName("Sarah Johnson-Williams"), false);
});

Deno.test("Rejects empty/null-like names", () => {
  assertEquals(isCorporateName(""), true);
});

// ===== Scoring Logic Tests =====

Deno.test("BPL source gets +3 bonus in fallback scoring", () => {
  // Simulating the fallback scoring from index.ts lines 714-728
  const isBPL = true;
  const isMIOSHA = false;
  const isJobBoard = false;
  const hasLicenseNumber = true;
  const hasPhone = false;
  const hasEmail = false;
  const licenseRecent = true;

  let score = 4; // base
  if (isBPL) score += 3;
  if (isMIOSHA && hasLicenseNumber) score += 1;
  if (isJobBoard) score += 1;
  if (hasLicenseNumber) score += 1;
  if (hasLicenseNumber && licenseRecent) score += 2;
  if (hasPhone) score += 1;
  if (hasEmail) score += 1;
  if (!hasLicenseNumber && isJobBoard) score -= 2;
  if (!hasLicenseNumber && isMIOSHA) score -= 2;
  score = Math.min(10, Math.max(1, score));

  // 4 (base) + 3 (BPL) + 1 (license) + 2 (recent) = 10
  assertEquals(score, 10);
});

Deno.test("MIOSHA with license gets +1 bonus", () => {
  const isBPL = false;
  const isMIOSHA = true;
  const isJobBoard = false;
  const hasLicenseNumber = true;
  const hasPhone = true;
  const hasEmail = false;
  const licenseRecent = false;

  let score = 4;
  if (isBPL) score += 3;
  if (isMIOSHA && hasLicenseNumber) score += 1;
  if (isJobBoard) score += 1;
  if (hasLicenseNumber) score += 1;
  if (hasLicenseNumber && licenseRecent) score += 2;
  if (hasPhone) score += 1;
  if (hasEmail) score += 1;
  if (!hasLicenseNumber && isJobBoard) score -= 2;
  if (!hasLicenseNumber && isMIOSHA) score -= 2;
  score = Math.min(10, Math.max(1, score));

  // 4 + 1 (MIOSHA w/license) + 1 (license) + 1 (phone) = 7
  assertEquals(score, 7);
});

Deno.test("MIOSHA without license gets -2 penalty", () => {
  const isBPL = false;
  const isMIOSHA = true;
  const isJobBoard = false;
  const hasLicenseNumber = false;
  const hasPhone = false;
  const hasEmail = false;
  const licenseRecent = false;

  let score = 4;
  if (isBPL) score += 3;
  if (isMIOSHA && hasLicenseNumber) score += 1;
  if (isJobBoard) score += 1;
  if (hasLicenseNumber) score += 1;
  if (hasLicenseNumber && licenseRecent) score += 2;
  if (hasPhone) score += 1;
  if (hasEmail) score += 1;
  if (!hasLicenseNumber && isJobBoard) score -= 2;
  if (!hasLicenseNumber && isMIOSHA) score -= 2;
  score = Math.min(10, Math.max(1, score));

  // 4 - 2 = 2
  assertEquals(score, 2);
});

Deno.test("Job board without license gets -2 penalty", () => {
  const isBPL = false;
  const isMIOSHA = false;
  const isJobBoard = true;
  const hasLicenseNumber = false;
  const hasPhone = true;
  const hasEmail = true;
  const licenseRecent = false;

  let score = 4;
  if (isBPL) score += 3;
  if (isMIOSHA && hasLicenseNumber) score += 1;
  if (isJobBoard) score += 1;
  if (hasLicenseNumber) score += 1;
  if (hasLicenseNumber && licenseRecent) score += 2;
  if (hasPhone) score += 1;
  if (hasEmail) score += 1;
  if (!hasLicenseNumber && isJobBoard) score -= 2;
  if (!hasLicenseNumber && isMIOSHA) score -= 2;
  score = Math.min(10, Math.max(1, score));

  // 4 + 1 (job board) + 1 (phone) + 1 (email) - 2 (no license) = 5
  assertEquals(score, 5);
});

Deno.test("Job board WITH license gets no penalty", () => {
  const isBPL = false;
  const isMIOSHA = false;
  const isJobBoard = true;
  const hasLicenseNumber = true;
  const hasPhone = true;
  const hasEmail = true;
  const licenseRecent = false;

  let score = 4;
  if (isBPL) score += 3;
  if (isMIOSHA && hasLicenseNumber) score += 1;
  if (isJobBoard) score += 1;
  if (hasLicenseNumber) score += 1;
  if (hasLicenseNumber && licenseRecent) score += 2;
  if (hasPhone) score += 1;
  if (hasEmail) score += 1;
  if (!hasLicenseNumber && isJobBoard) score -= 2;
  if (!hasLicenseNumber && isMIOSHA) score -= 2;
  score = Math.min(10, Math.max(1, score));

  // 4 + 1 (job board) + 1 (license) + 1 (phone) + 1 (email) = 8
  assertEquals(score, 8);
});

// ===== Source Hierarchy Tests =====

Deno.test("Source hierarchy: BPL candidates come first in merged array", () => {
  const bpl = [{ full_name: "BPL Person", source: "bpl" }];
  const miosha = [{ full_name: "MIOSHA Person", source: "miosha" }];
  const jobboards = [{ full_name: "JB Person", source: "firecrawl" }];

  const allRaw = [...bpl, ...miosha, ...jobboards];
  assertEquals(allRaw[0].source, "bpl");
  assertEquals(allRaw[1].source, "miosha");
  assertEquals(allRaw[2].source, "firecrawl");
});

Deno.test("Deduplication prefers BPL over MIOSHA for same person", () => {
  const allRaw = [
    { full_name: "John Smith", city: "Detroit", source: "bpl", license_number: "BL-12345" },
    { full_name: "John Smith", city: "Detroit", source: "miosha", license_number: "BL-12345" },
    { full_name: "John Smith", city: "Detroit", source: "firecrawl", license_number: null },
  ];

  const seen = new Set<string>();
  const deduped = allRaw.filter((c) => {
    const key = c.license_number || `${c.full_name.toLowerCase()}-${(c.city || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  assertEquals(deduped.length, 1);
  assertEquals(deduped[0].source, "bpl");
});

// ===== Healthcare Role Detection =====

Deno.test("Healthcare keyword detection", () => {
  const HEALTHCARE_KEYWORDS = ["rn", "registered nurse", "lpn", "licensed practical nurse", "practical nurse", "cna", "certified nursing assistant", "nurse aide", "nursing assistant", "director of nursing", "don", "nursing director", "home health aide", "home health", "hha", "nurse", "nursing"];

  function isHealthcareRole(licenseType?: string): boolean {
    if (!licenseType) return false;
    const lower = licenseType.toLowerCase();
    return HEALTHCARE_KEYWORDS.some((kw) => lower.includes(kw));
  }

  assertEquals(isHealthcareRole("RN/LPN"), true);
  assertEquals(isHealthcareRole("CNA"), true);
  assertEquals(isHealthcareRole("Registered Nurse"), true);
  assertEquals(isHealthcareRole("Home Health Aide"), true);
  assertEquals(isHealthcareRole("Boiler Operator"), false);
  assertEquals(isHealthcareRole("HVAC Technician"), false);
  assertEquals(isHealthcareRole("Master Electrician"), false);
  assertEquals(isHealthcareRole(undefined), false);
});
