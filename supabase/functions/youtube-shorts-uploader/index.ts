// youtube-shorts-uploader — uploads Etsy digital listings as YouTube Shorts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[YT-SHORTS] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_COMMENTS_URL = "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet";

// Niche → hashtag sets (keep consistent with youtube-shorts-now)
const NICHE_HASHTAGS: Record<string, string[]> = {
  trades:  ["#Shorts","#Trades","#Electrician","#Plumber","#CNC","#Workshop","#ShopLife","#TradesmanLife","#PrintableArt","#InstantDownload"],
  fitness: ["#Shorts","#Fitness","#HomeGym","#Powerlifting","#GymLife","#WorkoutMotivation","#GymDecor","#StrengthTraining","#PrintableArt","#InstantDownload"],
  nursery: ["#Shorts","#Nursery","#BabyRoom","#NurseryDecor","#NewParents","#BabyShower","#NurseryArt","#GenderNeutral","#PrintableArt","#InstantDownload"],
  kitchen: ["#Shorts","#Kitchen","#KitchenDecor","#FarmhouseKitchen","#Baking","#WineLovers","#KitchenArt","#HomeDecor","#PrintableArt","#InstantDownload"],
  home:    ["#Shorts","#HomeDecor","#WallArt","#PrintableArt","#InstantDownload","#HomeDesign","#InteriorDesign","#EtsyShop","#DigitalDownload","#PrintAtHome"],
  dwa:     ["#Shorts","#DetroitBusiness","#SmallBusiness","#WebDesign","#LocalSEO","#ContractorMarketing","#DetroitWebAgency","#LeadGeneration","#DigitalMarketing","#BusinessWebsite"],
};

function detectNiche(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("trade") || s.includes("electr") || s.includes("plumb") || s.includes("cnc") || s.includes("machine")) return "trades";
  if (s.includes("fit") || s.includes("gym") || s.includes("workout") || s.includes("squat") || s.includes("muscle")) return "fitness";
  if (s.includes("nurs") || s.includes("baby") || s.includes("parent") || s.includes("safari")) return "nursery";
  if (s.includes("kitchen") || s.includes("bak") || s.includes("wine") || s.includes("cook")) return "kitchen";
  if (s.includes("dwa") || s.includes("detroit") || s.includes("contractor") || s.includes("dentist") || s.includes("restaurant")) return "dwa";
  return "home";
}

async function postComment(videoId: string, text: string, accessToken: string): Promise<void> {
  const res = await fetch(YOUTUBE_COMMENTS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      snippet: {
        videoId,
        topLevelComment: { snippet: { textOriginal: text } },
      },
    }),
  });
  if (!res.ok) {
    log("Comment post failed (non-fatal)", { status: res.status });
    return;
  }
  log("Comment posted", { videoId });
}

function buildDescription(title: string, niche: string, amazonTag: string | null): string {
  const tags = (NICHE_HASHTAGS[niche] ?? NICHE_HASHTAGS.home).join(" ");
  const isDwa = niche === "dwa";
  const lines = [
    title,
    "",
    isDwa ? "🏢 Detroit Web Agency — websites that generate leads" : "✅ Instant digital download — print at home!",
    isDwa ? "📞 Free consultation → detroitwebagency.com"       : "🖼️ 3 print-ready files included",
    isDwa ? "🛒 detroitwebagency.com"                            : "💸 Only $4.99 — shop link in bio",
    isDwa ? ""                                                   : "🛒 mattmichelstraining.com/gifts",
  ];
  if (!isDwa && amazonTag) {
    const kw = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ +/g, "+").slice(0, 60);
    lines.push("", `🔗 Shop related: https://www.amazon.com/s?k=${kw}&tag=${amazonTag}`);
  }
  lines.push("", tags);
  return lines.join("\n");
}

function buildCta(title: string, niche: string): string {
  if (niche === "dwa") return "We build these for Detroit businesses — free quote → link in bio";
  if (niche === "trades") return "Every shop needs this on the wall — I made it printable → link in bio";
  if (niche === "fitness") return "This is on my gym wall — printable version in bio";
  if (niche === "nursery") return "Made these for our nursery — all prints available → bio link";
  if (niche === "kitchen") return "This hangs in my kitchen — $4.99 instant download → bio";
  return "I put this in the shop — link in my bio if you want it 🖨️";
}

async function refreshYouTubeToken(
  sb: ReturnType<typeof createClient>,
  tokenRow: Record<string, string>,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokenRow.access_token;

  log("Token expiring — refreshing");
  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`YouTube token refresh failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await sb.from("youtube_oauth_tokens").update({
    access_token: data.access_token,
    expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }).eq("channel_id", tokenRow.channel_id);

  log("Token refreshed");
  return data.access_token;
}

function buildMp4(frames: Uint8Array[], secsPerFrame = 5): Uint8Array {
  const W = 1024, H = 1024;
  const TIMESCALE = 1000;
  const FRAME_DUR = secsPerFrame * TIMESCALE;
  const TOTAL_DUR = frames.length * FRAME_DUR;

  const u16 = (n: number) => new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
  const u32 = (n: number) => new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
  const cc  = (s: string) => new TextEncoder().encode(s.slice(0, 4).padEnd(4, " "));
  const z   = (n: number) => new Uint8Array(n);

  const cat = (...a: Uint8Array[]): Uint8Array => {
    const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
    let i = 0; for (const x of a) { out.set(x, i); i += x.length; } return out;
  };
  const bx = (type: string, ...data: Uint8Array[]): Uint8Array => {
    const p = cat(...data);
    return cat(u32(8 + p.length), cc(type), p);
  };
  const fb = (type: string, ver: number, flags: number, ...data: Uint8Array[]): Uint8Array =>
    bx(type, new Uint8Array([ver, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff]), ...data);

  const ftyp = bx("ftyp", cc("mp42"), u32(0), cc("mp42"), cc("isom"));
  const mdat = bx("mdat", ...frames);
  const firstSampleOffset = ftyp.length + 8;
  const chunkOffsets: number[] = [];
  let runOff = firstSampleOffset;
  for (const f of frames) { chunkOffsets.push(runOff); runOff += f.length; }

  const sdEntry = bx("jpeg",
    z(6), u16(1), z(16),
    u16(W), u16(H),
    u32(0x00480000), u32(0x00480000),
    u32(0), u16(1),
    z(32),
    u16(24), u16(0xffff),
  );
  const stsd = fb("stsd", 0, 0, u32(1), sdEntry);
  const stts = fb("stts", 0, 0, u32(1), u32(frames.length), u32(FRAME_DUR));
  const stsc = fb("stsc", 0, 0, u32(1), u32(1), u32(1), u32(1));
  const stsz = fb("stsz", 0, 0, u32(0), u32(frames.length), ...frames.map(f => u32(f.length)));
  const stco = fb("stco", 0, 0, u32(chunkOffsets.length), ...chunkOffsets.map(o => u32(o)));
  const stbl = bx("stbl", stsd, stts, stsc, stsz, stco);
  const vmhd = fb("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0));
  const url_ = fb("url ", 0, 1);
  const dinf = bx("dinf", fb("dref", 0, 0, u32(1), url_));
  const minf = bx("minf", vmhd, dinf, stbl);
  const mdhd = fb("mdhd", 0, 0, u32(0), u32(0), u32(TIMESCALE), u32(TOTAL_DUR), u16(0x55c4), u16(0));
  const hdlr = fb("hdlr", 0, 0, u32(0), cc("vide"), z(12), new TextEncoder().encode("VideoHandler\0"));
  const mdia = bx("mdia", mdhd, hdlr, minf);
  const tkhd = fb("tkhd", 0, 3,
    u32(0), u32(0), u32(1), z(4), u32(TOTAL_DUR), z(8),
    u16(0), u16(0), u16(0), u16(0),
    u32(0x00010000), u32(0), u32(0),
    u32(0), u32(0x00010000), u32(0),
    u32(0), u32(0), u32(0x40000000),
    u32(W << 16), u32(H << 16),
  );
  const trak = bx("trak", tkhd, mdia);
  const mvhd = fb("mvhd", 0, 0,
    u32(0), u32(0), u32(TIMESCALE), u32(TOTAL_DUR),
    u32(0x00010000), u16(0x0100), z(10),
    u32(0x00010000), u32(0), u32(0),
    u32(0), u32(0x00010000), u32(0),
    u32(0), u32(0), u32(0x40000000),
    z(24), u32(2),
  );
  return cat(ftyp, mdat, bx("moov", mvhd, trak));
}

function createSlideshowVideo(images: string[]): Uint8Array {
  const frames = images.map(b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  return buildMp4(frames, 5);
}

async function uploadToYouTube(
  videoBytes: Uint8Array,
  title: string,
  description: string,
  tags: string[],
  accessToken: string
): Promise<string> {
  // Step 1: Initiate resumable upload
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description,
      tags: tags.slice(0, 500),
      categoryId: "26", // Howto & Style
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBytes.length),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text().catch(() => "");
    throw new Error(`YouTube upload init ${initRes.status}: ${err.slice(0, 300)}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No upload URL in YouTube response");

  // Step 2: Upload video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBytes.length),
    },
    body: videoBytes,
    signal: AbortSignal.timeout(120_000),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => "");
    throw new Error(`YouTube upload ${uploadRes.status}: ${err.slice(0, 300)}`);
  }

  const result = await uploadRes.json();
  return result.id as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
  const CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const AMAZON_TAG = Deno.env.get("AMAZON_ASSOCIATES_TAG") ?? null;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: "YOUTUBE_CLIENT_ID/SECRET not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Load all authorized YouTube channels
  const { data: tokenRows, error: tokenErr } = await sb
    .from("youtube_oauth_tokens")
    .select("*")
    .order("updated_at", { ascending: true });

  if (tokenErr || !tokenRows || tokenRows.length === 0) {
    return new Response(
      JSON.stringify({ error: "No YouTube OAuth tokens — visit /youtube-oauth-start to authorize" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load today's Etsy digital listings
  const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(); // last 26h
  const { data: listings } = await sb
    .from("etsy_digital_listings")
    .select("*")
    .gte("created_at", since)
    .eq("status", "active")
    .limit(3);

  if (!listings || listings.length === 0) {
    return new Response(
      JSON.stringify({ message: "No new listings in the last 26h — nothing to upload" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load images from Supabase Storage
  const uploaded: string[] = [];
  const errors: string[] = [];

  for (const listing of listings) {
    try {
      log("Processing listing", { id: listing.etsy_listing_id, title: listing.title?.slice(0, 50) });

      // Download stored images from Supabase Storage
      const imageB64s: string[] = [];
      for (let v = 1; v <= 3; v++) {
        const path = `etsy-product-images/${listing.etsy_listing_id}/v${v}.png`;
        const { data: imgData, error: imgErr } = await sb.storage
          .from("etsy-product-images")
          .download(path);

        if (imgErr || !imgData) {
          log(`Image v${v} not found in storage`, { path });
          continue;
        }

        const arrBuf = await imgData.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(arrBuf)));
        imageB64s.push(b64);
      }

      if (imageB64s.length === 0) {
        throw new Error("No images found in Supabase Storage for this listing");
      }

      log("Building video", { frames: imageB64s.length * 5 });
      const videoBytes = createSlideshowVideo(imageB64s);

      const rawNiche = listing.niche ?? listing.title ?? "home";
      const niche = detectNiche(rawNiche);
      const listingTitle = listing.title ?? "Printable Wall Art";
      const shortTitle = `${listingTitle.slice(0, 60)} #Shorts`;
      const description = buildDescription(listingTitle, niche, AMAZON_TAG);
      const cta = buildCta(listingTitle, niche);
      const tags = [
        "etsy", "printable art", "wall art", "instant download", "digital download",
        "home decor", "gift idea", niche, "etsy shop", "digital art", "shorts",
      ].filter(Boolean);

      // Upload the same video to every authorized channel
      for (const tokenRow of tokenRows) {
        try {
          const accessToken = await refreshYouTubeToken(sb, tokenRow, CLIENT_ID, CLIENT_SECRET);
          log("Uploading to channel", { channel: tokenRow.channel_title, bytes: videoBytes.length });
          const videoId = await uploadToYouTube(videoBytes, shortTitle, description, tags, accessToken);
          log("Uploaded", { videoId, channel: tokenRow.channel_title });
          await postComment(videoId, cta, accessToken);
          await sb.from("youtube_shorts").insert({
            etsy_listing_id: listing.etsy_listing_id,
            youtube_video_id: videoId,
            title: shortTitle,
            status: "published",
          });
          uploaded.push(`https://www.youtube.com/shorts/${videoId}`);
        } catch (chErr) {
          log("Channel upload failed (non-fatal)", { channel: tokenRow.channel_title, err: String(chErr) });
        }
      }
    } catch (err) {
      const msg = String(err);
      log("Error", { listing: listing.etsy_listing_id, error: msg });
      errors.push(msg);
    }
  }

  log("Run complete", { uploaded: uploaded.length, errors: errors.length });
  return new Response(
    JSON.stringify({ uploaded: uploaded.length, urls: uploaded, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
