import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search coaching documents for relevant context
    const { data: docs } = await supabase.rpc("search_coaching_documents", {
      query: message,
      match_count: 5,
    });

    const context = (docs && docs.length > 0)
      ? docs.map((d: any) => `## ${d.title || "Document"}\n${d.content}`).join("\n\n---\n\n")
      : "No relevant coaching documents found.";

    // Generate AI answer
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are Coach Matt. You are an expert strength coach whose philosophy is built on Mark Rippetoe's Starting Strength — barbell-centric training, progressive overload, full range of motion, and posterior chain emphasis. Answer the athlete's question using ONLY the provided context from your coaching documents. Quote Rippetoe when relevant. If the answer is not in the documents, tell them to ask Coach Matt in person. Be direct, authoritative, and concise.

BANNED EXERCISES — Coach Matt NEVER programs these:
- Barbell Bent Over Row (any variation). Use Dumbbell Rows, Chest-Supported Rows, Cable Rows, or Seal Rows instead.
- ALL bodybuilding isolation exercises (curls, kickbacks, lateral raises, leg extensions, machine isolation, etc.). Only corrective/prehab isolation allowed.
- Stick to powerlifting compounds (Squat, Deadlift, Press, Bench, Power Clean) and functional conditioning (burpees, KB swings, sled, sprints, carries).

CONTEXT FROM COACHING DOCUMENTS:
${context}`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiRes.json();
    const aiAnswer = aiData.choices?.[0]?.message?.content || "I couldn't generate an answer. Please ask Coach Matt in person.";

    // Insert as pending draft — admin must approve before athlete sees it
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { error: insertErr } = await serviceClient.from("coach_ai_drafts").insert({
      user_id: userId,
      question: message,
      ai_answer: aiAnswer,
      status: "pending",
    });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Failed to queue answer");
    }

    // Notify admins
    const { data: admins } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const notifications = admins.map((a: any) => ({
        user_id: a.user_id,
        type: "coach_ai_draft",
        title: "New Ask Coach Question",
        body: `An athlete asked: "${message.slice(0, 80)}${message.length > 80 ? "..." : ""}"`,
        link: "/admin",
      }));
      await serviceClient.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({ queued: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
