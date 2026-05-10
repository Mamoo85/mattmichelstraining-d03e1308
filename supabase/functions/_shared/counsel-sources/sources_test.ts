// Deno unit tests for counsel-search source modules.
// Mocks globalThis.fetch with canned responses to verify each scanner's
// parser produces correctly-shaped IntelHit arrays and fails soft on errors.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as Federal from "./federal.ts";
import * as Reg from "./regulatory.ts";
import * as MI from "./michigan.ts";

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function withFetch(handler: FetchHandler, fn: () => Promise<void>) {
  const orig = globalThis.fetch;
  // deno-lint-ignore no-explicit-any
  globalThis.fetch = (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input.url;
    return Promise.resolve(handler(url, init));
  };
  return fn().finally(() => {
    globalThis.fetch = orig;
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html" } });

// ── FINRA BrokerCheck ────────────────────────────────────────────────
Deno.test("FINRA BrokerCheck parses individual hits + flags disclosures as high severity", async () => {
  await withFetch(
    () =>
      json({
        hits: {
          hits: [
            {
              _source: {
                ind_source_id: "1234567",
                ind_firstname: "John",
                ind_lastname: "Doe",
                ind_disclosure_count: 3,
                ind_current_employments: [{ firm_name: "ACME Securities" }],
              },
            },
            {
              _source: {
                ind_source_id: "9999999",
                ind_firstname: "Jane",
                ind_lastname: "Doe",
                ind_disclosure_count: 0,
              },
            },
          ],
        },
      }),
    async () => {
      const out = await Reg.scanFINRA("Doe");
      assertEquals(out.length, 2);
      assertEquals(out[0].source, "FINRA BrokerCheck");
      assertEquals(out[0].source_url, "https://brokercheck.finra.org/individual/summary/1234567");
      assertEquals(out[0].severity, "high");
      assertEquals(out[0].category, "Financial Records");
      assertEquals(out[1].severity, "info");
    },
  );
});

Deno.test("FINRA returns [] on non-200", async () => {
  await withFetch(() => new Response("err", { status: 500 }), async () => {
    assertEquals(await Reg.scanFINRA("X"), []);
  });
});

// ── NMLS Consumer Access ─────────────────────────────────────────────
Deno.test("NMLS extracts individual IDs from HTML and builds canonical URL", async () => {
  const body = `
    <a href="EntityDetails.aspx/INDIVIDUAL/1010101">Pat Michels</a>
    <a href="EntityDetails.aspx/INDIVIDUAL/2020202">Other Person</a>
  `;
  await withFetch(() => html(body), async () => {
    const out = await Reg.scanNMLS("Michels");
    assertEquals(out.length, 2);
    assertEquals(out[0].source, "NMLS Consumer Access");
    assertEquals(out[0].source_url, "https://www.nmlsconsumeraccess.org/EntityDetails.aspx/INDIVIDUAL/1010101");
    assertEquals(out[0].category, "Financial Records");
  });
});

Deno.test("NMLS returns [] when HTML has no matches", async () => {
  await withFetch(() => html("<html>nothing</html>"), async () => {
    assertEquals(await Reg.scanNMLS("Nobody"), []);
  });
});

// ── PACER ────────────────────────────────────────────────────────────
Deno.test("PACER returns [] when credentials are missing", async () => {
  const u = Deno.env.get("PACER_USERNAME");
  const p = Deno.env.get("PACER_PASSWORD");
  Deno.env.delete("PACER_USERNAME");
  Deno.env.delete("PACER_PASSWORD");
  try {
    assertEquals(await Federal.scanPACER("Anyone"), []);
  } finally {
    if (u) Deno.env.set("PACER_USERNAME", u);
    if (p) Deno.env.set("PACER_PASSWORD", p);
  }
});

Deno.test("PACER auths then parses party search results", async () => {
  Deno.env.set("PACER_USERNAME", "u");
  Deno.env.set("PACER_PASSWORD", "p");
  await withFetch(
    (url) => {
      if (url.includes("cso-auth")) return json({ nextGenCSO: "TKN" });
      if (url.includes("pcl-public-api")) {
        return json({
          content: [
            {
              caseTitle: "USA v. Smith",
              caseNumberFull: "1:24-cr-00123",
              courtId: "mied",
              caseType: "cr",
              dateFiled: "2024-05-01",
              partyRole: "defendant",
            },
          ],
        });
      }
      return new Response("no", { status: 404 });
    },
    async () => {
      const out = await Federal.scanPACER("John Smith");
      assertEquals(out.length, 1);
      assertEquals(out[0].source, "PACER Case Locator (federal cross-court)");
      assertEquals(out[0].severity, "high");
      assertEquals(out[0].date, "2024-05-01");
    },
  );
});

Deno.test("PACER returns [] when auth fails", async () => {
  Deno.env.set("PACER_USERNAME", "u");
  Deno.env.set("PACER_PASSWORD", "p");
  await withFetch(() => new Response("nope", { status: 401 }), async () => {
    assertEquals(await Federal.scanPACER("Anyone"), []);
  });
});

// ── CourtListener Opinions ──────────────────────────────────────────
Deno.test("CourtListener Opinions parses results and prefixes absolute_url", async () => {
  await withFetch(
    () =>
      json({
        results: [
          {
            caseName: "Doe v. Roe",
            absolute_url: "/opinion/123/doe-v-roe/",
            court: "mied",
            dateFiled: "2023-01-01",
            snippet: "test",
          },
        ],
      }),
    async () => {
      const out = await Federal.scanCLOpinions("Doe");
      assertEquals(out.length, 1);
      assertEquals(out[0].source, "CourtListener Opinions");
      assertEquals(out[0].source_url, "https://www.courtlistener.com/opinion/123/doe-v-roe/");
      assertEquals(out[0].category, "Court Records");
    },
  );
});

// ── Network failure resilience (every scanner must fail soft) ────────
Deno.test("All scanners fail soft on network error (return [])", async () => {
  await withFetch(
    () => {
      throw new Error("network down");
    },
    async () => {
      assertEquals(await Reg.scanFINRA("X"), []);
      assertEquals(await Reg.scanNMLS("X"), []);
      assertEquals(await Reg.scanSECLitigation("X"), []);
      assertEquals(await Reg.scanOFAC("X"), []);
      assertEquals(await Federal.scanCLOpinions("X"), []);
      assertEquals(await Federal.scanCLRecap("X"), []);
      assertEquals(await Federal.scanTaxCourt("X"), []);
      assertEquals(await MI.scanMDOC_OTIS("X"), []);
    },
  );
});
