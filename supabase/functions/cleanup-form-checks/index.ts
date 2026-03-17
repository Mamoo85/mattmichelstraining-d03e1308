import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString();

    console.log(`[CLEANUP] Deleting form_checks older than ${cutoff}`);

    // List all files in the bucket
    // We need to list by folder (user_id folders)
    const { data: folders, error: listError } = await supabase.storage
      .from("form_checks")
      .list("", { limit: 1000 });

    if (listError) {
      console.error("[CLEANUP] Error listing folders:", listError.message);
      throw listError;
    }

    let deletedCount = 0;

    for (const folder of folders || []) {
      if (!folder.id) {
        // It's a folder — list its contents
        const { data: files } = await supabase.storage
          .from("form_checks")
          .list(folder.name, { limit: 1000 });

        if (!files) continue;

        const oldFiles = files.filter((f) => {
          if (!f.created_at) return false;
          return new Date(f.created_at) < thirtyDaysAgo;
        });

        if (oldFiles.length > 0) {
          const paths = oldFiles.map((f) => `${folder.name}/${f.name}`);
          const { error: deleteError } = await supabase.storage
            .from("form_checks")
            .remove(paths);

          if (deleteError) {
            console.error(`[CLEANUP] Error deleting files in ${folder.name}:`, deleteError.message);
          } else {
            deletedCount += paths.length;
            console.log(`[CLEANUP] Deleted ${paths.length} files from ${folder.name}`);
          }
        }
      } else {
        // It's a file at root level
        if (folder.created_at && new Date(folder.created_at) < thirtyDaysAgo) {
          await supabase.storage.from("form_checks").remove([folder.name]);
          deletedCount++;
        }
      }
    }

    console.log(`[CLEANUP] Total deleted: ${deletedCount}`);

    return new Response(JSON.stringify({ deleted: deletedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CLEANUP] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
