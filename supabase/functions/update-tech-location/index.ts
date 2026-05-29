// update-tech-location — POST { token, lat, lng }
// Called by the FieldDesk tech app to push GPS position into tech_locations.
// Requires a valid tech_session token (issued by tech-session-create).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { makeServiceClient, validateTechSession } from "../_shared/tech-session.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const { token, lat, lng } = body;

    if (!token || lat == null || lng == null) {
      return new Response(JSON.stringify({ error: "token, lat, and lng are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = makeServiceClient();
    const session = await validateTechSession(sb, token);
    if (!session) {
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) ||
        latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return new Response(JSON.stringify({ error: "invalid coordinates" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { error } = await sb
      .from("tech_locations")
      .upsert(
        { tech_id: session.tech_id, lat: latNum, lng: lngNum, updated_at: new Date().toISOString() },
        { onConflict: "tech_id" }
      );

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[update-tech-location]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
