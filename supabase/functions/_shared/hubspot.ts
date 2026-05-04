// Shared HubSpot client — routes through Lovable connector gateway.
// Auto-refreshes OAuth tokens; no API key management needed.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

function headers() {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!HUBSPOT_API_KEY) throw new Error("HUBSPOT_API_KEY is not configured (HubSpot connector not linked)");
  return {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  };
}

async function hsFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  if (!res.ok) {
    throw new Error(`HubSpot ${init.method || "GET"} ${path} failed [${res.status}]: ${text.slice(0, 400)}`);
  }
  return data;
}

export interface ContactProps {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  website?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  [key: string]: any;
}

/** Upsert contact by email. Returns contact id. */
export async function upsertContact(props: ContactProps): Promise<string | null> {
  if (!props.email) return null;
  try {
    const search = await hsFetch(`/crm/v3/objects/contacts/search`, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: props.email }] }],
        limit: 1,
      }),
    });
    const existing = search?.results?.[0];
    if (existing) {
      await hsFetch(`/crm/v3/objects/contacts/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: props }),
      });
      return existing.id;
    }
    const created = await hsFetch(`/crm/v3/objects/contacts`, {
      method: "POST",
      body: JSON.stringify({ properties: props }),
    });
    return created?.id ?? null;
  } catch (err) {
    console.error("[hubspot.upsertContact]", err);
    return null;
  }
}

export interface CompanyProps {
  domain?: string;
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  industry?: string;
  numberofemployees?: number;
  [key: string]: any;
}

/** Upsert company by domain. Returns company id. */
export async function upsertCompany(props: CompanyProps): Promise<string | null> {
  if (!props.domain && !props.name) return null;
  try {
    if (props.domain) {
      const search = await hsFetch(`/crm/v3/objects/companies/search`, {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: props.domain }] }],
          limit: 1,
        }),
      });
      const existing = search?.results?.[0];
      if (existing) {
        await hsFetch(`/crm/v3/objects/companies/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ properties: props }),
        });
        return existing.id;
      }
    }
    const created = await hsFetch(`/crm/v3/objects/companies`, {
      method: "POST",
      body: JSON.stringify({ properties: props }),
    });
    return created?.id ?? null;
  } catch (err) {
    console.error("[hubspot.upsertCompany]", err);
    return null;
  }
}

export interface DealProps {
  dealname: string;
  amount?: number;
  dealstage?: string;
  pipeline?: string;
  closedate?: string; // ISO
  [key: string]: any;
}

export async function createDeal(
  props: DealProps,
  associations?: { contactId?: string; companyId?: string },
): Promise<string | null> {
  try {
    const body: any = {
      properties: { pipeline: "default", dealstage: "appointmentscheduled", ...props },
    };
    const assoc: any[] = [];
    if (associations?.contactId) {
      assoc.push({
        to: { id: associations.contactId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }],
      });
    }
    if (associations?.companyId) {
      assoc.push({
        to: { id: associations.companyId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }],
      });
    }
    if (assoc.length) body.associations = assoc;
    const created = await hsFetch(`/crm/v3/objects/deals`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return created?.id ?? null;
  } catch (err) {
    console.error("[hubspot.createDeal]", err);
    return null;
  }
}

/** Look up company by domain via Breeze Intelligence (replaces Clearbit Reveal). */
export async function lookupCompanyByDomain(domain: string): Promise<any | null> {
  if (!domain) return null;
  try {
    const data = await hsFetch(`/crm/v3/objects/companies/search`, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
        properties: ["name", "domain", "industry", "numberofemployees", "city", "state", "country", "phone", "website"],
        limit: 1,
      }),
    });
    return data?.results?.[0]?.properties ?? null;
  } catch (err) {
    console.error("[hubspot.lookupCompanyByDomain]", err);
    return null;
  }
}

/** Log an engagement (email/SMS/note) on a contact's timeline. */
export async function logEngagement(
  contactId: string,
  type: "EMAIL" | "SMS" | "NOTE" | "CALL",
  body: string,
  subject?: string,
): Promise<void> {
  try {
    const path = type === "NOTE" ? "/crm/v3/objects/notes" : `/crm/v3/objects/${type.toLowerCase()}s`;
    const propKey = type === "NOTE" ? "hs_note_body" : (type === "EMAIL" ? "hs_email_text" : "hs_call_body");
    const props: any = {
      [propKey]: body,
      hs_timestamp: Date.now(),
    };
    if (subject && type === "EMAIL") props.hs_email_subject = subject;
    await hsFetch(path, {
      method: "POST",
      body: JSON.stringify({
        properties: props,
        associations: [{
          to: { id: contactId },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: type === "EMAIL" ? 198 : (type === "NOTE" ? 202 : 194) }],
        }],
      }),
    });
  } catch (err) {
    console.error("[hubspot.logEngagement]", err);
  }
}
