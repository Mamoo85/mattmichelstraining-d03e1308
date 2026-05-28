const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const KALSHI_BASE = "https://api.elections.kalshi.com";
const MIN_VOLUME=2000, MIN_EDGE=0.08, MAX_DOLLARS=50, MAX_BALANCE_PCT=0.12, KELLY_FRACTION=0.25;
const MIN_DAYS_CLOSE=3, MAX_DAYS_CLOSE=45, MAX_SCAN=25, MAX_GPT_EVAL=10;
const TAKE_PROFIT_CENTS=25, STOP_LOSS_CENTS=30, EXIT_HOURS=24, BALANCE_FLOOR=2000;

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  let keyBuffer: ArrayBuffer;
  if (pem.includes("-----BEGIN PRIVATE KEY-----")) {
    keyBuffer = der.buffer;
  } else {
    const octetLen = der.length;
    const innerLen = 2+1+2+13+2+2+octetLen;
    const pkcs8 = new Uint8Array(4+innerLen);
    let off=0;
    pkcs8[off++]=0x30; pkcs8[off++]=0x82; pkcs8[off++]=(innerLen>>8)&0xFF; pkcs8[off++]=innerLen&0xFF;
    pkcs8[off++]=0x02; pkcs8[off++]=0x01; pkcs8[off++]=0x00; pkcs8[off++]=0x30; pkcs8[off++]=0x0D;
    pkcs8[off++]=0x06; pkcs8[off++]=0x09;
    pkcs8.set([0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x01,0x01],off); off+=9;
    pkcs8[off++]=0x05; pkcs8[off++]=0x00; pkcs8[off++]=0x04; pkcs8[off++]=0x82;
    pkcs8[off++]=(octetLen>>8)&0xFF; pkcs8[off++]=octetLen&0xFF;
    pkcs8.set(der, off);
    keyBuffer = pkcs8.buffer;
  }
  return await crypto.subtle.importKey("pkcs8", keyBuffer, { name:"RSA-PSS", hash:"SHA-256" }, false, ["sign"]);
}

async function kalshiGet(pem: string, keyId: string, path: string): Promise<unknown> {
  const ts = Date.now().toString();
  const key = await importPrivateKey(pem);
  const sigBytes = await crypto.subtle.sign({ name:"RSA-PSS", saltLength:32 }, key, new TextEncoder().encode(ts+"GET"+path));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  const res = await fetch(`${KALSHI_BASE}${path}`, { headers: { "KALSHI-ACCESS-KEY":keyId, "KALSHI-ACCESS-TIMESTAMP":ts, "KALSHI-ACCESS-SIGNATURE":sig, "Content-Type":"application/json" } });
  if (!res.ok) throw new Error(`Kalshi GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function callTrader(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/kalshi-trader`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`kalshi-trader ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function estimateProb(title: string, closeTime: string, anthropicKey: string): Promise<{ probability: number; confidence: string; reasoning: string }> {
  const today = new Date().toISOString().split("T")[0];
  const closeDate = closeTime?.split("T")[0] ?? "unknown";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 120,
      messages: [{ role: "user", content: `Today is ${today}. A Kalshi prediction market closes on ${closeDate}.\n\nMarket: "${title}"\n\nWhat is the probability (0.00–1.00) this resolves YES? Use current events, trends, and base rates.\n\nReply ONLY with valid JSON: {"probability":0.XX,"confidence":"low|medium|high","reasoning":"one sentence"}` }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const content = data.content?.[0]?.text ?? "{}";
  try {
    const p = JSON.parse(content.trim());
    return { probability: Math.max(0.02, Math.min(0.98, Number(p.probability)||0.5)), confidence: p.confidence??"low", reasoning: p.reasoning??"" };
  } catch { return { probability: 0.5, confidence: "low", reasoning: "parse error" }; }
}

function kellyContracts(ourProb: number, priceCents: number, balanceCents: number): number {
  const b = (100-priceCents)/priceCents;
  const f = (b*ourProb-(1-ourProb))/b;
  if (f<=0) return 0;
  const dollarBet = Math.min(balanceCents*Math.min(f*KELLY_FRACTION, MAX_BALANCE_PCT), MAX_DOLLARS*100);
  return Math.max(1, Math.floor(dollarBet/priceCents));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const keyPem       = Deno.env.get("KALSHI_PRIVATE_KEY_PEM") ?? Deno.env.get("KALSHI_RSA_PRIVATE_KEY") ?? "";
  const keyId        = Deno.env.get("KALSHI_API_KEY_ID") ?? Deno.env.get("KALSHI_KEY_ID") ?? "4661674e-a384-4af9-a3ca-6a8c6af836a9";
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  if (!keyPem) return Response.json({ error: "No Kalshi private key" }, { status: 500, headers: CORS });

  let dryRun = false;
  try { const b = await req.json(); dryRun = b.dryRun === true; } catch {}
  const log: string[] = [];
  const decisions: unknown[] = [];

  try {
    const status: any = await callTrader({ action: "STATUS" });
    const balanceCents: number = status.balance_cents ?? 0;
    const openPositions: any[] = status.positions ?? [];
    log.push(`Balance: $${(balanceCents/100).toFixed(2)} | Positions: ${openPositions.length}`);

    if (balanceCents < BALANCE_FLOOR) {
      if (!dryRun) await callTrader({ action: "HALT", reason: "Balance floor hit" });
      return Response.json({ halted: true, log }, { headers: CORS });
    }

    for (const pos of openPositions) {
      try {
        const mktData: any = await kalshiGet(keyPem, keyId, `/trade-api/v2/markets/${pos.ticker}`);
        const mkt = mktData.market ?? mktData;
        const hoursToClose = (new Date(mkt.close_time ?? mkt.expiration_time ?? 0).getTime() - Date.now()) / 3_600_000;
        const currentBid = pos.side==="yes" ? (mkt.yes_bid??0) : (mkt.no_bid??0);
        const profit = currentBid - (pos.avg_price_cents??50);
        const reason = profit>=TAKE_PROFIT_CENTS ? `take-profit +${profit}¢` : profit<=-STOP_LOSS_CENTS ? `stop-loss ${profit}¢` : hoursToClose<EXIT_HOURS ? `expiry in ${hoursToClose.toFixed(0)}h` : null;
        if (reason) {
          log.push(`EXIT ${pos.ticker}: ${reason}`);
          if (!dryRun) await callTrader({ action: pos.side==="yes"?"SELL_YES":"SELL_NO", ticker: pos.ticker, contracts: pos.contracts_count??1, price_cents: Math.max(1,currentBid-1), reason, event_title: pos.event_title });
          decisions.push({ type:"exit", ticker:pos.ticker, reason, dry:dryRun });
        }
      } catch(e) { log.push(`Exit check error for ${pos.ticker}: ${e}`); }
    }

    const nowMs = Date.now();
    const openSet = new Set(openPositions.map((p:any)=>p.ticker));
    const marketsData: any = await kalshiGet(keyPem, keyId, `/trade-api/v2/markets?limit=${MAX_SCAN}&status=open`);
    const candidates = (marketsData.markets??[])
      .filter((m:any)=>{ const t=new Date(m.close_time??m.expiration_time??"").getTime(); return t>nowMs+MIN_DAYS_CLOSE*86400000 && t<nowMs+MAX_DAYS_CLOSE*86400000 && (m.volume??0)>=MIN_VOLUME; })
      .filter((m:any)=>!openSet.has(m.ticker))
      .sort((a:any,b:any)=>(b.volume??0)-(a.volume??0))
      .slice(0, MAX_GPT_EVAL);

    log.push(`Candidates: ${candidates.length}/${(marketsData.markets??[]).length}`);

    for (const mkt of candidates) {
      try {
        const mid = ((mkt.yes_bid??0)+(mkt.yes_ask??0))/2;
        if (mid<3||mid>97) continue;
        const { probability, confidence, reasoning } = await estimateProb(mkt.title??mkt.subtitle??mkt.ticker, mkt.close_time??mkt.expiration_time??"", anthropicKey);
        const isBuyYes = probability > mid/100;
        const edge = Math.abs(probability - mid/100);
        const priceCents = Math.round(isBuyYes ? (mkt.yes_ask??mid) : (mkt.no_ask??(100-mid)));
        log.push(`${mkt.ticker}: mid=${mid.toFixed(0)}¢ claude=${(probability*100).toFixed(0)}% edge=${(edge*100).toFixed(1)}% conf=${confidence}`);
        if (edge>=MIN_EDGE && confidence!=="low") {
          const contracts = kellyContracts(isBuyYes?probability:1-probability, priceCents, balanceCents);
          if (contracts>0) {
            const action = isBuyYes?"BUY_YES":"BUY_NO";
            log.push(`→ TRADE: ${action} ${contracts}x @${priceCents}¢ | ${reasoning}`);
            if (!dryRun) await callTrader({ action, ticker:mkt.ticker, contracts, price_cents:priceCents, reason:`Edge ${(edge*100).toFixed(1)}%: ${reasoning}`, implied_prob:mid/100, edge, kelly_fraction:(contracts*priceCents)/balanceCents, event_title:mkt.title });
            decisions.push({ type:"entry", action, ticker:mkt.ticker, contracts, priceCents, edge, confidence, dry:dryRun });
          }
        }
      } catch(e) { log.push(`Eval error for ${mkt.ticker}: ${e}`); }
    }

    return Response.json({ dryRun, balance_dollars:(balanceCents/100).toFixed(2), candidates_scanned:candidates.length, decisions_made:decisions.length, decisions, log }, { headers:CORS });
  } catch(err) {
    return new Response(JSON.stringify({ error:String(err), log }), { status:500, headers:{...CORS,"Content-Type":"application/json"} });
  }
});
