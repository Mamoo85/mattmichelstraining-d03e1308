// M2 MIOSHA & BPL License Scraper Actor
// Downloads Michigan LARA BPL Excel files + Florida DBPR CSVs,
// parses with SheetJS, pushes normalized candidate rows to dataset.

import { Actor } from 'apify';
import * as XLSX from 'xlsx';

await Actor.init();

const input = (await Actor.getInput()) || {};
const licenseTypes = input.licenseTypes || ['boiler', 'electrical', 'plumbing', 'hvac', 'nursing'];
const states = input.states || ['michigan'];
const mode = input.mode || 'excel';
const tradeTypes = input.tradeTypes || licenseTypes;

console.log('Actor started with input:', JSON.stringify({ licenseTypes, states }));

// Michigan LARA BPL Excel download URLs (publicly available data dumps).
// These URLs change occasionally — verify against https://www.michigan.gov/lara/bureau-list/bpl
const MI_LARA_URLS = {
  boiler: 'https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc/Boiler-Operator-Engineer-Master.xlsx',
  electrical: 'https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc/Electrical-Licensee-List.xlsx',
  plumbing: 'https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc/Plumbing-Licensee-List.xlsx',
  hvac: 'https://www.michigan.gov/lara/-/media/Project/Websites/lara/bcc/Mechanical-Licensee-List.xlsx',
  nursing: 'https://www.michigan.gov/lara/-/media/Project/Websites/lara/bpl/Nursing-Licensee-List.xlsx',
};

// Florida DBPR public CSV exports (filtered to construction trades)
const FL_DBPR_URLS = {
  electrical: 'https://www2.myfloridalicense.com/sto/file_download/extracts/cilb_certified.csv',
  plumbing: 'https://www2.myfloridalicense.com/sto/file_download/extracts/cilb_registered.csv',
};

const COMPANY_TOKENS = ['LLC', 'INC', 'CORP', 'CO ', 'COMPANY', 'SERVICES', 'PLUMBING', 'ELECTRIC', 'MECHANICAL', 'CONTRACTORS'];

function looksLikeCompany(name) {
  if (!name) return true;
  const upper = name.toUpperCase();
  return COMPANY_TOKENS.some((t) => upper.includes(t));
}

function normalizeRow(row, licenseType, source, state) {
  // Field names vary per state — try several common variants
  const firstName = row['First Name'] || row['LICENSEE_FIRST_NAME'] || row['FirstName'] || row['licensee_first_name'] || '';
  const lastName = row['Last Name'] || row['LICENSEE_LAST_NAME'] || row['LastName'] || row['licensee_last_name'] || '';
  const fullName = (`${firstName} ${lastName}`).trim() || row['Licensee Name'] || row['Name'] || row['LICENSEE_NAME'] || '';
  const licenseNumber = row['License Number'] || row['LICENSE_NUMBER'] || row['LicenseNumber'] || row['license_number'] || '';
  const city = row['City'] || row['CITY'] || row['licensee_city'] || '';
  const issueDate = row['Issue Date'] || row['ISSUE_DATE'] || row['issue_date'] || row['Original Issue Date'] || '';
  const expiryDate = row['Expiration Date'] || row['EXPIRY_DATE'] || row['expiry_date'] || '';

  if (!fullName || looksLikeCompany(fullName)) return null;

  return {
    name: fullName,
    license_type: licenseType,
    license_number: String(licenseNumber).trim(),
    city: String(city).trim(),
    state: state.toUpperCase().slice(0, 2),
    license_issue_date: issueDate ? String(issueDate) : null,
    license_expiry_date: expiryDate ? String(expiryDate) : null,
    source,
    scraped_at: new Date().toISOString(),
  };
}

async function downloadAndParseXLSX(url, licenseType, source, state) {
  console.log(`[${source}/${licenseType}] downloading ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; M2-LARA-Scraper/1.0)',
      },
    });
    if (!res.ok) {
      console.error(`[${source}/${licenseType}] HTTP ${res.status}`);
      return [];
    }
    const buffer = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`[${source}/${licenseType}] parsed ${rows.length} rows`);

    const normalized = rows
      .map((r) => normalizeRow(r, licenseType, source, state))
      .filter((r) => r !== null);

    console.log(`[${source}/${licenseType}] ${normalized.length} valid candidates after dedupe`);
    return normalized;
  } catch (err) {
    console.error(`[${source}/${licenseType}] error:`, err.message);
    return [];
  }
}

async function downloadAndParseCSV(url, licenseType, source, state) {
  console.log(`[${source}/${licenseType}] downloading CSV ${url}`);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; M2-LARA-Scraper/1.0)' },
    });
    if (!res.ok) {
      console.error(`[${source}/${licenseType}] HTTP ${res.status}`);
      return [];
    }
    const text = await res.text();
    const workbook = XLSX.read(text, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`[${source}/${licenseType}] parsed ${rows.length} CSV rows`);

    const normalized = rows
      .map((r) => normalizeRow(r, licenseType, source, state))
      .filter((r) => r !== null);

    return normalized;
  } catch (err) {
    console.error(`[${source}/${licenseType}] CSV error:`, err.message);
    return [];
  }
}


const allCandidates = [];

// Default: excel mode — download LARA/DBPR Excel/CSV files
  if (states.includes('michigan')) {
    for (const lt of licenseTypes) {
      const url = MI_LARA_URLS[lt];
      if (!url) continue;
      const rows = await downloadAndParseXLSX(url, lt, 'lara_bpl', 'michigan');
      allCandidates.push(...rows);
    }
  }

  if (states.includes('florida')) {
    for (const lt of licenseTypes) {
      const url = FL_DBPR_URLS[lt];
      if (!url) continue;
      const rows = await downloadAndParseCSV(url, lt, 'fl_dbpr', 'florida');
      allCandidates.push(...rows);
    }
  }
}

console.log(`Total candidates to push: ${allCandidates.length}`);

if (allCandidates.length > 0) {
  // Push in batches of 500 to avoid memory/payload spikes
  for (let i = 0; i < allCandidates.length; i += 500) {
    await Actor.pushData(allCandidates.slice(i, i + 500));
  }
}

await Actor.exit();
