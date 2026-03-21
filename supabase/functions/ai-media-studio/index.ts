import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) throw new Error("No auth token");

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) throw new Error("Admin only");

    const { sourceUrls, prompt, parameters, jobId } = await req.json();

    // Update job status to processing
    if (jobId) {
      await supabase.from("ai_media_jobs").update({ status: "processing" }).eq("id", jobId);
    }

    // Build message content with images
    const content: any[] = [
      { type: "text", text: prompt || "Create a professional, branded promotional image using these photos. Make it visually stunning and ready for social media." }
    ];

    for (const url of (sourceUrls || [])) {
      content.push({ type: "image_url", image_url: { url } });
    }

    // Determine aspect ratio for the prompt
    const aspectRatio = parameters?.aspectRatio || "1:1";
    const style = parameters?.style || "bold/energetic";
    const outputType = parameters?.outputType || "social post";
    const textOverlay = parameters?.textOverlay || "";

    const systemPrompt = `You are a professional graphic designer for M2 Performance Training, a strength & conditioning brand. 
Style direction: ${style}. 
Output type: ${outputType}. 
Aspect ratio: ${aspectRatio}.
${textOverlay ? `Include this text overlay: "${textOverlay}"` : ""}
Brand colors: dark backgrounds with electric cyan/teal accents (#00F0FF), white text.
Create ultra-professional, gym/athletic branded content. Make it look like it was made by a top-tier design agency.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);

      if (jobId) {
        await supabase.from("ai_media_jobs").update({
          status: "failed",
          error_message: status === 429 ? "Rate limited — try again in a minute" : status === 402 ? "Credits exhausted" : `AI error: ${status}`,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      }

      return new Response(JSON.stringify({
        error: status === 429 ? "Rate limited, try again shortly" : status === 402 ? "Credits exhausted" : "AI generation failed"
      }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const generatedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      if (jobId) {
        await supabase.from("ai_media_jobs").update({
          status: "failed",
          error_message: "No image returned from AI",
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Decode base64 and upload to storage
    const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const fileName = `generated_${Date.now()}.png`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("ai_generated_media")
      .upload(filePath, binaryData, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to save generated image");
    }

    const { data: publicUrl } = supabase.storage
      .from("ai_generated_media")
      .getPublicUrl(filePath);

    // Update job
    if (jobId) {
      await supabase.from("ai_media_jobs").update({
        status: "completed",
        result_path: filePath,
        result_url: publicUrl.publicUrl,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    return new Response(JSON.stringify({
      success: true,
      resultUrl: publicUrl.publicUrl,
      filePath,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("ai-media-studio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
