import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REMOTE_CONTROL_SECRET = Deno.env.get("REMOTE_CONTROL_SECRET") ?? "";

function addFrequency(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  switch (frequency) {
    case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
    case "quarterly": d.setUTCMonth(d.getUTCMonth() + 3); break;
    case "biannual": d.setUTCMonth(d.getUTCMonth() + 6); break;
    case "annual": d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    default: d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}

async function processContract(
  supabase: any,
  contract: Record<string, unknown>
): Promise<{ id: string; title: string }> {
  const { error: jobError } = await supabase.from("field_service_jobs").insert({
    client_id: contract.client_id,
    customer_id: contract.customer_id ?? null,
    asset_id: contract.asset_id ?? null,
    assigned_tech_id: contract.assigned_tech_id ?? null,
    title: contract.title as string,
    description: (contract.description as string | null) ?? null,
    status: contract.assigned_tech_id ? "assigned" : "open",
    priority: "normal",
    scheduled_date: contract.next_due_date as string,
    estimated_duration_minutes: 120,
  });

  if (jobError) {
    throw new Error(`Failed to create job for contract ${contract.id}: ${jobError.message}`);
  }

  const nextDue = addFrequency(contract.next_due_date as string, contract.frequency as string);

  const { error: updateError } = await supabase
    .from("field_service_contracts")
    .update({ next_due_date: nextDue })
    .eq("id", contract.id as string);

  if (updateError) {
    throw new Error(`Failed to advance contract ${contract.id}: ${updateError.message}`);
  }

  return { id: contract.id as string, title: contract.title as string };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  const isCron = !authHeader;
  const isAuthorized = isCron || token === REMOTE_CONTROL_SECRET;

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body = run all */ }

    const contractId = body?.contract_id as string | undefined;
    
    // Hardened: create jobs 7 days before due date (proactive scheduling)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);
    const lookAheadDate = sevenDaysFromNow.toISOString().split("T")[0];

    let contracts: Record<string, unknown>[] = [];

    if (contractId) {
      const { data, error } = await supabase
        .from("field_service_contracts")
        .select("*")
        .eq("id", contractId)
        .single();
      if (error) throw new Error(`Contract not found: ${error.message}`);
      contracts = [data];
    } else {
      // Fetch contracts due within the next 7 days (proactive)
      const { data, error } = await supabase
        .from("field_service_contracts")
        .select("*")
        .eq("active", true)
        .lte("next_due_date", lookAheadDate);
      if (error) throw new Error(`Query failed: ${error.message}`);
      contracts = data ?? [];
    }

    // Deduplicate: don't create a job if one already exists for this contract's due date
    const filteredContracts: Record<string, unknown>[] = [];
    for (const contract of contracts) {
      const { count } = await supabase
        .from("field_service_jobs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", contract.client_id)
        .eq("scheduled_date", contract.next_due_date)
        .ilike("title", contract.title as string);

      if (!count || count === 0) {
        filteredContracts.push(contract);
      }
    }

    const results: { id: string; title: string }[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const contract of filteredContracts) {
      try {
        const result = await processContract(supabase, contract);
        results.push(result);
      } catch (err) {
        errors.push({ id: contract.id as string, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        created: results.length,
        contracts: results,
        skipped_duplicates: contracts.length - filteredContracts.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("field-service-contract-scheduler error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
