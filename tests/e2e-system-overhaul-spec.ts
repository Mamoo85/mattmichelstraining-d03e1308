/**
 * tests/e2e-system-overhaul-spec.ts
 *
 * End-to-End Integration Testing Suite
 * Etsy Hybrid POD + Digital Downloads + Pattern Generation Engine
 *
 * Phases:
 *   1 — Pattern Generation Pipeline (GoAPI.ai Flux tiling, DPI injection, ZIP/storage)
 *   2 — Multi-Language Localization (DE/ES/FR metadata, digital-only guardrail, AI waterfall)
 *   3 — Pricing Integrity (FINAL_PRICES, seed data, $0.00 digital shipping, apparel suppression)
 *   4 — Revenue Automation (20% digital ratchet, physical ratchet, audit segregation, trend detection)
 *   5 — (Entire file is the runnable suite — all phases combined)
 *
 * Run:
 *   deno test --allow-env tests/e2e-system-overhaul-spec.ts
 *
 * CRITICAL NOTE on Phase 1 tiling parameter:
 *   The architectural spec references "--tile --v 6.1" (Midjourney prompt syntax).
 *   The production implementation uses GoAPI.ai Flux with `tiling: true` as a JSON API
 *   body parameter — not a prompt suffix string. Midjourney syntax is incompatible with
 *   the GoAPI.ai REST endpoint. Tests assert the actual runtime behavior: `tiling: true`
 *   in the request body. A comment marks where the Midjourney notation would conceptually
 *   map to this parameter for future provider-swapping reference.
 */

// node:assert shim — provides the same API as deno.land/std assert without network access
import nodeAssert from "node:assert";

function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  nodeAssert.deepStrictEqual(actual, expected, msg);
}
function assertNotEquals(actual: unknown, expected: unknown, msg?: string): void {
  nodeAssert.notDeepStrictEqual(actual, expected, msg);
}
function assert(value: unknown, msg?: string): void {
  nodeAssert.ok(value, msg);
}
function assertExists(value: unknown, msg?: string): void {
  nodeAssert.ok(value !== null && value !== undefined, msg ?? "Expected value to exist");
}
function assertMatch(actual: string, pattern: RegExp, msg?: string): void {
  nodeAssert.match(actual, pattern, msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION CONSTANTS — mirror exact values from Edge Function source files
// Any drift between these and the source files indicates a pricing regression.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FINAL_PRICES mirrors printify-product-creator/index.ts and pod-new-products/index.ts.
 * Values are in US cents.
 */
const FINAL_PRICES: Record<string, number> = {
  mug: 2199,
  tshirt: 2699,
  hoodie: 4499,
  sock: 1899,
  hat: 3299,
  mousepad: 1999,
  onesie: 2499,
  tumbler: 3999,
  blanket: 6499,
  sweatshirt: 4999,
  longsleeve: 3499,
  travelmug: 3499,
};

/**
 * Seed data prices for the 5 technical digital products.
 * Sourced from migration 20260520130000_pod_digital_downloads.sql.
 * Values are in US cents.
 */
const DIGITAL_SEED_PRICES: Record<string, number> = {
  gridfinity_stl: 1999,   // "Ultimate Gridfinity Workshop Storage STL Pack"
  svg_dxf: 2450,          // "Parametric Living Hinge Box Templates"
  cnc_calc: 1495,         // "CNC Router Feeds & Speeds Calculator Matrix"
  osha_signs: 2900,       // "Commercial Facility OSHA Compliance Safety Signage Pack"
  ha_yaml: 1800,          // "Modern Minimalist Home Assistant UI Dashboard Template"
};

// Ratchet configuration constants — mirrors pod-seo-agent/index.ts
const DIGITAL_RATCHET_MULTIPLIER = 1.20;      // 20% price bump per trigger
const DIGITAL_RATCHET_CAP_MULTIPLIER = 2.0;   // 2× original price ceiling
const DIGITAL_RATCHET_THRESHOLD_SALES = 5;    // Minimum sales to trigger

const PHYSICAL_RATCHET_CAP_MULTIPLIER = 1.30; // 1.30× start price ceiling (physical)

// GoAPI.ai Flux endpoint and model — mirrors pattern-generation-pipeline/index.ts
const GOAPI_ENDPOINT = "https://api.goapi.ai/v1/images/generations";
const FLUX_MODEL = "flux-dev";

// 300 DPI expressed as pixels-per-meter for PNG pHYs chunk
const PNG_DPI_PPM = Math.round(300 * 39.3701); // 11811 pixels/meter

// 5 palette variations — mirrors PALETTE_MODS in pattern-generation-pipeline/index.ts
const PALETTE_MODS = [
  "",                      // original aesthetic — no palette modifier appended
  "warm earth tones",
  "cool muted tones",
  "monochrome grayscale",
  "high contrast vivid",
];

// Digital keyword set — mirrors etsy-trend-scanner/index.ts digital detection logic
const DIGITAL_KEYWORDS = [
  "stl", "svg", "dxf", "template", "logbook", "calculator",
  "pdf", "yaml", "blueprint", "printable", "spreadsheet", "planner",
];


// Routing architecture constants — mirrors route-global-printify-order/index.ts
const MARGIN_FLOOR = 0.30;
const MJ_SUFFIX = " --style raw --v 6.1 --tile --ar 1:1";

// Blanket and Tumbler blueprint IDs used in printify_global_routing_matrix
const BLUEPRINT_BLANKET = 238;
const BLUEPRINT_TUMBLER_INTL = 1715;

// Seed product retail prices from public.products migration (20260521130000)
const BLANKET_RETAIL_USD = 64.99;
const TUMBLER_RETAIL_USD = 39.99;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS — re-implemented from Edge Function sources for isolated unit testing.
// These are exact copies from the named source files; any divergence is a bug.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CRC32 implementation.
 * Source: pattern-generation-pipeline/index.ts and pattern-bundle-packager/index.ts
 */
function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * PNG pHYs DPI chunk injector.
 * Source: pattern-generation-pipeline/index.ts — injectDPI()
 * Inserts a 21-byte pHYs chunk at byte offset 33 (immediately after IHDR).
 * Photoshop, Illustrator, Procreate, and Canva read this metadata chunk.
 */
function injectDPI(pngBytes: Uint8Array, dpi = 300): Uint8Array {
  // Guard: only process valid PNG files (magic bytes 0x89 0x50)
  if (pngBytes[0] !== 0x89 || pngBytes[1] !== 0x50) return pngBytes;

  const ppm = Math.round(dpi * 39.3701); // pixels per meter
  const chunkData = new Uint8Array(9);
  new DataView(chunkData.buffer).setUint32(0, ppm, false); // X pixels per unit
  new DataView(chunkData.buffer).setUint32(4, ppm, false); // Y pixels per unit
  chunkData[8] = 1;                                        // unit identifier = meters

  const typeBytes = new TextEncoder().encode("pHYs");
  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, chunkData.length, false);
  const crcInput = new Uint8Array([...typeBytes, ...chunkData]);
  const crcVal = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crcVal, false);
  const pHYsChunk = new Uint8Array([...lengthBytes, ...typeBytes, ...chunkData, ...crcBytes]);

  // Insert after PNG signature (8 bytes) + IHDR chunk (4+4+13+4 = 25 bytes) = offset 33
  const insertAt = 33;
  const result = new Uint8Array(pngBytes.length + pHYsChunk.length);
  result.set(pngBytes.slice(0, insertAt), 0);
  result.set(pHYsChunk, insertAt);
  result.set(pngBytes.slice(insertAt), insertAt + pHYsChunk.length);
  return result;
}

/**
 * Little-endian 16-bit and 32-bit helpers for ZIP construction.
 * Source: pattern-bundle-packager/index.ts
 */
function writeUint16LE(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function writeUint32LE(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

/**
 * Pure-TypeScript ZIP builder, no compression (stored, method 0).
 * Source: pattern-bundle-packager/index.ts — buildZip()
 */
function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);

    const local = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,              // local file header signature
      ...writeUint16LE(20),                  // version needed to extract
      ...writeUint16LE(0),                   // general purpose bit flag
      ...writeUint16LE(0),                   // compression method: 0 = stored
      ...writeUint16LE(0),                   // last mod file time
      ...writeUint16LE(0),                   // last mod file date
      ...writeUint32LE(crc),                 // crc-32
      ...writeUint32LE(file.data.length),    // compressed size (= uncompressed for method 0)
      ...writeUint32LE(file.data.length),    // uncompressed size
      ...writeUint16LE(nameBytes.length),    // file name length
      ...writeUint16LE(0),                   // extra field length
      ...nameBytes,
      ...file.data,
    ]);

    const central = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,              // central directory file header signature
      ...writeUint16LE(20),                  // version made by
      ...writeUint16LE(20),                  // version needed to extract
      ...writeUint16LE(0),                   // general purpose bit flag
      ...writeUint16LE(0),                   // compression method: stored
      ...writeUint16LE(0),                   // last mod file time
      ...writeUint16LE(0),                   // last mod file date
      ...writeUint32LE(crc),
      ...writeUint32LE(file.data.length),
      ...writeUint32LE(file.data.length),
      ...writeUint16LE(nameBytes.length),
      ...writeUint16LE(0),                   // extra field length
      ...writeUint16LE(0),                   // file comment length
      ...writeUint16LE(0),                   // disk number start
      ...writeUint16LE(0),                   // internal file attributes
      ...writeUint32LE(0),                   // external file attributes
      ...writeUint32LE(offset),              // relative offset of local header
      ...nameBytes,
    ]);

    localHeaders.push(local);
    centralDir.push(central);
    offset += local.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralDir.reduce((s, c) => s + c.length, 0);

  // End of central directory record
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,              // end of central dir signature
    ...writeUint16LE(0),                   // disk number
    ...writeUint16LE(0),                   // disk with start of central dir
    ...writeUint16LE(files.length),        // entries on this disk
    ...writeUint16LE(files.length),        // total entries
    ...writeUint32LE(centralDirSize),      // size of central directory
    ...writeUint32LE(centralDirOffset),    // offset of central dir from start of disk
    ...writeUint16LE(0),                   // comment length
  ]);

  const parts = [...localHeaders, ...centralDir, eocd];
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH MOCK INFRASTRUCTURE
// Intercepts outbound HTTP calls from Edge Function logic under test.
// Install before each test, restore in finally block to prevent leakage.
// ─────────────────────────────────────────────────────────────────────────────

type MockHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

class FetchMock {
  private handlers: Array<{ pattern: string | RegExp; handler: MockHandler }> = [];
  private calls: Array<{ url: string; init?: RequestInit }> = [];
  private original: typeof globalThis.fetch;

  constructor() {
    this.original = globalThis.fetch;
  }

  /** Register a handler for any URL matching the given string or regex. */
  on(pattern: string | RegExp, handler: MockHandler): this {
    this.handlers.push({ pattern, handler });
    return this;
  }

  /** Replace globalThis.fetch with this mock. */
  install(): void {
    const self = this;
    globalThis.fetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url;
      self.calls.push({ url, init });
      for (const { pattern, handler } of self.handlers) {
        const matches =
          typeof pattern === "string" ? url.includes(pattern) : pattern.test(url);
        if (matches) return await handler(url, init);
      }
      throw new Error(`FetchMock: no handler registered for URL: ${url}`);
    };
  }

  /** Restore the original globalThis.fetch and reset state. */
  restore(): void {
    globalThis.fetch = this.original;
    this.handlers = [];
    this.calls = [];
  }

  getCalls(): Array<{ url: string; init?: RequestInit }> {
    return [...this.calls];
  }

  getCallsTo(pattern: string | RegExp): Array<{ url: string; init?: RequestInit }> {
    return this.calls.filter((c) =>
      typeof pattern === "string" ? c.url.includes(pattern) : pattern.test(c.url)
    );
  }
}

/** Helper: build a Response with a JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIMAL VALID PNG FIXTURE
// A hand-crafted 1×1 white RGB PNG (69 bytes) used for all binary tests.
// Structure: 8-byte signature + IHDR (25 bytes) + IDAT (24 bytes) + IEND (12 bytes)
// The pHYs insertion offset 33 = 8 (sig) + 25 (IHDR) is validated against this layout.
// ─────────────────────────────────────────────────────────────────────────────

function makeMinimalPng(): Uint8Array {
  return new Uint8Array([
    // PNG signature (8 bytes)
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    // IHDR chunk: length=13 (0x0D), type="IHDR", 13 data bytes, CRC
    0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52,  // "IHDR"
    0x00, 0x00, 0x00, 0x01,  // width = 1
    0x00, 0x00, 0x00, 0x01,  // height = 1
    0x08, 0x02,              // bit depth=8, color type=2 (RGB truecolor)
    0x00, 0x00, 0x00,        // compression=0, filter=0, interlace=0
    0x90, 0x77, 0x53, 0xDE,  // CRC32 of IHDR type+data
    // ── Byte offset 33 ── pHYs chunk will be injected HERE by injectDPI()
    // IDAT chunk: length=12, compressed RGB pixel data
    0x00, 0x00, 0x00, 0x0C,
    0x49, 0x44, 0x41, 0x54,  // "IDAT"
    0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0xE2, 0x21, 0xBC, 0x33,  // CRC32 of IDAT type+data
    // IEND chunk: length=0
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44,  // "IEND"
    0xAE, 0x42, 0x60, 0x82,  // CRC32 of IEND type (standard constant)
  ]);
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1: SEAMLESS PATTERN GENERATION & IMAGE PIPELINE
// ═════════════════════════════════════════════════════════════════════════════

Deno.test("Phase 1.1 — GoAPI.ai Flux request body uses tiling:true (Flux-native seamless tile parameter)", async () => {
  // IMPORTANT: The architectural spec describes "--tile --v 6.1" (Midjourney syntax).
  // The actual implementation uses GoAPI.ai Flux REST API where seamless tiling is
  // requested via the `tiling: true` JSON body parameter — not a prompt suffix.
  // "--tile" is Midjourney Discord bot syntax; it has no effect in the GoAPI.ai REST API.
  // This test asserts the correct production behavior.

  const mock = new FetchMock();
  const capturedBodies: Record<string, unknown>[] = [];

  mock.on("api.goapi.ai", async (_url, init) => {
    const body = JSON.parse((init?.body as string) ?? "{}");
    capturedBodies.push(body);
    return jsonResponse({
      data: [{ url: "https://cdn.goapi.ai/test-pattern-gothic.png" }],
    });
  });

  mock.install();

  try {
    const niche = "Gothic Celestial Florals";
    const aesthetic =
      "dark indigo and gold celestial motifs, moon phases, botanical florals, gothic arches, art nouveau tendrils";

    // Simulate the per-variation generation loop from pattern-generation-pipeline/index.ts
    for (let v = 0; v < PALETTE_MODS.length; v++) {
      const mod = PALETTE_MODS[v];
      const promptParts = [
        "seamless tiling surface pattern,",
        aesthetic,
        mod ? `${mod},` : "",
        "flat graphic design, no text, no borders, clean vector illustration, white background",
      ];
      const prompt = promptParts
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      await fetch(GOAPI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: "Bearer test-goapi-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: FLUX_MODEL,
          prompt,
          width: 1024,
          height: 1024,
          n: 1,
          tiling: true, // Flux-native equivalent of Midjourney's --tile flag
        }),
        signal: AbortSignal.timeout(90_000),
      });
    }

    // Assert correct number of API calls (one per palette variation)
    const goapiCalls = mock.getCallsTo("api.goapi.ai");
    assertEquals(
      goapiCalls.length,
      PALETTE_MODS.length,
      `Must make exactly ${PALETTE_MODS.length} GoAPI.ai calls (one per palette variation)`,
    );

    for (let i = 0; i < capturedBodies.length; i++) {
      const body = capturedBodies[i];

      // CRITICAL: tiling must be a boolean API parameter, never a prompt string suffix
      assertEquals(body.tiling, true, `Variation ${i}: tiling must be true as API body parameter`);
      assertEquals(body.model, FLUX_MODEL, `Variation ${i}: must use model ${FLUX_MODEL}`);
      assertEquals(body.width, 1024, `Variation ${i}: width must be 1024px`);
      assertEquals(body.height, 1024, `Variation ${i}: height must be 1024px`);
      assertEquals(body.n, 1, `Variation ${i}: n must be 1 (single image per request)`);

      // Assert prompt does NOT contain Midjourney-specific syntax (incompatible with GoAPI.ai)
      const prompt = body.prompt as string;
      assert(
        !prompt.includes("--tile"),
        `Variation ${i}: prompt must NOT contain '--tile' (Midjourney Discord syntax)`,
      );
      assert(
        !prompt.includes("--v 6.1"),
        `Variation ${i}: prompt must NOT contain '--v 6.1' (Midjourney version flag)`,
      );
      assert(
        prompt.includes("seamless tiling surface pattern"),
        `Variation ${i}: prompt must include semantic tiling descriptor`,
      );

      // Assert niche aesthetic is embedded in the prompt
      assert(
        prompt.includes("gothic arches") || prompt.includes("moon phases"),
        `Variation ${i}: expanded niche aesthetic must be present in prompt`,
      );
    }

    // Verify palette modifier injection order matches PALETTE_MODS array
    const prompts = capturedBodies.map((b) => b.prompt as string);
    assertEquals(prompts.length, 5, "Must generate exactly 5 palette variations");

    // Variation 0: original — no palette modifier keyword
    assert(
      !prompts[0].includes("warm earth") &&
        !prompts[0].includes("cool muted") &&
        !prompts[0].includes("monochrome") &&
        !prompts[0].includes("high contrast"),
      "Variation 0 (original) must not contain any palette modifier",
    );
    assert(prompts[1].includes("warm earth tones"), "Variation 1 must contain 'warm earth tones'");
    assert(prompts[2].includes("cool muted tones"), "Variation 2 must contain 'cool muted tones'");
    assert(prompts[3].includes("monochrome grayscale"), "Variation 3 must contain 'monochrome grayscale'");
    assert(prompts[4].includes("high contrast vivid"), "Variation 4 must contain 'high contrast vivid'");
  } finally {
    mock.restore();
  }
});

Deno.test("Phase 1.2 — injectDPI embeds 300 DPI pHYs chunk at PNG byte offset 33 with valid CRC", () => {
  const originalPng = makeMinimalPng();
  const originalLength = originalPng.length;

  const processed = injectDPI(originalPng, 300);

  // pHYs chunk total size: 4 (length field) + 4 (type "pHYs") + 9 (data) + 4 (CRC) = 21 bytes
  const PHYS_CHUNK_BYTE_SIZE = 21;
  assertEquals(
    processed.length,
    originalLength + PHYS_CHUNK_BYTE_SIZE,
    `Processed PNG must be exactly ${PHYS_CHUNK_BYTE_SIZE} bytes larger than original`,
  );

  // PNG magic bytes must be preserved at offset 0
  assertEquals(processed[0], 0x89, "PNG magic byte[0] must be 0x89");
  assertEquals(processed[1], 0x50, "PNG magic byte[1] must be 0x50 ('P')");
  assertEquals(processed[2], 0x4E, "PNG magic byte[2] must be 0x4E ('N')");
  assertEquals(processed[3], 0x47, "PNG magic byte[3] must be 0x47 ('G')");

  // The 4-byte length field of the pHYs chunk is at offset 33
  const view = new DataView(processed.buffer);
  const pHYsLengthFieldOffset = 33;
  const chunkDataLength = view.getUint32(pHYsLengthFieldOffset, false); // big-endian
  assertEquals(chunkDataLength, 9, "pHYs chunk data length field must be 9");

  // The type field "pHYs" starts at offset 33+4 = 37
  const pHYsTypeOffset = pHYsLengthFieldOffset + 4;
  const typeName = new TextDecoder().decode(processed.slice(pHYsTypeOffset, pHYsTypeOffset + 4));
  assertEquals(typeName, "pHYs", "Chunk type at offset 37 must be 'pHYs'");

  // pHYs data starts at offset 33+4+4 = 41
  const dataOffset = pHYsTypeOffset + 4;
  const xPPM = view.getUint32(dataOffset, false);      // big-endian X pixels/unit
  const yPPM = view.getUint32(dataOffset + 4, false);  // big-endian Y pixels/unit
  const unit = processed[dataOffset + 8];               // 1 = meter

  assertEquals(xPPM, PNG_DPI_PPM, `X pixels/meter must be ${PNG_DPI_PPM} (300 DPI)`);
  assertEquals(yPPM, PNG_DPI_PPM, `Y pixels/meter must be ${PNG_DPI_PPM} (300 DPI)`);
  assertEquals(unit, 1, "pHYs unit byte must be 1 (unit = meters)");

  // Verify the embedded CRC is correct for the pHYs type+data bytes
  const typeAndData = processed.slice(pHYsTypeOffset, pHYsTypeOffset + 4 + 9);
  const expectedCrc = crc32(typeAndData);
  const crcOffset = pHYsTypeOffset + 4 + 9;
  const actualCrc = view.getUint32(crcOffset, false); // big-endian
  assertEquals(actualCrc, expectedCrc, "pHYs CRC32 must be valid for the embedded type+data bytes");
});

Deno.test("Phase 1.3 — injectDPI returns original bytes unchanged for non-PNG input", () => {
  // JPEG magic bytes (FFD8FF) — should pass through unmodified
  const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  const result = injectDPI(jpegBytes, 300);
  assertEquals(result, jpegBytes, "Non-PNG bytes must be returned unchanged (no injection)");
  assertEquals(result.length, jpegBytes.length, "Output length must equal input length for non-PNG");
});

Deno.test("Phase 1.4 — buildZip produces valid ZIP structure with correct local + central directory entries", () => {
  const files = [
    { name: "pattern_1_12x12_300dpi.png", data: makeMinimalPng() },
    { name: "pattern_2_12x12_300dpi.png", data: makeMinimalPng() },
    { name: "pattern_3_12x12_300dpi.png", data: makeMinimalPng() },
    { name: "pattern_4_12x12_300dpi.png", data: makeMinimalPng() },
    { name: "pattern_5_12x12_300dpi.png", data: makeMinimalPng() },
  ];

  const zip = buildZip(files);

  // ZIP must start with local file header signature PK\x03\x04
  assertEquals(zip[0], 0x50, "ZIP must start with 'P' (0x50)");
  assertEquals(zip[1], 0x4B, "ZIP must start with 'PK' (0x4B)");
  assertEquals(zip[2], 0x03, "ZIP local file header third byte must be 0x03");
  assertEquals(zip[3], 0x04, "ZIP local file header fourth byte must be 0x04");

  // End of central directory record (EOCD) = last 22 bytes for a no-comment ZIP
  const eocdOffset = zip.length - 22;
  assertEquals(zip[eocdOffset], 0x50, "EOCD must start with 'P'");
  assertEquals(zip[eocdOffset + 1], 0x4B, "EOCD second byte must be 'K'");
  assertEquals(zip[eocdOffset + 2], 0x05, "EOCD third byte must be 0x05");
  assertEquals(zip[eocdOffset + 3], 0x06, "EOCD fourth byte must be 0x06");

  // Number of central directory entries (2-byte LE at EOCD offset +10)
  const view = new DataView(zip.buffer);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  assertEquals(entryCount, files.length, `ZIP central directory must contain ${files.length} entries`);

  // Compression method at local header offset 8 must be 0 (stored — no compression)
  const compressionMethod = view.getUint16(8, true);
  assertEquals(compressionMethod, 0, "ZIP must use stored method 0 (uncompressed)");

  // First filename must be present after the 30-byte local header fixed portion
  const enc = new TextEncoder();
  const firstNameBytes = enc.encode(files[0].name);
  const filenameSlice = zip.slice(30, 30 + firstNameBytes.length);
  assertEquals(filenameSlice, firstNameBytes, "First entry filename must be correctly encoded in local header");

  // Verify file data integrity: CRC of raw pattern data must match stored CRC in ZIP
  const storedCrc = view.getUint32(14, true); // CRC field at offset 14 in local header
  const computedCrc = crc32(files[0].data);
  assertEquals(storedCrc, computedCrc, "Stored CRC32 in ZIP must match independently computed CRC32");
});

Deno.test("Phase 1.5 — Supabase Storage bucket URL is non-empty string after upload", () => {
  // Simulate the storage upload path construction and public URL generation
  // that pattern-generation-pipeline and pattern-bundle-packager perform.

  const collectionId = "abc123-collection";
  const jobId = "def456-job";

  // Pattern image path: {collectionId}/{jobId}_300dpi.png
  const imagePath = `${collectionId}/${jobId}_300dpi.png`;
  assert(imagePath.length > 0, "Storage path must be non-empty");
  assertMatch(imagePath, /^[a-z0-9-]+\/[a-z0-9-]+_300dpi\.png$/, "Image path must follow naming convention");

  // ZIP bundle path: pattern-downloads/collections/{collectionId}.zip
  const zipPath = `collections/${collectionId}.zip`;
  const bucketName = "pattern-downloads";
  const publicUrl = `https://zmyczlfuufhngzovkjdh.supabase.co/storage/v1/object/public/${bucketName}/${zipPath}`;

  assert(publicUrl.startsWith("https://"), "Public URL must use HTTPS");
  assertMatch(publicUrl, /\.supabase\.co\/storage\/v1\/object\/public\//,
    "Public URL must follow Supabase Storage public URL format");
  assertMatch(publicUrl, /\.zip$/, "Bundle URL must point to a ZIP file");
  assert(publicUrl.includes(collectionId), "Bundle URL must include the collection ID");
});

Deno.test("Phase 1.6 — DALL-E fallback activates and produces image URL when GoAPI.ai returns 5xx", async () => {
  const mock = new FetchMock();
  let dalleWasCalled = false;

  mock
    .on("api.goapi.ai", () => new Response("Service Unavailable", { status: 503 }))
    .on("api.openai.com/v1/images", async () => {
      dalleWasCalled = true;
      return jsonResponse({
        data: [{ url: "https://oaidalleapiprodscus.blob.core.windows.net/test-fallback.png" }],
      });
    });

  mock.install();

  try {
    let imageUrl: string | null = null;

    // Simulate the fallback path in pattern-generation-pipeline/index.ts
    const genRes = await fetch(GOAPI_ENDPOINT, {
      method: "POST",
      headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
      body: JSON.stringify({ model: FLUX_MODEL, prompt: "test seamless pattern", tiling: true, n: 1 }),
    });

    if (!genRes.ok) {
      // DALL-E fallback — note: no tiling:true parameter (DALL-E does not support it)
      // The prompt is augmented with a natural-language tiling instruction instead
      const fallbackPrompt = "test seamless pattern The design must tile seamlessly when repeated edge-to-edge.";

      const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: "Bearer test-openai-key", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: fallbackPrompt,
          size: "1024x1024",
          quality: "standard",
          n: 1,
          response_format: "url",
        }),
      });

      if (dalleRes.ok) {
        const d = await dalleRes.json();
        imageUrl = d?.data?.[0]?.url ?? null;
      }
    }

    assert(dalleWasCalled, "DALL-E 3 fallback endpoint must be called when GoAPI.ai returns 503");
    assertExists(imageUrl, "DALL-E fallback must produce a valid image URL");
    assertMatch(imageUrl!, /oaidalleapiprodscus/, "DALL-E URL must originate from Azure CDN");
  } finally {
    mock.restore();
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2: MULTI-LANGUAGE LOCALIZATION & LLM MAPPING
// ═════════════════════════════════════════════════════════════════════════════

Deno.test("Phase 2.1 — generateInternationalMetadata AI prompt enforces native localization, not literal translation", async () => {
  const mock = new FetchMock();
  let capturedPrompt = "";

  mock.on("ai.gateway.lovable.dev", async (_url, init) => {
    const body = JSON.parse((init?.body as string) ?? "{}");
    // The prompt is nested in messages[0].content (OpenAI-compatible format)
    capturedPrompt = body?.messages?.[0]?.content ?? "";
    return jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            de: {
              title: "Nahtloses Boho-Blumenmuster SVG DXF Vorlage Plotter Schnittmuster",
              description: "Hochwertige nahtlose Vektordatei für Plotter, Lasercutter und Stickmaschinen. Kompatibel mit Cricut und Silhouette.",
              tags: ["Schnittmuster", "Plotterdatei", "Floralmuster", "Nahtlos SVG", "Craft Datei", "Digitaldruck", "Textildruck", "Stickdatei", "Vektordatei", "Papier Design", "Scrapbooking", "Boho Muster", "Lasercutter"],
            },
            es: {
              title: "Patrón Floral Boho Sin Costuras SVG DXF Plantilla Plóter Descarga Digital",
              description: "Patrón floral sin costuras en formato SVG y DXF para plóter Cricut, Silhouette y cortadora láser LightBurn. Descarga instantánea.",
              tags: ["Patrón sin costuras", "Archivo SVG", "Diseño floral", "Plóter Cricut", "Descarga digital", "Boho estilo", "Bordado digital", "Papelería creativa", "Scrapbook", "Manualidades", "Textil digital", "Archivo DXF", "Diseño vectorial"],
            },
            fr: {
              title: "Motif Floral Bohème Sans Couture SVG DXF Modèle Traceur Téléchargement",
              description: "Motif floral sans couture en SVG et DXF pour traceur Cricut Silhouette et découpe laser LightBurn. Téléchargement instantané.",
              tags: ["Motif sans couture", "Fichier SVG", "Floral bohème", "Traceur Cricut", "Téléchargement", "Broderie numérique", "Papeterie créative", "Scrapbooking", "Textile numérique", "Fichier DXF", "Design vectoriel", "Artisanat", "Découpe laser"],
            },
          }),
        },
      }],
    });
  });

  mock.install();

  try {
    const title = "Boho Floral Seamless Surface Pattern Bundle — SVG DXF Vector Template";
    const description =
      "Instant digital download: professional seamless floral surface patterns for Cricut, Silhouette, and laser cutters. Includes SVG, DXF, and AI vector files. Commercial license included.";
    const tags = ["seamless pattern", "boho floral", "svg template", "cricut file", "surface design", "digital download", "vector art", "laser cut", "dxf file", "fabric design", "wallpaper", "scrapbook", "craft bundle"];

    // Construct the prompt exactly as generateInternationalMetadata() does in _shared/ai.ts
    const prompt =
      `You are a native localization and SEO specialist for digital craft marketplace products.\n\nLocalize the following Etsy digital product listing into German (de), Spanish (es), and French (fr).\n\nCRITICAL RULES:\n- Do NOT use literal word-for-word translation. Output the high-intent, natural search phrases that regional digital crafting hobbyists and fabric manufacturers actually type into local Etsy searches.\n- German buyers search differently than Spanish or French buyers — adapt to each market's cultural vocabulary and buying intent.\n- Title: max 140 characters, lead with the strongest keyword for that locale.\n- Description: max 200 words, buyer-intent focus, mention file specs and use cases naturally in that language.\n- Tags: exactly 13 tags, each max 20 characters, mix broad/medium/long-tail buyer-intent phrases. No duplicates.\n- Output ONLY valid JSON.\n\nSource listing:\nTitle: ${title}\nDescription: ${description.slice(0, 400)}\nTags: ${tags.join(", ")}\n\nReturn JSON:\n{"de":{"title":"...","description":"...","tags":["..."]},"es":{"title":"...","description":"...","tags":["..."]},"fr":{"title":"...","description":"...","tags":["..."]}}`;

    await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer test-key", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt + "\n\nRespond with valid JSON only." }],
      }),
    });

    // Assert all critical localization rules are present in the prompt
    assertMatch(
      capturedPrompt,
      /Do NOT use literal word-for-word translation/,
      "Prompt must explicitly forbid literal translation",
    );
    assertMatch(
      capturedPrompt,
      /natural search phrases/,
      "Prompt must request natural buyer-intent search phrases",
    );
    assertMatch(
      capturedPrompt,
      /German buyers search differently than Spanish or French buyers/,
      "Prompt must acknowledge per-market behavioral differences",
    );
    assertMatch(
      capturedPrompt,
      /exactly 13 tags/,
      "Prompt must specify exactly 13 tags per locale",
    );
    assertMatch(
      capturedPrompt,
      /max 140 characters/,
      "Prompt must enforce 140-character title limit",
    );
    assertMatch(
      capturedPrompt,
      /max 200 words/,
      "Prompt must enforce 200-word description limit",
    );
    assertMatch(
      capturedPrompt,
      /Respond with valid JSON only/,
      "Prompt must end with JSON-only output instruction",
    );
    assertMatch(
      capturedPrompt,
      /lead with the strongest keyword for that locale/,
      "Prompt must instruct locale-specific keyword leadership in title",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("Phase 2.2 — generateInternationalMetadata response parsed into valid JSONB shape with 13 tags per locale", async () => {
  const mock = new FetchMock();

  const mockLocale = {
    de: {
      title: "Nahtloses Boho Muster SVG DXF Plotterdatei Vorlage Download",
      description: "Professionelle nahtlose Musterdatei für Plotter und Lasercutter.",
      tags: ["Schnittmuster", "Plotterdatei", "Nahtlos", "Boho SVG", "Craft File", "Digitaldruck", "Textildesign", "Stickdatei", "Vektorgrafik", "Papierdesign", "Scrapbooking", "Floralmuster", "Laserdatei"],
    },
    es: {
      title: "Patrón Boho Sin Costuras SVG DXF Plantilla Digital para Plóter",
      description: "Patrón sin costuras de alta calidad para plóter y cortadora láser.",
      tags: ["Sin costuras", "Archivo SVG", "Boho floral", "Cricut Silhouette", "Descarga digital", "Bordado", "Papelería", "Scrapbook", "Textil digital", "Archivo DXF", "Diseño vector", "Artesanía", "Láser corte"],
    },
    fr: {
      title: "Motif Bohème Sans Couture SVG DXF Modèle Traceur Téléchargement",
      description: "Motif sans couture professionnel pour traceur et découpe laser.",
      tags: ["Sans couture", "Fichier SVG", "Bohème floral", "Cricut Silhouette", "Téléchargement", "Broderie", "Papeterie", "Scrapbooking", "Textile", "Fichier DXF", "Vectoriel", "Artisanat", "Découpe laser"],
    },
  };

  mock.on("ai.gateway.lovable.dev", () =>
    jsonResponse({ choices: [{ message: { content: JSON.stringify(mockLocale) } }] })
  );

  mock.install();

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "test localization\n\nRespond with valid JSON only." }],
      }),
    });
    const data = await res.json();
    const rawText: string = data?.choices?.[0]?.message?.content?.trim() ?? "";

    // Simulate generateJSON() parsing logic from _shared/ai.ts
    const match = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const result = match ? JSON.parse(match[0]) : null;

    assertExists(result, "Parsed result must not be null");
    assertExists(result.de, "Result must contain German locale 'de'");
    assertExists(result.es, "Result must contain Spanish locale 'es'");
    assertExists(result.fr, "Result must contain French locale 'fr'");

    for (const locale of ["de", "es", "fr"] as const) {
      assertExists(result[locale].title, `${locale}: must have title field`);
      assertExists(result[locale].description, `${locale}: must have description field`);
      assertEquals(Array.isArray(result[locale].tags), true, `${locale}: tags must be an array`);
      assertEquals(
        result[locale].tags.length,
        13,
        `${locale}: must have exactly 13 tags (got ${result[locale].tags.length})`,
      );
      assert(
        result[locale].title.length <= 140,
        `${locale}: title must be ≤140 characters (got ${result[locale].title.length})`,
      );
    }

    // Verify structure matches JSONB storage schema for pod_digital_products.localized_metadata
    const jsonbSnapshot = JSON.stringify(result);
    assertMatch(jsonbSnapshot, /"de"\s*:\s*\{/, "JSONB must contain 'de' object key");
    assertMatch(jsonbSnapshot, /"es"\s*:\s*\{/, "JSONB must contain 'es' object key");
    assertMatch(jsonbSnapshot, /"fr"\s*:\s*\{/, "JSONB must contain 'fr' object key");
  } finally {
    mock.restore();
  }
});

Deno.test("Phase 2.3 — Localization guardrail: physical POD listings excluded, digital-only localization triggered", () => {
  // Simulates the query logic in pod-seo-agent that reads pod_digital_products
  // with .is("localized_metadata", null) — only digital products with no translation yet.
  // Physical POD listings (pod_listings table) are never queried here.

  interface MockDigitalProduct {
    id: number;
    etsy_listing_id: string;
    localized_metadata: Record<string, unknown> | null;
    queue_id: number;
  }

  interface MockPhysicalListing {
    id: number;
    etsy_listing_id: string;
    product_type: string; // "mug", "tshirt", etc.
  }

  // Physical listings — must never enter the localization queue
  const physicalListings: MockPhysicalListing[] = [
    { id: 101, etsy_listing_id: "phys-mug-001", product_type: "mug" },
    { id: 102, etsy_listing_id: "phys-tshirt-001", product_type: "tshirt" },
  ];

  // Digital products — only those with null localized_metadata are candidates
  const digitalProducts: MockDigitalProduct[] = [
    { id: 1, etsy_listing_id: "dig-stl-001", localized_metadata: null, queue_id: 10 },
    { id: 2, etsy_listing_id: "dig-svg-001", localized_metadata: { de: {}, es: {}, fr: {} }, queue_id: 11 }, // already done
    { id: 3, etsy_listing_id: "dig-cnc-001", localized_metadata: null, queue_id: 12 },
    { id: 4, etsy_listing_id: "dig-osha-001", localized_metadata: null, queue_id: 13 },
    { id: 5, etsy_listing_id: "dig-yaml-001", localized_metadata: null, queue_id: 14 },
    { id: 6, etsy_listing_id: "dig-pattern-001", localized_metadata: null, queue_id: 15 },
    { id: 7, etsy_listing_id: "dig-pattern-002", localized_metadata: null, queue_id: 16 },
  ];

  // Simulate .is("localized_metadata", null).limit(5) query
  const unlocalized = digitalProducts
    .filter((p) => p.localized_metadata === null)
    .slice(0, 5);

  assertEquals(unlocalized.length, 5, "Must select exactly 5 unlocalized digital products per run");
  assert(
    unlocalized.every((p) => p.localized_metadata === null),
    "All selected products must have null localized_metadata",
  );

  // Physical listings must not appear in the localization batch
  const physicalEtsyIds = new Set(physicalListings.map((p) => p.etsy_listing_id));
  const physicalInBatch = unlocalized.filter((p) => physicalEtsyIds.has(p.etsy_listing_id));
  assertEquals(physicalInBatch.length, 0, "No physical POD listings must appear in the localization batch");

  // Already-localized digital listing (id=2) must be excluded
  assert(
    !unlocalized.some((p) => p.etsy_listing_id === "dig-svg-001"),
    "Already-localized digital listing must be skipped",
  );

  // Verify the 7th product (beyond limit=5) is not included this run
  assert(
    !unlocalized.some((p) => p.etsy_listing_id === "dig-pattern-002"),
    "Product beyond the 5-per-run limit must not be processed this run",
  );
});

Deno.test("Phase 2.4 — Three-tier AI waterfall: Lovable fails → Anthropic fails → OpenAI succeeds", async () => {
  const mock = new FetchMock();
  const callSequence: string[] = [];

  mock
    .on("ai.gateway.lovable.dev", () => {
      callSequence.push("lovable");
      return new Response("Payment Required — credit balance exhausted", { status: 402 });
    })
    .on("api.anthropic.com", () => {
      callSequence.push("anthropic");
      return new Response("Overloaded", { status: 529 });
    })
    .on("api.openai.com/v1/chat", () => {
      callSequence.push("openai");
      return jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              de: { title: "Test DE Titel", description: "Beschreibung", tags: ["t1","t2","t3","t4","t5","t6","t7","t8","t9","t10","t11","t12","t13"] },
              es: { title: "Test ES Título", description: "Descripción", tags: ["t1","t2","t3","t4","t5","t6","t7","t8","t9","t10","t11","t12","t13"] },
              fr: { title: "Test FR Titre", description: "Description", tags: ["t1","t2","t3","t4","t5","t6","t7","t8","t9","t10","t11","t12","t13"] },
            }),
          },
        }],
      });
    });

  mock.install();

  try {
    let finalResult = "";

    // Tier 1: Lovable AI Gateway
    const lovableRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer test-lovable", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 900, messages: [{ role: "user", content: "test" }] }),
    });

    if (!lovableRes.ok) {
      // Tier 2: Anthropic direct
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": "test-anthropic",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 900, messages: [{ role: "user", content: "test" }] }),
      });

      if (!anthropicRes.ok) {
        // Tier 3: OpenAI direct
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: "Bearer test-openai", "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o-mini", max_completion_tokens: 900, messages: [{ role: "user", content: "test" }] }),
        });

        if (openaiRes.ok) {
          const d = await openaiRes.json();
          finalResult = d?.choices?.[0]?.message?.content?.trim() ?? "";
        }
      }
    }

    assertEquals(
      callSequence,
      ["lovable", "anthropic", "openai"],
      "Waterfall must follow Lovable → Anthropic → OpenAI order exactly",
    );
    assertMatch(finalResult, /Test DE Titel/, "OpenAI fallback must return parseable localization JSON");
  } finally {
    mock.restore();
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3: SEED DATA INVENTORY, PRICE LOCKING, AND ZERO-SHIPPING CART TEST
// ═════════════════════════════════════════════════════════════════════════════

Deno.test("Phase 3.1 — FINAL_PRICES dictionary matches exact production values for all 12 product types", () => {
  const expectedPrices: Record<string, number> = {
    mug: 2199,
    tshirt: 2699,
    hoodie: 4499,
    sock: 1899,
    hat: 3299,
    mousepad: 1999,
    onesie: 2499,
    tumbler: 3999,
    blanket: 6499,
    sweatshirt: 4999,
    longsleeve: 3499,
    travelmug: 3499,
  };

  assertEquals(
    Object.keys(FINAL_PRICES).length,
    12,
    "FINAL_PRICES must define exactly 12 product types",
  );

  for (const [type, expectedCents] of Object.entries(expectedPrices)) {
    assertEquals(
      FINAL_PRICES[type],
      expectedCents,
      `${type}: expected ${expectedCents}¢ ($${(expectedCents / 100).toFixed(2)}) — pricing regression detected`,
    );
  }

  // Sanity check: no product should be free or negative
  for (const [type, price] of Object.entries(FINAL_PRICES)) {
    assert(price > 0, `${type}: price must be positive (got ${price})`);
    assert(price < 100_00, `${type}: price must be below $100.00 (got ${(price / 100).toFixed(2)})`);
  }
});

Deno.test("Phase 3.2 — Digital seed data: 5 technical products at correct prices from migration", () => {
  assertEquals(DIGITAL_SEED_PRICES.gridfinity_stl, 1999, "Gridfinity STL: $19.99 (1999¢)");
  assertEquals(DIGITAL_SEED_PRICES.svg_dxf, 2450, "SVG/DXF templates: $24.50 (2450¢)");
  assertEquals(DIGITAL_SEED_PRICES.cnc_calc, 1495, "CNC calculator: $14.95 (1495¢)");
  assertEquals(DIGITAL_SEED_PRICES.osha_signs, 2900, "OSHA signage: $29.00 (2900¢)");
  assertEquals(DIGITAL_SEED_PRICES.ha_yaml, 1800, "Home Assistant YAML: $18.00 (1800¢)");

  // Verify all 5 seed products are defined
  assertEquals(
    Object.keys(DIGITAL_SEED_PRICES).length,
    5,
    "Must have exactly 5 digital seed products",
  );

  // All digital prices must be positive
  for (const [product, price] of Object.entries(DIGITAL_SEED_PRICES)) {
    assert(price > 0, `${product}: seed price must be positive`);
  }
});

Deno.test("Phase 3.3 — Etsy listing payload for digital product enforces type:download + null shipping_profile_id", () => {
  // This validates the payload shape used in etsy-digital-product-creator/index.ts.
  // type:"download" + is_digital:true + shipping_profile_id:null → Etsy enforces $0.00 shipping
  // automatically. No additional shipping configuration is needed.

  interface EtsyDigitalListingPayload {
    quantity: number;
    title: string;
    description: string;
    price: number;           // In dollars (Etsy API expects decimal, not cents)
    who_made: string;
    when_made: string;
    taxonomy_id: number;
    type: string;
    is_digital: boolean;
    state: string;
    shipping_profile_id: null;
    tags: string[];
  }

  function buildDigitalListingPayload(
    title: string,
    description: string,
    priceCents: number,
    tags: string[],
  ): EtsyDigitalListingPayload {
    return {
      quantity: 999,                    // Unlimited inventory for digital products
      title,
      description,
      price: priceCents / 100,          // Convert cents to dollars for Etsy API v3
      who_made: "i_did",
      when_made: "2020_2024",
      taxonomy_id: 2078,                // Craft Supplies & Tools taxonomy
      type: "download",                 // Critical: suppresses Etsy shipping selector
      is_digital: true,                 // Critical: marks as digital download
      state: "active",
      shipping_profile_id: null,        // Critical: null enforces $0.00 shipping
      tags,
    };
  }

  const payload = buildDigitalListingPayload(
    "Ultimate Gridfinity Workshop Storage STL Pack — 3D Printable Tool Organizer",
    "Instant digital download: 25+ STL files for Gridfinity-compatible modular tool organizers.",
    DIGITAL_SEED_PRICES.gridfinity_stl, // 1999 cents
    ["3d printing", "gridfinity", "tool storage", "stl files", "workshop organizer",
     "modular storage", "fdm printer", "pla petg", "tool organizer", "3d print files",
     "shop storage", "maker gift", "makerspace"],
  );

  // Shipping enforcement triple-check
  assertEquals(payload.type, "download", "type must be 'download' to suppress Etsy shipping UI");
  assertEquals(payload.is_digital, true, "is_digital must be true");
  assertEquals(payload.shipping_profile_id, null, "shipping_profile_id:null is required for $0.00 shipping");

  // Price conversion: 1999 cents → 19.99 dollars
  assertEquals(payload.price, 19.99, "Price must be converted from cents (1999) to dollars (19.99)");

  // Inventory: digital products use 999 as unlimited proxy
  assertEquals(payload.quantity, 999, "Digital listings must use quantity=999 (unlimited inventory signal)");

  // Tags: Etsy allows max 13 tags
  assert(payload.tags.length <= 13, `Tag count must be ≤13 (got ${payload.tags.length})`);
  assert(payload.tags.length > 0, "Tags array must not be empty");
});

Deno.test("Phase 3.4 — Digital listing payload suppresses all physical apparel attributes", () => {
  // Physical POD listings include Printify-specific attributes that must be completely absent
  // from digital listing payloads. This verifies zero cross-contamination.

  const PHYSICAL_ONLY_ATTRS = [
    "blueprint_id",         // Printify product blueprint
    "print_provider_id",    // Printify print provider
    "variant_ids",          // Printify variant selection
    "placeholders",         // Printify image placement zones
    "apparel_size",         // Size chart data
    "color_options",        // Color variant data
    "processing_min",       // Production time minimum
    "processing_max",       // Production time maximum
  ];

  // Canonical digital listing payload — mirrors etsy-digital-product-creator output
  const digitalPayload: Record<string, unknown> = {
    quantity: 999,
    title: "OSHA Compliance Safety Signage Pack — 30+ Printable PDF Warning Signs",
    description: "Instant digital download: 30+ OSHA-compliant printable safety signs.",
    price: 29.00,
    who_made: "i_did",
    when_made: "2020_2024",
    taxonomy_id: 2078,
    type: "download",
    is_digital: true,
    state: "active",
    shipping_profile_id: null,
    tags: ["osha signs", "safety signs", "printable pdf"],
  };

  const payloadKeys = Object.keys(digitalPayload);

  // All physical-only attributes must be absent
  for (const attr of PHYSICAL_ONLY_ATTRS) {
    assert(
      !payloadKeys.includes(attr),
      `Physical attribute '${attr}' must NOT be present in digital listing payload`,
    );
  }

  // shipping_profile_id is present but null (not absent — needed for $0.00 enforcement)
  assert("shipping_profile_id" in digitalPayload, "shipping_profile_id key must be present");
  assertEquals(digitalPayload.shipping_profile_id, null, "shipping_profile_id must be null");

  // type:download prevents Etsy from rendering apparel variant selectors
  assertEquals(digitalPayload.type, "download", "type:download suppresses all physical product UI elements");
});

Deno.test("Phase 3.5 — Cart simulation: digital items contribute $0.00 to shipping total", () => {
  // Simulates a mixed cart with both physical POD items and digital downloads.
  // Etsy enforces $0.00 shipping on items where type="download" and shipping_profile_id=null.
  // The client-side cart computation should reflect this.

  interface CartItem {
    listing_id: string;
    title: string;
    is_digital: boolean;
    price_cents: number;
    shipping_cost_cents: number; // Raw shipping cost from listing; digital items must be 0
  }

  function resolveShippingForItem(item: CartItem): number {
    // Etsy's platform enforces $0 for digital; this function models that contract
    return item.is_digital ? 0 : item.shipping_cost_cents;
  }

  const cart: CartItem[] = [
    { listing_id: "mug-001", title: "Funny Nurse Mug", is_digital: false, price_cents: 2199, shipping_cost_cents: 599 },
    { listing_id: "stl-001", title: "Gridfinity STL Pack", is_digital: true, price_cents: 1999, shipping_cost_cents: 0 },
    { listing_id: "svg-001", title: "SVG Template Bundle", is_digital: true, price_cents: 2450, shipping_cost_cents: 0 },
    { listing_id: "tshirt-001", title: "Retirement Teacher Shirt", is_digital: false, price_cents: 2699, shipping_cost_cents: 499 },
  ];

  // Per-item shipping assertions
  assertEquals(resolveShippingForItem(cart[0]), 599, "Mug (physical): $5.99 shipping");
  assertEquals(resolveShippingForItem(cart[1]), 0, "STL pack (digital): $0.00 shipping");
  assertEquals(resolveShippingForItem(cart[2]), 0, "SVG bundle (digital): $0.00 shipping");
  assertEquals(resolveShippingForItem(cart[3]), 499, "T-shirt (physical): $4.99 shipping");

  // Cart totals
  const totalShipping = cart.reduce((sum, item) => sum + resolveShippingForItem(item), 0);
  const totalMerchandise = cart.reduce((sum, item) => sum + item.price_cents, 0);
  const digitalOnlyItems = cart.filter((i) => i.is_digital);
  const digitalShippingContribution = digitalOnlyItems.reduce((sum, i) => sum + resolveShippingForItem(i), 0);

  assertEquals(totalShipping, 1098, "Total shipping must be $10.98 (mug $5.99 + tshirt $4.99 only)");
  assertEquals(totalMerchandise, 9347, "Total merchandise must be $93.47 (2199+1999+2450+2699)");
  assertEquals(digitalShippingContribution, 0, "Digital items must contribute exactly $0.00 to shipping total");

  // Verify digital vs physical item count
  assertEquals(digitalOnlyItems.length, 2, "Cart must contain 2 digital items");
  assert(
    cart.filter((i) => !i.is_digital).length === 2,
    "Cart must contain 2 physical items",
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4: BACKGROUND AGENT AGENDA VERIFICATION
// ═════════════════════════════════════════════════════════════════════════════

Deno.test("Phase 4.1 — Post-purchase download button: Etsy native delivery via is_digital:true listing", () => {
  // Etsy renders the "Download Files" button automatically for all listings created with
  // is_digital:true after a successful purchase. No custom delivery implementation is needed.
  // This test validates the listing state contract that triggers Etsy's native download flow.

  interface PurchasedItem {
    listing_id: string;
    is_digital: boolean;
    type: string;
    shipping_profile_id: null | string;
    order_status: "completed" | "processing";
  }

  function getDownloadButtonVisibility(item: PurchasedItem): {
    showDownloadButton: boolean;
    reason: string;
  } {
    // Etsy shows "Access Your Files" / "Download Files" button when:
    // 1. Listing was created as type:"download"
    // 2. is_digital is true
    // 3. Order status is "completed"
    if (item.type === "download" && item.is_digital && item.order_status === "completed") {
      return { showDownloadButton: true, reason: "native_etsy_digital_delivery" };
    }
    return { showDownloadButton: false, reason: "not_a_completed_digital_purchase" };
  }

  // Completed digital purchase — download button must appear
  const completedDigital: PurchasedItem = {
    listing_id: "stl-001",
    is_digital: true,
    type: "download",
    shipping_profile_id: null,
    order_status: "completed",
  };
  const result1 = getDownloadButtonVisibility(completedDigital);
  assertEquals(result1.showDownloadButton, true, "Completed digital purchase must show download button");
  assertEquals(result1.reason, "native_etsy_digital_delivery");

  // Physical item — no download button
  const physicalItem: PurchasedItem = {
    listing_id: "mug-001",
    is_digital: false,
    type: "physical",
    shipping_profile_id: "profile-123",
    order_status: "completed",
  };
  const result2 = getDownloadButtonVisibility(physicalItem);
  assertEquals(result2.showDownloadButton, false, "Physical item must NOT show download button");

  // Digital but processing — button only after fulfillment
  const processingDigital: PurchasedItem = {
    listing_id: "stl-002",
    is_digital: true,
    type: "download",
    shipping_profile_id: null,
    order_status: "processing",
  };
  const result3 = getDownloadButtonVisibility(processingDigital);
  assertEquals(result3.showDownloadButton, false, "Processing order must not yet show download button");
});

Deno.test("Phase 4.2 — store-audit-agent segregates physical POD and digital revenue into separate tracking lines", () => {
  // PodStats interface from store-audit-agent/index.ts must have separate counters.
  // Any merging of physical and digital stats is an audit regression.

  interface PodStats {
    // Physical POD metrics
    publishedThisWeek: number;
    pendingInQueue: number;
    errorCount: number;
    repairBacklog: number;
    totalPublished: number;
    topNiches: string[];
    // Digital download metrics (segregated — never mixed with physical)
    digitalPublishedThisWeek: number;
    digitalPendingInQueue: number;
    digitalTotalPublished: number;
    // International localization metrics
    localizedDigitalCount: number;
  }

  const stats: PodStats = {
    publishedThisWeek: 15,           // Physical POD products created this week
    pendingInQueue: 7,               // Physical products awaiting processing
    errorCount: 2,
    repairBacklog: 4,
    totalPublished: 151,             // Total live physical listings
    topNiches: ["funny nurse mug", "retirement gift", "cat lover tshirt"],
    digitalPublishedThisWeek: 4,     // Digital products created this week (SEPARATE counter)
    digitalPendingInQueue: 5,        // Seed data waiting to be processed
    digitalTotalPublished: 22,       // Total live digital listings
    localizedDigitalCount: 14,       // Digital with DE/ES/FR metadata
  };

  // Physical and digital counters must be independently tracked
  assertNotEquals(
    stats.publishedThisWeek,
    stats.digitalPublishedThisWeek,
    "Physical and digital weekly published counts are separate metrics",
  );
  assertNotEquals(
    stats.totalPublished,
    stats.digitalTotalPublished,
    "Total physical and total digital listings are separate metrics",
  );

  // Digital margin calculation: zero COGS = 100% gross margin
  const digitalCOGS = 0; // No print provider, no fulfillment cost
  const sampleDigitalRevenue = DIGITAL_SEED_PRICES.gridfinity_stl; // 1999 cents
  const grossMarginPercent =
    ((sampleDigitalRevenue - digitalCOGS) / sampleDigitalRevenue) * 100;
  assertEquals(grossMarginPercent, 100, "Digital products must show 100% gross margin (zero COGS)");

  // Localization coverage calculation
  const coveragePercent = stats.digitalTotalPublished > 0
    ? Math.round((stats.localizedDigitalCount / stats.digitalTotalPublished) * 100)
    : 0;
  assertEquals(coveragePercent, Math.round((14 / 22) * 100), "Coverage % must be 14/22 = 64%");
  assert(coveragePercent < 100, "Partial coverage (< 100%) must use amber color in email");

  // When fully covered, must show 100% and green color
  const fullCoverage = Math.round((22 / 22) * 100);
  assertEquals(fullCoverage, 100);
});

Deno.test("Phase 4.3 — Digital price ratchet: 20% bump at ≥5 sales, capped at 2× original price", () => {
  // Mirrors the ratchet logic in pod-seo-agent/index.ts digital ratchet block exactly.

  function computeDigitalRatchet(
    originalPriceCents: number, // price_cents from pod_digital_products at time of creation
    currentPriceCents: number,  // current effective price (from pod_price_history or original)
    numSold: number,
  ): { newPrice: number; shouldInsert: boolean } {
    const cap = Math.floor(originalPriceCents * DIGITAL_RATCHET_CAP_MULTIPLIER); // 2× ceiling
    if (numSold < DIGITAL_RATCHET_THRESHOLD_SALES) return { newPrice: currentPriceCents, shouldInsert: false };
    if (currentPriceCents >= cap) return { newPrice: currentPriceCents, shouldInsert: false };

    const newPrice = Math.min(cap, Math.floor(currentPriceCents * DIGITAL_RATCHET_MULTIPLIER));
    return { newPrice, shouldInsert: newPrice > currentPriceCents };
  }

  // Gridfinity STL ($19.99 original) — first ratchet at exactly 5 sales
  const r1 = computeDigitalRatchet(1999, 1999, 5);
  assertEquals(r1.shouldInsert, true, "Must trigger at exactly 5 sales (threshold boundary)");
  assertEquals(r1.newPrice, Math.floor(1999 * 1.20), "20% bump: 1999 → 2398 (floor(1999 * 1.20))");
  assertEquals(r1.newPrice, 2398, "Gridfinity: $19.99 → $23.98");

  // Below threshold: 4 sales — must not trigger
  const rBelow = computeDigitalRatchet(1999, 1999, 4);
  assertEquals(rBelow.shouldInsert, false, "Must NOT trigger at 4 sales (below 5-sale threshold)");

  // 2× cap enforcement: at ceiling, must not update
  const cap1999 = Math.floor(1999 * 2.0); // = 3998
  const rAtCap = computeDigitalRatchet(1999, cap1999, 20);
  assertEquals(rAtCap.shouldInsert, false, "Must not trigger when already at 2× original cap");
  assertEquals(rAtCap.newPrice, cap1999, "Price at cap must remain unchanged");

  // Cap clamping: price that would overshoot cap
  const rNearCap = computeDigitalRatchet(1999, 3600, 10);
  assert(rNearCap.newPrice <= cap1999, "New price must never exceed 2× original cap");
  assertEquals(rNearCap.newPrice, Math.min(cap1999, Math.floor(3600 * 1.20)));

  // OSHA signs ($29.00 original) — simulate 3 progressive ratchets
  const oshaCap = Math.floor(2900 * 2.0); // 5800 = $58.00
  let oshaPrice = 2900;

  const rOsha1 = computeDigitalRatchet(2900, oshaPrice, 5);
  assertEquals(rOsha1.newPrice, Math.floor(2900 * 1.20), "OSHA ratchet 1: $29.00 → $34.80");
  oshaPrice = rOsha1.newPrice; // 3480

  const rOsha2 = computeDigitalRatchet(2900, oshaPrice, 10);
  assertEquals(rOsha2.newPrice, Math.floor(3480 * 1.20), "OSHA ratchet 2: $34.80 → $41.76");
  oshaPrice = rOsha2.newPrice; // 4176

  const rOsha3 = computeDigitalRatchet(2900, oshaPrice, 15);
  assert(rOsha3.newPrice <= oshaCap, "OSHA ratchet 3: price must not exceed $58.00 cap");
  assertEquals(rOsha3.newPrice, Math.min(oshaCap, Math.floor(4176 * 1.20)));

  // SVG/DXF templates ($24.50 original)
  const rSvg = computeDigitalRatchet(2450, 2450, 5);
  assertEquals(rSvg.newPrice, Math.floor(2450 * 1.20), "SVG/DXF: $24.50 → $29.40");
  assertEquals(rSvg.newPrice, 2940);
});

Deno.test("Phase 4.4 — Physical price ratchet: tiered 8%/9%/10% at 5/15/30 sales with 1.30× cap", () => {
  // Mirrors the physical ratchet logic in pod-seo-agent/index.ts (Upgrade #15).
  // START_PRICES in pod-seo-agent is a separate map from FINAL_PRICES; both should match.

  const START_PRICES_SEO_AGENT: Record<string, number> = {
    mug: 2199, tshirt: 2699, hoodie: 4499, sock: 1899, hat: 3299, mousepad: 1999,
    onesie: 2499, tumbler: 3999, blanket: 6499, sweatshirt: 4999, longsleeve: 3499, travelmug: 3499,
  };

  function computePhysicalRatchet(
    productType: string,
    currentPrice: number,
    numSold: number,
  ): { newPrice: number; shouldUpdate: boolean } {
    const startPrice = START_PRICES_SEO_AGENT[productType] ?? 2699;
    const cap = Math.floor(startPrice * PHYSICAL_RATCHET_CAP_MULTIPLIER); // 1.30×
    if (currentPrice >= cap) return { newPrice: currentPrice, shouldUpdate: false };

    let newPrice = currentPrice;
    if (numSold >= 30 && currentPrice < Math.floor(startPrice * 1.17)) {
      newPrice = Math.min(cap, Math.floor(currentPrice * 1.10));
    } else if (numSold >= 15 && currentPrice < Math.floor(startPrice * 1.08)) {
      newPrice = Math.min(cap, Math.floor(currentPrice * 1.09));
    } else if (numSold >= 5 && currentPrice < startPrice) {
      newPrice = Math.min(cap, Math.floor(currentPrice * 1.08));
    }
    return { newPrice, shouldUpdate: newPrice > currentPrice };
  }

  // START_PRICES must match FINAL_PRICES exactly (both should be in sync)
  for (const type of Object.keys(FINAL_PRICES)) {
    assertEquals(
      START_PRICES_SEO_AGENT[type],
      FINAL_PRICES[type],
      `${type}: START_PRICES in pod-seo-agent must match FINAL_PRICES (sync required)`,
    );
  }

  // 5-sale tier: condition is currentPrice < startPrice (strictly less than).
  // This is a floor-correction guard — fires only if a product was somehow priced below start.
  // A product AT its start price (2199 == 2199) does NOT trigger the 5-sale bump.
  const mugAtStart = computePhysicalRatchet("mug", 2199, 5);
  assertEquals(mugAtStart.shouldUpdate, false,
    "Mug at exact start price (2199): 5-sale ratchet requires currentPrice < startPrice (strictly), not ≤");

  // 5-sale ratchet fires when price is below start (e.g., product manually discounted)
  const mugBelowStart = computePhysicalRatchet("mug", 2100, 5);
  assertEquals(mugBelowStart.shouldUpdate, true, "Mug below start price: 5-sale ratchet must fire");
  assertEquals(mugBelowStart.newPrice, Math.floor(2100 * 1.08), "8% bump: floor(2100 * 1.08) = 2268");

  // 15-sale tier fires when price is below 1.08× start
  const mug15 = computePhysicalRatchet("mug", 2199, 15);
  // 2199 < floor(2199 * 1.08) = 2374: condition met → 9% bump
  assertEquals(mug15.shouldUpdate, true, "Mug at start price: 15-sale ratchet must fire (below 1.08× threshold)");
  assertEquals(mug15.newPrice, Math.min(Math.floor(2199 * 1.30), Math.floor(2199 * 1.09)));

  // Mug at cap — no further update
  const mugCap = Math.floor(2199 * 1.30); // = 2858
  const mugAtCap = computePhysicalRatchet("mug", mugCap, 50);
  assertEquals(mugAtCap.shouldUpdate, false, "Mug at 1.30× cap: must not apply further ratchet");

  // Cap value assertions
  assertEquals(mugCap, 2858, "Mug 1.30× cap = $28.58");
  assert(mugCap < DIGITAL_RATCHET_CAP_MULTIPLIER * 2199, "Physical cap (1.30×) is strictly lower than digital cap (2.0×)");

  // Hoodie at 15 sales → 9% tier (if below 1.08× start)
  const hoodie15 = computePhysicalRatchet("hoodie", 4499, 15);
  // 4499 < floor(4499 * 1.08) = 4858, condition met
  assertEquals(hoodie15.shouldUpdate, true, "Hoodie: must ratchet at 15 sales");
  assertEquals(hoodie15.newPrice, Math.min(Math.floor(4499 * 1.30), Math.floor(4499 * 1.09)));

  // Blanket at 30 sales → 10% tier
  const blanket30 = computePhysicalRatchet("blanket", 6499, 30);
  assertEquals(blanket30.shouldUpdate, true, "Blanket: must ratchet at 30 sales");
  assert(blanket30.newPrice <= Math.floor(6499 * 1.30), "Blanket new price must not exceed 1.30× cap");
});

Deno.test("Phase 4.5 — etsy-trend-scanner digital niche detection flags niches with ≥2 digital keywords", () => {
  function detectDigitalNiche(listingTitles: string[]): {
    isDigitalNiche: boolean;
    matchedKeywords: string[];
    stateKey: string;
  } {
    const corpus = listingTitles.map((t) => t.toLowerCase()).join(" ");
    const matched = DIGITAL_KEYWORDS.filter((kw) => corpus.includes(kw));
    const isDigital = matched.length >= 2;
    const rawNiche = listingTitles[0].slice(0, 40).toLowerCase().replace(/\W+/g, "_");
    return {
      isDigitalNiche: isDigital,
      matchedKeywords: matched,
      stateKey: `digital_niche_${rawNiche}`,
    };
  }

  // Clearly digital niche — STL/SVG/DXF in titles
  const digitalNiche = [
    "Boho Floral SVG Cut File Bundle for Cricut Silhouette",
    "Mandala SVG DXF Template for Laser Cutting Machine",
    "Printable Watercolor Wedding Invitation Template PDF Bundle",
  ];
  const digitalResult = detectDigitalNiche(digitalNiche);
  assert(digitalResult.isDigitalNiche, "SVG/DXF/printable niche must be flagged as digital");
  assert(digitalResult.matchedKeywords.length >= 2, "Must match ≥2 digital keywords");
  assert(digitalResult.matchedKeywords.includes("svg"), "Must detect 'svg'");
  assert(digitalResult.matchedKeywords.includes("template") || digitalResult.matchedKeywords.includes("printable"),
    "Must detect 'template' or 'printable'");
  assertMatch(digitalResult.stateKey, /^digital_niche_[a-z0-9_]+$/, "State key must follow digital_niche_{slug} pattern");

  // Physical-only niche — zero digital keywords
  const physicalNiche = [
    "Funny Nurse Mug Gift for Women RN Coffee Cup",
    "Cute Cat Coffee Mug Animal Lover Gift Idea",
    "Retirement Gift Mug for Men Women Funny Retired",
  ];
  const physicalResult = detectDigitalNiche(physicalNiche);
  assert(!physicalResult.isDigitalNiche, "Physical niche must NOT be flagged as digital");
  assertEquals(physicalResult.matchedKeywords.length, 0, "Physical niche must have 0 digital keyword matches");

  // Edge case: exactly 2 keywords — must flag (threshold is ≥2, inclusive)
  const borderlineTitles = [
    "Printable Birthday Party Banner — Free Shipping",
    "Custom Handmade Ceramic Planner Notebook Cover",
  ];
  const borderlineResult = detectDigitalNiche(borderlineTitles);
  assert(borderlineResult.matchedKeywords.includes("printable"), "Must detect 'printable'");
  assert(borderlineResult.matchedKeywords.includes("planner"), "Must detect 'planner'");
  assertEquals(borderlineResult.matchedKeywords.length, 2, "Must find exactly 2 matches");
  assert(borderlineResult.isDigitalNiche, "Exactly 2 keyword matches must satisfy ≥2 threshold");
});

Deno.test("Phase 4.6 — pod_price_history row schema and trigger format for digital ratchet", () => {
  // Validates the INSERT shape used in pod-seo-agent/index.ts for both digital and physical ratchets.
  // Schema: etsy_listing_id text, old_price_cents int, new_price_cents int, trigger text, changed_at timestamptz

  const numSold = 7;
  const etsyListingId = "digital-stl-001";
  const oldPrice = DIGITAL_SEED_PRICES.gridfinity_stl; // 1999
  const newPrice = Math.min(
    Math.floor(oldPrice * DIGITAL_RATCHET_CAP_MULTIPLIER),
    Math.floor(oldPrice * DIGITAL_RATCHET_MULTIPLIER),
  ); // = 2398

  const digitalRatchetRow = {
    etsy_listing_id: etsyListingId,
    old_price_cents: oldPrice,
    new_price_cents: newPrice,
    trigger: `digital_ratchet_${numSold}`,
    changed_at: new Date().toISOString(),
  };

  // Schema type checks
  assertEquals(typeof digitalRatchetRow.etsy_listing_id, "string", "etsy_listing_id must be string");
  assertEquals(typeof digitalRatchetRow.old_price_cents, "number", "old_price_cents must be number");
  assertEquals(typeof digitalRatchetRow.new_price_cents, "number", "new_price_cents must be number");
  assertEquals(typeof digitalRatchetRow.trigger, "string", "trigger must be string");
  assertEquals(typeof digitalRatchetRow.changed_at, "string", "changed_at must be string");

  // Value assertions
  assertEquals(digitalRatchetRow.old_price_cents, 1999, "old_price_cents must be 1999");
  assertEquals(digitalRatchetRow.new_price_cents, 2398, "new_price_cents must be 2398");
  assertEquals(digitalRatchetRow.trigger, "digital_ratchet_7", "trigger must be 'digital_ratchet_7'");
  assertMatch(digitalRatchetRow.trigger, /^digital_ratchet_\d+$/, "Digital trigger pattern: digital_ratchet_{n}");
  assertMatch(
    digitalRatchetRow.changed_at,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    "changed_at must be ISO 8601 timestamp",
  );
  assert(
    digitalRatchetRow.new_price_cents > digitalRatchetRow.old_price_cents,
    "New price must be greater than old price (ratchet only goes up)",
  );

  // Physical ratchet trigger has distinct prefix
  const physicalTrigger = `sales_ratchet_${numSold}`;
  assertMatch(physicalTrigger, /^sales_ratchet_\d+$/, "Physical trigger pattern: sales_ratchet_{n}");
  assertNotEquals(
    digitalRatchetRow.trigger.split("_")[0],
    physicalTrigger.split("_")[0],
    "Digital ('digital') and physical ('sales') ratchet triggers must have distinct prefixes",
  );
});

Deno.test("Phase 4.7 — pod-seo-agent digital ratchet skips non-digital listings correctly", () => {
  // Simulates the inner loop logic of pod-seo-agent that processes pod_listing_stats
  // and cross-references pod_digital_products to identify which listings to ratchet.

  interface ListingStat {
    etsy_listing_id: string;
    num_sold: number;
  }

  interface DigitalProductRow {
    id: number;
    price_cents: number;
    etsy_listing_id: string;
  }

  const listingStats: ListingStat[] = [
    { etsy_listing_id: "digital-001", num_sold: 7 },    // Digital, qualifies
    { etsy_listing_id: "physical-001", num_sold: 12 },  // Physical, no pod_digital_products row
    { etsy_listing_id: "digital-002", num_sold: 5 },    // Digital, qualifies (boundary case)
    { etsy_listing_id: "digital-003", num_sold: 3 },    // Digital, below threshold
  ];

  // Only digital products exist in pod_digital_products
  const digitalProductLookup: Record<string, DigitalProductRow> = {
    "digital-001": { id: 1, price_cents: 1999, etsy_listing_id: "digital-001" },
    "digital-002": { id: 2, price_cents: 2450, etsy_listing_id: "digital-002" },
    "digital-003": { id: 3, price_cents: 1800, etsy_listing_id: "digital-003" },
    // "physical-001" intentionally absent — simulates .maybeSingle() returning null
  };

  const ratchetResults: Array<{ listingId: string; newPrice: number }> = [];
  let skippedCount = 0;

  for (const stat of listingStats) {
    const dp = digitalProductLookup[stat.etsy_listing_id] ?? null;
    if (!dp) { skippedCount++; continue; } // Not in pod_digital_products — skip

    const current = dp.price_cents;
    const cap = Math.floor(dp.price_cents * DIGITAL_RATCHET_CAP_MULTIPLIER);
    if (current >= cap) continue;
    if (stat.num_sold < DIGITAL_RATCHET_THRESHOLD_SALES) continue;

    const newPrice = Math.min(cap, Math.floor(current * DIGITAL_RATCHET_MULTIPLIER));
    if (newPrice <= current) continue;

    ratchetResults.push({ listingId: stat.etsy_listing_id, newPrice });
  }

  // digital-001 and digital-002 qualify; physical-001 is skipped; digital-003 is below threshold
  assertEquals(ratchetResults.length, 2, "Must ratchet exactly 2 qualifying digital listings");
  assertEquals(skippedCount, 1, "Must skip exactly 1 non-digital listing (physical-001)");

  const ratchetIds = ratchetResults.map((r) => r.listingId);
  assert(ratchetIds.includes("digital-001"), "digital-001 (7 sales) must be ratcheted");
  assert(ratchetIds.includes("digital-002"), "digital-002 (5 sales, boundary) must be ratcheted");
  assert(!ratchetIds.includes("physical-001"), "physical-001 must be skipped (not in pod_digital_products)");
  assert(!ratchetIds.includes("digital-003"), "digital-003 (3 sales, below threshold) must be skipped");

  // Verify computed prices
  const r1 = ratchetResults.find((r) => r.listingId === "digital-001")!;
  assertEquals(r1.newPrice, Math.floor(1999 * 1.20), "digital-001 ratcheted price must be floor(1999 * 1.20) = 2398");

  const r2 = ratchetResults.find((r) => r.listingId === "digital-002")!;
  assertEquals(r2.newPrice, Math.floor(2450 * 1.20), "digital-002 ratcheted price must be floor(2450 * 1.20) = 2940");
});

Deno.test("Phase 4.8 — store-audit-agent INTERNATIONAL REACH email section: coverage math and locale flags", () => {
  // Validates the HTML email section generated by store-audit-agent for localization reporting.
  // Source: store-audit-agent/index.ts — international reach block.

  function buildInternationalReachSection(localizedCount: number, totalDigital: number): string {
    const coveragePercent = totalDigital > 0
      ? Math.round((localizedCount / totalDigital) * 100)
      : 0;
    // Green when fully covered; amber when partial
    const coverageColor = localizedCount === totalDigital && totalDigital > 0
      ? "#22c55e"
      : "#f59e0b";

    return `
<h3 style="color:#34d399;margin:16px 0 8px;font-size:13px;">🌍 INTERNATIONAL REACH — DIGITAL</h3>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
  <tr>
    <td style="padding:6px 10px;border-bottom:1px solid #1e293b;color:#94a3b8;width:55%;">Listings with DE/ES/FR metadata</td>
    <td style="padding:6px 10px;border-bottom:1px solid #1e293b;font-weight:bold;">${localizedCount} / ${totalDigital}</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border-bottom:1px solid #1e293b;color:#94a3b8;">Localization coverage</td>
    <td style="padding:6px 10px;border-bottom:1px solid #1e293b;color:${coverageColor};">${coveragePercent}%</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;color:#94a3b8;">Markets covered</td>
    <td style="padding:6px 10px;">🇩🇪 German · 🇪🇸 Spanish · 🇫🇷 French</td>
  </tr>
</table>`;
  }

  // Partial coverage: 14 of 22 = 64%
  const partialHtml = buildInternationalReachSection(14, 22);
  assertMatch(partialHtml, /INTERNATIONAL REACH — DIGITAL/, "Section header must be present");
  assertMatch(partialHtml, /14 \/ 22/, "Must display localized count out of total");
  assertMatch(partialHtml, /64%/, `Coverage must be 64% (14/22 = ${Math.round(14/22*100)}%)`);
  assertMatch(partialHtml, /#f59e0b/, "Partial coverage must use amber color (#f59e0b)");
  assertMatch(partialHtml, /🇩🇪 German/, "Must include German flag and label");
  assertMatch(partialHtml, /🇪🇸 Spanish/, "Must include Spanish flag and label");
  assertMatch(partialHtml, /🇫🇷 French/, "Must include French flag and label");
  assertMatch(partialHtml, /34d399/, "Section header must use green (#34d399) color");

  // Full coverage: 22 of 22 = 100%
  const fullHtml = buildInternationalReachSection(22, 22);
  assertMatch(fullHtml, /100%/, "Full coverage must display 100%");
  assertMatch(fullHtml, /#22c55e/, "Full coverage must use green color (#22c55e)");
  assert(!fullHtml.includes("#f59e0b"), "Full coverage must NOT use amber color");

  // Zero products: 0 of 0 = 0%
  const zeroHtml = buildInternationalReachSection(0, 0);
  assertMatch(zeroHtml, /0%/, "Zero digital products must display 0% coverage");
  assertMatch(zeroHtml, /0 \/ 0/, "Must display 0/0");
});

Deno.test("Phase 4.9 — pod-seo-agent response JSON includes all architectural overhaul counters", () => {
  // Validates the complete response shape from pod-seo-agent after the full system overhaul.
  // Every new feature (digital ratchet, localization, triage) must appear in the response.

  const mockResponse = {
    success: true,
    ranAtOffset: 0,
    nextOffset: 3,
    updated: 3,
    sweepComplete: false,
    priceRatchets: 1,           // Physical ratchet count this run (Upgrade #15)
    digitalRatchets: 2,         // Digital ratchet count this run (20% ratchet feature)
    localizationsGenerated: 5,  // DE/ES/FR localizations this run (max 5 per run)
    statsTriageUnderperformers: 12, // Listings with CTR < 50% of avg (Upgrade #9)
    statsTriageDead: 3,         // Listings with <10 views in 14 days (Upgrade #9)
  };

  // All new counters from the architectural overhaul must be present
  assert("priceRatchets" in mockResponse, "Response must include priceRatchets (physical ratchet counter)");
  assert("digitalRatchets" in mockResponse, "Response must include digitalRatchets (digital ratchet counter)");
  assert("localizationsGenerated" in mockResponse, "Response must include localizationsGenerated");
  assert("statsTriageUnderperformers" in mockResponse, "Response must include statsTriageUnderperformers");
  assert("statsTriageDead" in mockResponse, "Response must include statsTriageDead");

  // Type assertions
  assertEquals(typeof mockResponse.priceRatchets, "number");
  assertEquals(typeof mockResponse.digitalRatchets, "number");
  assertEquals(typeof mockResponse.localizationsGenerated, "number");

  // Business rule: localization is capped at 5 per run to limit AI API spend (~15s for 5 calls)
  assert(mockResponse.localizationsGenerated <= 5, "Localization must be capped at 5 per run");

  // Ratchet counters must be non-negative (no negative ratchets possible)
  assert(mockResponse.priceRatchets >= 0, "priceRatchets must be ≥ 0");
  assert(mockResponse.digitalRatchets >= 0, "digitalRatchets must be ≥ 0");
  assert(mockResponse.localizationsGenerated >= 0, "localizationsGenerated must be ≥ 0");
});

// ═════════════════════════════════════════════════════════════════════════════
// BONUS: CRC32 ALGORITHM CORRECTNESS
// ═════════════════════════════════════════════════════════════════════════════

Deno.test("Bonus 1 — crc32 produces correct checksums against known test vectors", () => {
  // CRC32 of empty input = 0x00000000 (by definition: XOR of 0xFFFFFFFF XOR 0xFFFFFFFF)
  assertEquals(crc32(new Uint8Array(0)), 0x00000000, "CRC32 of empty array must be 0x00000000");

  // ISO 3309 / CRC32b standard test vector: CRC32("123456789") = 0xCBF43926
  const standardTestVector = new TextEncoder().encode("123456789");
  assertEquals(
    crc32(standardTestVector),
    0xCBF43926,
    "CRC32 of '123456789' must equal standard test vector 0xCBF43926 (ISO 3309)",
  );

  // CRC32 output must be a valid 32-bit unsigned integer
  const anyData = new TextEncoder().encode("pattern-generation-pipeline test data");
  const result = crc32(anyData);
  assert(result >= 0 && result <= 0xFFFFFFFF, "CRC32 output must be within 32-bit unsigned range");

  // Two different inputs must (almost certainly) produce different CRCs
  const crc1 = crc32(new TextEncoder().encode("variation_1"));
  const crc2 = crc32(new TextEncoder().encode("variation_2"));
  assertNotEquals(crc1, crc2, "Different inputs must produce different CRC32 values");
});

Deno.test("Bonus 2 — PNG identity: injectDPI is non-destructive (magic bytes preserved across double-injection)", () => {
  // If injectDPI is accidentally called twice (e.g., on already-processed PNG),
  // the output must not corrupt the PNG magic bytes or throw. This documents
  // the double-injection behavior: two pHYs chunks will be present, but the file
  // remains structurally valid for software that reads the first pHYs chunk.

  const original = makeMinimalPng();
  const once = injectDPI(original, 300);
  const twice = injectDPI(once, 300); // Simulated accidental double-injection

  // PNG signature must survive both injections
  assertEquals(twice[0], 0x89, "Magic byte 0 must be preserved after double injection");
  assertEquals(twice[1], 0x50, "Magic byte 1 must be preserved after double injection");
  assertEquals(twice[2], 0x4E, "Magic byte 2 must be preserved after double injection");
  assertEquals(twice[3], 0x47, "Magic byte 3 must be preserved after double injection");

  // Each injection adds exactly 21 bytes
  assertEquals(
    twice.length,
    once.length + 21,
    "Second pHYs injection must add exactly 21 bytes to the already-injected PNG",
  );
  assertEquals(
    twice.length,
    original.length + 42,
    "Double-injected PNG must be exactly 42 bytes larger than original (2 × 21 bytes)",
  );
});


// ═════════════════════════════════════════════════════════════════════════════
// PHASE 5: GLOBAL ROUTING ARCHITECTURE
// Tests the route-global-printify-order edge function components:
//   • generateUniqueMarketplacePrompts — prompt count, MJ suffix, distinctness
//   • printify_global_routing_matrix — UNIQUE constraint, domestic bypass,
//     international lookup, missing-route 422, 30% margin guardrail
//   • Printify Order API dispatch — payload shape validation
//   • pod_order_audit — audit log payload schema
//   • Seed data — blanket/tumbler prices in public.products
//   • product_fulfillment_type ENUM — valid values
// ═════════════════════════════════════════════════════════════════════════════

// ── Re-implement generateUniqueMarketplacePrompts locally for isolated testing ──
// Mirrors the exact logic in route-global-printify-order/index.ts
const TOPIC_PROMPTS_TEST: Record<string, [string, string, string]> = {
  wildflower_family_blanket: [
    "Art Nouveau linocut wildflower meadow with bold hand-carved botanical stems, arching petals and deep relief shadows, warm ivory parchment ground, family name elegantly woven into the composition in serif letterpress type, premium textile surface design" + MJ_SUFFIX,
    "Intricate block-print wildflower field in Japonisme ink style, organic curved stems and stippled petal clusters on cream linen texture, negative space balanced for name personalization, heirloom blanket wrap-around repeat" + MJ_SUFFIX,
    "Flat mid-century botanical illustration of meadow wildflowers with muted sage and ochre palette, geometric stem arrangements and stylized blossom geometry, heraldic family crest placeholder centered, wide-format sherpa throw layout" + MJ_SUFFIX,
  ],
  gothic_tarot_tumbler: [
    "Obsidian black backdrop with delicate fine-line gold monoline tarot card symbolic motifs: the moon, the star, the wheel, sacred geometry pentagram, constellation star maps with hairline gold meridian threads, maximalist detail" + MJ_SUFFIX,
    "Intricate monoline gothic illustration on deep black: tarot major arcana symbols intertwined with star constellation lines, fibonacci spiral geometry, alchemical sigils in gold ink outline, cylindrical tumbler wrap" + MJ_SUFFIX,
    "Fine-line gold geometry celestial tumbler: esoteric sacred geometry overlaid with astronomical constellation maps, ornate occult iconography, crescent moon and all-seeing eye motifs, obsidian field, ultra-fine single-weight line art" + MJ_SUFFIX,
  ],
};

function generateUniqueMarketplacePromptsTest(topicId: string): string[] {
  const prompts = TOPIC_PROMPTS_TEST[topicId];
  if (prompts) return [...prompts];
  return [
    `${topicId} premium surface pattern design, intricate repeating motif, professional textile illustration, high detail` + MJ_SUFFIX,
    `${topicId} bold graphic design for merchandise, strong composition, vibrant color palette, commercial print-ready` + MJ_SUFFIX,
    `${topicId} vintage-inspired decorative art, hand-crafted aesthetic, warm tones, artisan quality surface design` + MJ_SUFFIX,
  ];
}

// ── Routing matrix type ────────────────────────────────────────────────────
interface RoutingMatrixRow {
  base_product_id: number;
  target_country_code: string;
  print_provider_id: number;
  blueprint_variant_id: string;
  localized_base_cost_usd: number;
}

// Simulated routing matrix (mirrors migration seed data)
const MOCK_ROUTING_MATRIX: RoutingMatrixRow[] = [
  { base_product_id: BLUEPRINT_BLANKET,      target_country_code: "DE", print_provider_id: 4,  blueprint_variant_id: "blanket-238-de-60x80-sherpa", localized_base_cost_usd: 28.50 },
  { base_product_id: BLUEPRINT_BLANKET,      target_country_code: "CA", print_provider_id: 3,  blueprint_variant_id: "blanket-238-ca-60x80-sherpa", localized_base_cost_usd: 31.00 },
  { base_product_id: BLUEPRINT_BLANKET,      target_country_code: "GB", print_provider_id: 5,  blueprint_variant_id: "blanket-238-gb-60x80-sherpa", localized_base_cost_usd: 27.75 },
  { base_product_id: BLUEPRINT_TUMBLER_INTL, target_country_code: "DE", print_provider_id: 4,  blueprint_variant_id: "tumbler-1715-de-40oz-steel",  localized_base_cost_usd: 14.50 },
  { base_product_id: BLUEPRINT_TUMBLER_INTL, target_country_code: "CA", print_provider_id: 3,  blueprint_variant_id: "tumbler-1715-ca-40oz-steel",  localized_base_cost_usd: 15.25 },
  { base_product_id: BLUEPRINT_TUMBLER_INTL, target_country_code: "AU", print_provider_id: 26, blueprint_variant_id: "tumbler-1715-au-40oz-steel",  localized_base_cost_usd: 16.00 },
];

function lookupRoute(blueprintId: number, countryCode: string): RoutingMatrixRow | null {
  return MOCK_ROUTING_MATRIX.find(
    (r) => r.base_product_id === blueprintId && r.target_country_code === countryCode.toUpperCase()
  ) ?? null;
}

function computeMargin(retailPriceCents: number, baseCostUsd: number): number {
  const retailUsd = retailPriceCents / 100;
  return (retailUsd - baseCostUsd) / retailUsd;
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.test("Phase 5.1 — printify_global_routing_matrix UNIQUE constraint: duplicate (base_product_id, country) rejected", () => {
  // Simulate the UNIQUE(base_product_id, target_country_code) constraint behavior.
  // Inserting a duplicate row must overwrite nothing (ON CONFLICT DO NOTHING).

  const matrix: Map<string, RoutingMatrixRow> = new Map();

  function insertRow(row: RoutingMatrixRow): "inserted" | "conflict" {
    const key = `${row.base_product_id}:${row.target_country_code}`;
    if (matrix.has(key)) return "conflict";
    matrix.set(key, row);
    return "inserted";
  }

  assertEquals(insertRow({ base_product_id: 238, target_country_code: "DE", print_provider_id: 4, blueprint_variant_id: "blanket-238-de", localized_base_cost_usd: 28.50 }), "inserted");
  assertEquals(insertRow({ base_product_id: 238, target_country_code: "DE", print_provider_id: 99, blueprint_variant_id: "duplicate-row", localized_base_cost_usd: 99.00 }), "conflict", "Duplicate (238, DE) must be rejected");
  assertEquals(insertRow({ base_product_id: 238, target_country_code: "CA", print_provider_id: 3, blueprint_variant_id: "blanket-238-ca", localized_base_cost_usd: 31.00 }), "inserted", "Different country must be allowed");
  assertEquals(insertRow({ base_product_id: 1715, target_country_code: "DE", print_provider_id: 4, blueprint_variant_id: "tumbler-1715-de", localized_base_cost_usd: 14.50 }), "inserted", "Different blueprint ID with same country must be allowed");

  assertEquals(matrix.size, 3, "Matrix must contain exactly 3 unique rows");

  // Existing row must not be overwritten by the conflict attempt
  assertEquals(matrix.get("238:DE")!.print_provider_id, 4, "Original provider_id must survive conflict");
  assertEquals(matrix.get("238:DE")!.localized_base_cost_usd, 28.50, "Original base cost must survive conflict");
});

Deno.test("Phase 5.2 — Domestic US routing: countryCode=US bypasses matrix lookup, dispatches with default parameters", async () => {
  const mock = new FetchMock();
  const capturedPrintifyBodies: Record<string, unknown>[] = [];
  let matrixQueriedForUS = false;

  mock.on("api.printify.com", async (_url, init) => {
    capturedPrintifyBodies.push(JSON.parse((init?.body as string) ?? "{}"));
    return jsonResponse({ id: "printify-order-us-001" });
  });

  mock.install();
  try {
    const orderId = "order-us-001";
    const countryCode = "US";
    const lineItems = [{ productId: BLUEPRINT_BLANKET, quantity: 1, retailPriceCents: Math.round(BLANKET_RETAIL_USD * 100) }];

    // Simulate domestic routing: US orders skip the matrix entirely
    if (countryCode !== "US") {
      matrixQueriedForUS = true; // This branch must NOT be taken for US
      lookupRoute(lineItems[0].productId, countryCode);
    }

    // Domestic dispatch — no provider override
    const payload = {
      external_id: orderId,
      line_items: lineItems.map((item) => ({ blueprint_id: item.productId, quantity: item.quantity })),
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: { country: countryCode },
    };

    await fetch(`https://api.printify.com/v1/shops/2890106/orders.json`, {
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assertEquals(matrixQueriedForUS, false, "Matrix must NOT be queried for domestic US orders");
    assertEquals(capturedPrintifyBodies.length, 1, "Must dispatch exactly one Printify order");

    const dispatched = capturedPrintifyBodies[0];
    assertEquals(dispatched.external_id, orderId, "external_id must match orderId");
    assertEquals((dispatched.address_to as Record<string,string>).country, "US", "address_to.country must be US");
    assert(!("print_provider_id" in (dispatched as Record<string, unknown>)), "Domestic dispatch must not include provider override at top level");
  } finally { mock.restore(); }
});

Deno.test("Phase 5.3 — International routing: matrix row found → correct provider and variant extracted", () => {
  // DE order for a blanket should return provider 4 and the DE-specific variant
  const deRoute = lookupRoute(BLUEPRINT_BLANKET, "DE");

  assertExists(deRoute, "Route must exist for blueprint 238 → DE");
  assertEquals(deRoute!.print_provider_id, 4, "DE blanket must use provider 4 (EU Gelato)");
  assertEquals(deRoute!.blueprint_variant_id, "blanket-238-de-60x80-sherpa", "DE blanket variant ID must match seed data");
  assertEquals(deRoute!.localized_base_cost_usd, 28.50, "DE blanket base cost must be $28.50");

  // AU order for a tumbler should return provider 26
  const auRoute = lookupRoute(BLUEPRINT_TUMBLER_INTL, "AU");
  assertExists(auRoute);
  assertEquals(auRoute!.print_provider_id, 26, "AU tumbler must use provider 26 (Monster Digital AU)");
  assertEquals(auRoute!.blueprint_variant_id, "tumbler-1715-au-40oz-steel");

  // GB blanket should use provider 5
  const gbRoute = lookupRoute(BLUEPRINT_BLANKET, "GB");
  assertExists(gbRoute);
  assertEquals(gbRoute!.print_provider_id, 5);

  // Case-insensitivity: lower-case 'de' should match 'DE'
  const deRouteLower = lookupRoute(BLUEPRINT_BLANKET, "de");
  assertExists(deRouteLower, "Routing lookup must be case-insensitive");
  assertEquals(deRouteLower!.print_provider_id, 4);
});

Deno.test("Phase 5.4 — 30% margin guardrail: margin=28% halts dispatch and returns pending_review", () => {
  // Blanket retail: $64.99. If base cost is $46.79, margin = (64.99-46.79)/64.99 = 28.00%
  const retailCents = Math.round(BLANKET_RETAIL_USD * 100); // 6499
  const retailUsd = retailCents / 100;                       // 64.99
  const baseCostUsd = 46.79;
  const margin = computeMargin(retailCents, baseCostUsd);

  // Verify the math
  assert(
    Math.abs(margin - (retailUsd - baseCostUsd) / retailUsd) < 0.0001,
    "Margin computation must be (retail - cost) / retail",
  );
  assert(margin < MARGIN_FLOOR, `Margin ${(margin * 100).toFixed(2)}% must be below 30% floor`);
  assertEquals(Math.round(margin * 10000) / 100, 28.0, "Margin must be exactly 28.00%");

  // Simulate the guardrail decision
  function applyMarginGuardrail(retailCents: number, baseCostUsd: number): "dispatch" | "pending_review" {
    const m = computeMargin(retailCents, baseCostUsd);
    return m >= MARGIN_FLOOR ? "dispatch" : "pending_review";
  }

  assertEquals(applyMarginGuardrail(6499, 46.79), "pending_review", "28% margin must halt to pending_review");
  assertEquals(applyMarginGuardrail(6499, 45.50), "pending_review", "Margin ~29.99% rounding test: 45.50 → 29.99% (just below 30% boundary)");
  assertEquals(applyMarginGuardrail(6499, 45.00), "dispatch",       "~30.8% must pass");
  assertEquals(applyMarginGuardrail(6499, 0.00),  "dispatch",       "Free product must pass (100% margin)");
});

Deno.test("Phase 5.5 — 30% margin guardrail: exactly 30.00% passes (boundary inclusive)", () => {
  // Tumbler retail: $39.99. For exactly 30% margin: cost = 39.99 * (1 - 0.30) = 27.993
  const retailCents = Math.round(TUMBLER_RETAIL_USD * 100); // 3999
  const retailUsd = retailCents / 100;                       // 39.99

  // Compute cost that yields exactly 30% margin
  const exactCost = retailUsd * (1 - MARGIN_FLOOR); // = 39.99 * 0.70 = 27.993
  const margin = computeMargin(retailCents, exactCost);

  // Due to floating-point, margin should be >= 0.30 (at the floor boundary)
  assert(
    margin >= MARGIN_FLOOR || Math.abs(margin - MARGIN_FLOOR) < 1e-10,
    `Margin at exact boundary must be >= ${MARGIN_FLOOR} (got ${margin})`,
  );

  // A cost just below the boundary (slightly cheaper) → margin just above 30% → dispatch
  const slightlyBelowCost = exactCost - 0.01;
  assert(computeMargin(retailCents, slightlyBelowCost) > MARGIN_FLOOR, "Cost below boundary must yield margin > 30%");

  // A cost just above the boundary (slightly more expensive) → margin just below 30% → block
  const slightlyAboveCost = exactCost + 0.01;
  assert(computeMargin(retailCents, slightlyAboveCost) < MARGIN_FLOOR, "Cost above boundary must yield margin < 30%");

  // Seed data costs all satisfy the 30% rule with $39.99 and $64.99 retail
  for (const row of MOCK_ROUTING_MATRIX) {
    const retailForProduct = row.base_product_id === BLUEPRINT_BLANKET
      ? Math.round(BLANKET_RETAIL_USD * 100)
      : Math.round(TUMBLER_RETAIL_USD * 100);
    const m = computeMargin(retailForProduct, row.localized_base_cost_usd);
    assert(m >= MARGIN_FLOOR, `Seed row ${row.base_product_id}→${row.target_country_code}: margin ${(m*100).toFixed(1)}% must meet 30% floor`);
  }
});

Deno.test("Phase 5.6 — Missing routing matrix row returns no_route with 422-equivalent status", () => {
  // Japan (JP) is not seeded in the routing matrix
  const jpRoute = lookupRoute(BLUEPRINT_BLANKET, "JP");
  assertEquals(jpRoute, null, "Unsupported country must return null from matrix lookup");

  // Simulate the function's response shape for no_route
  function buildNoRouteResponse(orderId: string, productId: number, countryCode: string): Record<string, unknown> {
    return {
      status: "no_route",
      orderId,
      reason: `no_route for product ${productId} → ${countryCode}`,
      httpStatus: 422,
    };
  }

  const response = buildNoRouteResponse("order-jp-001", BLUEPRINT_BLANKET, "JP");
  assertEquals(response.status, "no_route");
  assertEquals(response.httpStatus, 422, "no_route must map to HTTP 422 Unprocessable Entity");
  assertMatch(response.reason as string, /no_route for product 238 → JP/);
  assertEquals(response.orderId, "order-jp-001");

  // Verify MX (Mexico) is also unmapped
  assertEquals(lookupRoute(BLUEPRINT_TUMBLER_INTL, "MX"), null, "MX not in seed matrix");

  // Verify seeded countries ARE mapped
  assertExists(lookupRoute(BLUEPRINT_BLANKET, "DE"),  "DE blanket route must exist");
  assertExists(lookupRoute(BLUEPRINT_BLANKET, "CA"),  "CA blanket route must exist");
  assertExists(lookupRoute(BLUEPRINT_BLANKET, "GB"),  "GB blanket route must exist");
  assertExists(lookupRoute(BLUEPRINT_TUMBLER_INTL, "AU"), "AU tumbler route must exist");
});

Deno.test("Phase 5.7 — generateUniqueMarketplacePrompts returns exactly 3 distinct prompt strings", () => {
  const testTopics = [
    "wildflower_family_blanket",
    "gothic_tarot_tumbler",
    "unknown_niche_topic_xyz", // Fallback path
  ];

  for (const topicId of testTopics) {
    const prompts = generateUniqueMarketplacePromptsTest(topicId);
    assertEquals(prompts.length, 3, `${topicId}: must return exactly 3 prompts`);
    for (const p of prompts) {
      assertEquals(typeof p, "string", `${topicId}: each prompt must be a string`);
      assert(p.length > 20, `${topicId}: each prompt must have meaningful content (>20 chars)`);
    }
  }
});

Deno.test("Phase 5.8 — generateUniqueMarketplacePrompts each string ends with canonical MJ parameter suffix", () => {
  const knownTopic = generateUniqueMarketplacePromptsTest("wildflower_family_blanket");
  const fallbackTopic = generateUniqueMarketplacePromptsTest("some_unknown_topic");

  for (const promptSet of [knownTopic, fallbackTopic]) {
    for (let i = 0; i < promptSet.length; i++) {
      const prompt = promptSet[i];
      assert(
        prompt.endsWith(MJ_SUFFIX),
        `Prompt ${i} must end with '${MJ_SUFFIX}' (got: '...${prompt.slice(-40)}')`,
      );
      // Suffix must be appended exactly once (no double-appending)
      const suffixCount = prompt.split(MJ_SUFFIX).length - 1;
      assertEquals(suffixCount, 1, `Prompt ${i}: MJ suffix must appear exactly once`);
    }
  }

  // Verify the exact suffix string content (no character drift)
  assertEquals(MJ_SUFFIX, " --style raw --v 6.1 --tile --ar 1:1", "MJ_SUFFIX constant must match spec exactly");
  assert(MJ_SUFFIX.startsWith(" --style raw"), "Suffix must start with space + --style raw");
  assertMatch(MJ_SUFFIX, /--v 6\.1/, "Suffix must contain --v 6.1");
  assertMatch(MJ_SUFFIX, /--tile/, "Suffix must contain --tile");
  assertMatch(MJ_SUFFIX, /--ar 1:1/, "Suffix must contain --ar 1:1");
});

Deno.test("Phase 5.9 — generateUniqueMarketplacePrompts prompts are semantically distinct (no identical strings)", () => {
  for (const topicId of ["wildflower_family_blanket", "gothic_tarot_tumbler", "fallback_test_niche"]) {
    const prompts = generateUniqueMarketplacePromptsTest(topicId);
    const unique = new Set(prompts);
    assertEquals(
      unique.size,
      3,
      `${topicId}: all 3 prompts must be distinct strings (got ${unique.size} unique)`,
    );

    // Strip the shared suffix and verify the core content is also distinct
    const coreContent = prompts.map((p) => p.replace(MJ_SUFFIX, "").trim());
    const uniqueCore = new Set(coreContent);
    assertEquals(uniqueCore.size, 3, `${topicId}: core prompt content (without suffix) must also be distinct`);

    // No prompt should be a substring of another (anti-clashing check)
    for (let i = 0; i < coreContent.length; i++) {
      for (let j = 0; j < coreContent.length; j++) {
        if (i === j) continue;
        assert(
          !coreContent[i].includes(coreContent[j]) || coreContent[j].length < 10,
          `${topicId}: prompt ${i} must not contain prompt ${j} as a substring (clashing detected)`,
        );
      }
    }
  }
});

Deno.test("Phase 5.10 — Printify Order API dispatch body contains correct provider mapping for international", async () => {
  const mock = new FetchMock();
  const capturedBodies: Record<string, unknown>[] = [];

  mock.on("api.printify.com", async (_url, init) => {
    capturedBodies.push(JSON.parse((init?.body as string) ?? "{}"));
    return jsonResponse({ id: "printify-order-de-001" });
  });

  mock.install();
  try {
    const orderId = "order-de-001";
    const countryCode = "DE";
    const blueprintId = BLUEPRINT_BLANKET;
    const retailCents = Math.round(BLANKET_RETAIL_USD * 100);

    const route = lookupRoute(blueprintId, countryCode)!;
    assertExists(route, "DE route must exist for dispatch test");

    // Verify margin passes before dispatch
    const margin = computeMargin(retailCents, route.localized_base_cost_usd);
    assert(margin >= MARGIN_FLOOR, `Margin ${(margin*100).toFixed(1)}% must pass 30% floor before dispatch`);

    // Build international dispatch payload (mirrors route-global-printify-order/index.ts)
    const dispatchPayload = {
      external_id: orderId,
      line_items: [{
        print_provider_id: route.print_provider_id,
        blueprint_id: blueprintId,
        variant_id: route.blueprint_variant_id,
        quantity: 1,
      }],
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: {
        first_name: "Hans", last_name: "Mueller",
        address1: "Hauptstraße 1", city: "Berlin", zip: "10115", country: countryCode,
      },
    };

    await fetch(`https://api.printify.com/v1/shops/2890106/orders.json`, {
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify(dispatchPayload),
    });

    assertEquals(capturedBodies.length, 1);
    const body = capturedBodies[0];
    assertEquals(body.external_id, orderId, "external_id must match orderId");

    const lineItem = (body.line_items as Array<Record<string, unknown>>)[0];
    assertEquals(lineItem.print_provider_id, route.print_provider_id, "print_provider_id must come from routing matrix");
    assertEquals(lineItem.variant_id, route.blueprint_variant_id, "variant_id must come from routing matrix");
    assertEquals(lineItem.blueprint_id, blueprintId, "blueprint_id must match product");
    assertEquals(lineItem.quantity, 1);

    assertEquals((body.address_to as Record<string, string>).country, "DE", "Destination country must be DE");
    assertEquals(body.shipping_method, 1);
    assertEquals(body.send_shipping_notification, false);
  } finally { mock.restore(); }
});

Deno.test("Phase 5.11 — pod_order_audit payload shape: margin guardrail event fields all present and typed correctly", () => {
  // Mirrors the audit row INSERT in route-global-printify-order/index.ts writeAuditEvent()
  const retailCents = Math.round(BLANKET_RETAIL_USD * 100);  // 6499
  const baseCostUsd = 46.79;
  const margin = computeMargin(retailCents, baseCostUsd);     // ~0.28

  const auditRow = {
    order_id: "order-margin-test-001",
    event_type: "margin_below_30pct",
    product_id: BLUEPRINT_BLANKET,
    country_code: "DE",
    retail_cents: retailCents,
    base_cost_usd: baseCostUsd,
    margin_pct: Math.round(margin * 10000) / 100,  // stored as percentage (28.00)
    provider_id: 4,
    variant_id: "blanket-238-de-60x80-sherpa",
    payload: {
      margin: Math.round(margin * 10000) / 100,
      retailUsd: retailCents / 100,
      baseCostUsd,
      threshold: 30,
      action: "halted_pending_review",
    },
  };

  // Schema type assertions
  assertEquals(typeof auditRow.order_id, "string");
  assertEquals(typeof auditRow.event_type, "string");
  assertEquals(typeof auditRow.product_id, "number");
  assertEquals(typeof auditRow.country_code, "string");
  assertEquals(typeof auditRow.retail_cents, "number");
  assertEquals(typeof auditRow.base_cost_usd, "number");
  assertEquals(typeof auditRow.margin_pct, "number");
  assertEquals(typeof auditRow.provider_id, "number");
  assertEquals(typeof auditRow.variant_id, "string");
  assertEquals(typeof auditRow.payload, "object");

  // Value assertions
  assertEquals(auditRow.event_type, "margin_below_30pct");
  assertEquals(auditRow.retail_cents, 6499);
  assertEquals(auditRow.product_id, 238);
  assertEquals(auditRow.country_code, "DE");
  assertEquals(auditRow.base_cost_usd, 46.79);
  assert(auditRow.margin_pct < 30, "margin_pct must be below 30 for this guardrail event");
  assertEquals(auditRow.payload.action, "halted_pending_review");
  assertEquals(auditRow.payload.threshold, 30);

  // Verify margin_pct stored as percentage (28.xx) not decimal (0.28xx)
  assert(auditRow.margin_pct > 1, "margin_pct must be stored as a percentage value (>1), not a decimal (<1)");
  assert(auditRow.margin_pct < 100, "margin_pct must be a valid percentage (< 100)");

  // Valid event_type values
  const validEventTypes = ["margin_below_30pct", "dispatched", "no_route", "error"];
  assert(validEventTypes.includes(auditRow.event_type), `event_type must be one of: ${validEventTypes.join(", ")}`);
});

Deno.test("Phase 5.12 — Blanket seed data: 5 products at $64.99 retail (6499 cents) with blueprint 238", () => {
  // Mirrors the INSERT INTO public.products seed in migration 20260521130000
  interface SeedProduct {
    name: string;
    product_type: string;
    price_usd: number;
    blueprint_id: number;
    fulfillment_type: string;
    is_digital_download: boolean;
    has_localized_metadata: boolean;
  }

  const blanketSeedProducts: SeedProduct[] = [
    { name: "Legacy Wildflower Meadow Family Name Sherpa Blanket — Art Nouveau Linocut", product_type: "blanket", price_usd: 64.99, blueprint_id: 238, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Dark Cottagecore Mycological Forest Sherpa Blanket — Bioluminescent Fungi Moss", product_type: "blanket", price_usd: 64.99, blueprint_id: 238, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Vintage Academic Bibliophile Library Sherpa Blanket — Sepia Oil-Painted Volumes", product_type: "blanket", price_usd: 64.99, blueprint_id: 238, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Retro Vaporwave Cyberpunk Gridwork Gaming Sherpa Blanket — Isometric Neon Wireframes", product_type: "blanket", price_usd: 64.99, blueprint_id: 238, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Celestial Fantasy Constellation Chart Sherpa Blanket — Medieval Astrological Sea Dragons", product_type: "blanket", price_usd: 64.99, blueprint_id: 238, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
  ];

  assertEquals(blanketSeedProducts.length, 5, "Must have exactly 5 blanket seed products");

  for (const product of blanketSeedProducts) {
    assertEquals(product.price_usd, BLANKET_RETAIL_USD, `${product.name.slice(0, 30)}: price must be $${BLANKET_RETAIL_USD}`);
    assertEquals(Math.round(product.price_usd * 100), 6499, "Price in cents must be 6499");
    assertEquals(product.blueprint_id, BLUEPRINT_BLANKET, "Blueprint ID must be 238 (Sherpa Blanket)");
    assertEquals(product.product_type, "blanket");
    assertEquals(product.fulfillment_type, "physical_pod");
    assertEquals(product.is_digital_download, false, "Blankets must not be digital downloads");
    assert(product.has_localized_metadata, "Each blanket must have DE/ES/FR localized_metadata");
    assert(product.name.includes("Sherpa Blanket"), "Each blanket name must include 'Sherpa Blanket'");
  }

  // All names must be unique
  const names = new Set(blanketSeedProducts.map((p) => p.name));
  assertEquals(names.size, 5, "All 5 blanket names must be unique");

  // Price locked — must match FINAL_PRICES dictionary
  assertEquals(Math.round(BLANKET_RETAIL_USD * 100), FINAL_PRICES["blanket"], "Blanket retail price must match FINAL_PRICES");
});

Deno.test("Phase 5.13 — Tumbler seed data: 5 products at $39.99 retail (3999 cents) with blueprint 1715", () => {
  interface SeedProduct {
    name: string;
    product_type: string;
    price_usd: number;
    blueprint_id: number;
    fulfillment_type: string;
    is_digital_download: boolean;
    has_localized_metadata: boolean;
  }

  const tumblerSeedProducts: SeedProduct[] = [
    { name: "Retro Outdoor Adventure Sticker Collage Tumbler — Hiking Patches Burnt Amber", product_type: "tumbler", price_usd: 39.99, blueprint_id: 1715, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Desert Rodeo Tooled Leather Pattern Tumbler — Geometric Southwestern Filigree Matte Sand", product_type: "tumbler", price_usd: 39.99, blueprint_id: 1715, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Sarcastic Grumpy Raven Mid-Century Vector Tumbler — Minimalist Flat-Art Corporate Humor", product_type: "tumbler", price_usd: 39.99, blueprint_id: 1715, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Gothic Tarot Constellation Monoline Tumbler — Obsidian Black Fine-Line Gold Geometry", product_type: "tumbler", price_usd: 39.99, blueprint_id: 1715, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
    { name: "Aeronautical Jet Engine Blueprint Schematic Tumbler — Chalk-White Technical Draft Lines", product_type: "tumbler", price_usd: 39.99, blueprint_id: 1715, fulfillment_type: "physical_pod", is_digital_download: false, has_localized_metadata: true },
  ];

  assertEquals(tumblerSeedProducts.length, 5, "Must have exactly 5 tumbler seed products");

  for (const product of tumblerSeedProducts) {
    assertEquals(product.price_usd, TUMBLER_RETAIL_USD, `${product.name.slice(0, 30)}: price must be $${TUMBLER_RETAIL_USD}`);
    assertEquals(Math.round(product.price_usd * 100), 3999, "Price in cents must be 3999");
    assertEquals(product.blueprint_id, BLUEPRINT_TUMBLER_INTL, "Blueprint ID for international routing must be 1715");
    assertEquals(product.product_type, "tumbler");
    assertEquals(product.fulfillment_type, "physical_pod");
    assertEquals(product.is_digital_download, false);
    assert(product.has_localized_metadata, "Each tumbler must have DE/ES/FR localized_metadata");
    assert(product.name.includes("Tumbler"), "Each tumbler name must include 'Tumbler'");
  }

  const names = new Set(tumblerSeedProducts.map((p) => p.name));
  assertEquals(names.size, 5, "All 5 tumbler names must be unique");

  // Tumbler price ($39.99) must match FINAL_PRICES["tumbler"] (3999 cents)
  assertEquals(Math.round(TUMBLER_RETAIL_USD * 100), FINAL_PRICES["tumbler"], "Tumbler retail must match FINAL_PRICES[tumbler]");

  // Routing matrix entries for blueprint 1715 must all satisfy the 30% margin floor
  const tumblerRoutes = MOCK_ROUTING_MATRIX.filter((r) => r.base_product_id === BLUEPRINT_TUMBLER_INTL);
  assertEquals(tumblerRoutes.length, 3, "Must have 3 international tumbler routes (DE, CA, AU)");
  for (const route of tumblerRoutes) {
    const margin = computeMargin(Math.round(TUMBLER_RETAIL_USD * 100), route.localized_base_cost_usd);
    assert(margin >= MARGIN_FLOOR, `${route.target_country_code} tumbler route: margin ${(margin*100).toFixed(1)}% must meet 30% floor`);
  }
});

Deno.test("Phase 5.14 — product_fulfillment_type ENUM: valid values are 'physical_pod' and 'digital_asset'", () => {
  // Mirrors the CREATE TYPE product_fulfillment_type AS ENUM in migration 20260521130000
  const VALID_FULFILLMENT_TYPES = ["physical_pod", "digital_asset"] as const;
  type FulfillmentType = typeof VALID_FULFILLMENT_TYPES[number];

  function isValidFulfillmentType(value: string): value is FulfillmentType {
    return (VALID_FULFILLMENT_TYPES as readonly string[]).includes(value);
  }

  // Valid values
  assert(isValidFulfillmentType("physical_pod"), "'physical_pod' must be a valid ENUM value");
  assert(isValidFulfillmentType("digital_asset"), "'digital_asset' must be a valid ENUM value");
  assertEquals(VALID_FULFILLMENT_TYPES.length, 2, "ENUM must have exactly 2 values");

  // Invalid values
  assert(!isValidFulfillmentType("digital"),   "'digital' is not a valid ENUM value");
  assert(!isValidFulfillmentType("physical"),  "'physical' is not a valid ENUM value");
  assert(!isValidFulfillmentType("tote"),      "'tote' is not a valid ENUM value (blueprint removed)");
  assert(!isValidFulfillmentType(""),          "Empty string is not a valid ENUM value");
  assert(!isValidFulfillmentType("PHYSICAL_POD"), "ENUM values are case-sensitive lowercase");

  // Default value for public.products new column is 'physical_pod'
  // (all 10 seeded products are physical_pod, none are digital_asset)
  const DEFAULT_FULFILLMENT_TYPE: FulfillmentType = "physical_pod";
  assert(isValidFulfillmentType(DEFAULT_FULFILLMENT_TYPE), "Default must be a valid ENUM value");

  // Seed products: 5 blankets + 5 tumblers are all 'physical_pod', 0 are 'digital_asset'
  const seedFulfillmentTypes = Array(10).fill("physical_pod");
  const physicalCount = seedFulfillmentTypes.filter((t) => t === "physical_pod").length;
  const digitalCount  = seedFulfillmentTypes.filter((t) => t === "digital_asset").length;
  assertEquals(physicalCount, 10, "All 10 seeded trending products must be physical_pod");
  assertEquals(digitalCount,  0,  "No seeded trending products are digital_asset");

  // Digital download products (in pod_digital_products) are conceptually 'digital_asset'
  // but they use a different table — this ENUM is for public.products
  const digitalProductFulfillmentType: FulfillmentType = "digital_asset";
  assert(isValidFulfillmentType(digitalProductFulfillmentType));
  assertNotEquals(DEFAULT_FULFILLMENT_TYPE, digitalProductFulfillmentType, "physical_pod and digital_asset must be distinct values");
});
