import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { wrapServe } from "../_shared/telemetry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const DAILY_TARGET = 500;

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const CITIES = ["Detroit MI","Warren MI","Sterling Heights MI","Livonia MI","Dearborn MI","Troy MI","Southfield MI","Royal Oak MI","Farmington Hills MI","Ann Arbor MI","Pontiac MI","Macomb MI","Shelby Township MI","Taylor MI","Westland MI"];

const QUERIES = [
  {q:"hair salon",industry:"hair salon"},{q:"barbershop",industry:"barber"},{q:"nail salon",industry:"nail salon"},{q:"day spa",industry:"spa"},
  {q:"dental office",industry:"dental"},{q:"dentist",industry:"dentist"},{q:"auto repair shop",industry:"auto repair"},{q:"auto body shop",industry:"auto body"},
  {q:"veterinary clinic",industry:"veterinary"},{q:"animal hospital",industry:"veterinary"},{q:"physical therapy clinic",industry:"physical therapy"},
  {q:"chiropractic office",industry:"chiropractic"},{q:"restaurant",industry:"restaurant"},{q:"bar and grill",industry:"restaurant"},
  {q:"roofing contractor",industry:"roofing"},{q:"HVAC company",industry:"hvac"},{q:"plumbing company",industry:"plumbing"},
  {q:"electrical contractor",industry:"electrical"},{q:"pest control",industry:"pest control"},{q:"gutter installation",industry:"gutters"},
  {q:"foundation repair",industry:"foundation"},{q:"junk removal",industry:"junk removal"},{q:"tree service",industry:"tree"},
  {q:"water damage restoration",industry:"water damage restoration"},{q:"general contractor",industry:"general contractor"},
  {q:"landscaping company",industry:"landscaping"},{q:"property management company",industry:"property management"},
];

interface ProspectRow { business_name:string; city:string|null; industry:string|null; phone:string|null; website:string|null; email:string|null; source:string; score:number; drip_campaign_status:Record<string,string>; }

function scoreRow(r:ProspectRow):number { let s=1; if(r.phone)s+=2; if(r.website)s+=2; if(r.email)s+=3; if(r.city)s+=1; return Math.min(s,9); }

async function scanGoogleMaps(query:string,city:string,industry:string):Promise<ProspectRow[]> {
  if(!GOOGLE_MAPS_API_KEY)return [];
  const results:ProspectRow[]=[];
  try {
    const res=await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} ${city}`)}&key=${GOOGLE_MAPS_API_KEY}`,{signal:AbortSignal.timeout(10_000)});
    if(!res.ok)return [];
    const data=await res.json();
    for(const place of (data.results||[]).slice(0,20)) {
      if(!place.name)continue;
      let phone:string|null=null,website:string|null=null;
      if(place.place_id){try{const dr=await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_MAPS_API_KEY}`,{signal:AbortSignal.timeout(8_000)});if(dr.ok){const dd=await dr.json();phone=dd.result?.formatted_phone_number||null;website=dd.result?.website||null;}}catch(_){}}
      const row:ProspectRow={business_name:place.name,city:city.split(" ")[0],industry,phone:phone?.replace(/\D/g,"").replace(/^1/,"")||null,website:website?website.replace(/\/$/,""):null,email:null,source:"google_maps",score:0,drip_campaign_status:{current_stage:"0_New_Extracted_Lead"}};
      row.score=scoreRow(row);results.push(row);
    }
  }catch(e){console.warn(`[replenisher] maps ${query} ${city}:`,e instanceof Error?e.message:e);}
  return results;
}

async function scanBSEEDContractors():Promise<ProspectRow[]> {
  const results:ProspectRow[]=[];
  try {
    const res=await fetch("https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Business_Certification_Register/FeatureServer/0/query?where=1%3D1&outFields=BUSINESS_NAME,CONTACT_NAME,PHONE,EMAIL,NIGP_CATEGORY&f=json&resultRecordCount=305",{signal:AbortSignal.timeout(15_000)});
    if(!res.ok)return [];
    const data=await res.json();
    for(const feat of (data.features||[])){const a=feat.attributes||{};const name=(a.BUSINESS_NAME||"").trim();if(!name)continue;const nigp=(a.NIGP_CATEGORY||"").toLowerCase();let industry="contractor";if(nigp.includes("91"))industry="hvac";else if(nigp.includes("92"))industry="plumbing";else if(nigp.includes("76"))industry="electrical";const row:ProspectRow={business_name:name,city:"Detroit",industry,phone:(a.PHONE||"").replace(/\D/g,"").slice(-10)||null,website:null,email:(a.EMAIL||"").toLowerCase()||null,source:"bseed_contractors",score:0,drip_campaign_status:{current_stage:"0_New_Extracted_Lead"}};row.score=scoreRow(row);results.push(row);}
  }catch(e){console.warn("[replenisher] bseed:",e instanceof Error?e.message:e);}
  return results;
}

async function scanSAMEntities():Promise<ProspectRow[]> {
  const results:ProspectRow[]=[];
  try {
    const res=await fetch("https://api.sam.gov/entity-information/v3/entities?registrationStatus=A&stateOrProvinceOfIncorporation=MI&purposeOfRegistrationCode=Z2&entityStructureCode=2L&samExtractCode=E&size=100&api_key=DEMO_KEY",{headers:{"User-Agent":"DWA-ProspectReplenisher/1.0 matt@detroitwebagent.com"},signal:AbortSignal.timeout(12_000)});
    if(!res.ok)return [];
    const data=await res.json();
    for(const entity of (data.entityData||[])){const legal=entity.entityRegistration?.legalBusinessName||"";if(!legal)continue;const naics=(entity.assertions?.goodsAndServices?.primaryNaics||"").toString();let industry="general contractor";if(naics.startsWith("238"))industry=naics.startsWith("2382")?"hvac":naics.startsWith("2383")?"electrical":naics.startsWith("2381")?"roofing":"general contractor";else if(naics.startsWith("2389"))industry="plumbing";const addr=entity.coreData?.physicalAddress;const row:ProspectRow={business_name:legal,city:addr?.city||null,industry,phone:null,website:entity.coreData?.electronicBusinessPOC?.electronicBusinessPOCList?.[0]?.website||null,email:entity.coreData?.electronicBusinessPOC?.electronicBusinessPOCList?.[0]?.email?.toLowerCase()||null,source:"sam_gov",score:0,drip_campaign_status:{current_stage:"0_New_Extracted_Lead"}};row.score=scoreRow(row);results.push(row);}
  }catch(e){console.warn("[replenisher] sam.gov:",e instanceof Error?e.message:e);}
  return results;
}

serve(wrapServe("outreach-prospect-replenisher",async(_req)=>{
  const sb=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY);
  const startedAt=Date.now();let inserted=0,skipped=0;
  const {data:existing}=await sb.from("outreach_leads").select("business_name,city,email").gte("created_at",new Date(Date.now()-90*86400000).toISOString());
  const existingKeys=new Set<string>();
  for(const row of (existing||[])){if(row.email)existingKeys.add(row.email.toLowerCase());if(row.business_name&&row.city)existingKeys.add(`${row.business_name.toLowerCase()}|${(row.city||"").toLowerCase()}`);}
  const allProspects:ProspectRow[]=[];
  allProspects.push(...await scanBSEEDContractors());
  allProspects.push(...await scanSAMEntities());
  const dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0).getTime())/86400000);
  const queriesThisRun=[...QUERIES.slice(dayOfYear%QUERIES.length),...QUERIES.slice(0,dayOfYear%QUERIES.length)].slice(0,15);
  const citiesThisRun=[...CITIES.slice(dayOfYear%CITIES.length),...CITIES.slice(0,dayOfYear%CITIES.length)].slice(0,5);
  for(const {q,industry} of queriesThisRun){if(allProspects.length>=DAILY_TARGET*2)break;allProspects.push(...await scanGoogleMaps(q,citiesThisRun[Math.floor(Math.random()*citiesThisRun.length)],industry));await new Promise(r=>setTimeout(r,300));}
  for(const prospect of allProspects){
    if(inserted>=DAILY_TARGET)break;
    const emailKey=prospect.email?.toLowerCase();const bizKey=`${prospect.business_name.toLowerCase()}|${(prospect.city||"").toLowerCase()}`;
    if((emailKey&&existingKeys.has(emailKey))||existingKeys.has(bizKey)){skipped++;continue;}
    const {error}=await sb.from("outreach_leads").insert({business_name:prospect.business_name,city:prospect.city,industry:prospect.industry,phone:prospect.phone,website:prospect.website,email:prospect.email,source:prospect.source,score:prospect.score,drip_campaign_status:prospect.drip_campaign_status});
    if(!error){inserted++;if(emailKey)existingKeys.add(emailKey);existingKeys.add(bizKey);}
  }
  await sb.from("agent_heartbeats").upsert({agent_name:"outreach-prospect-replenisher",last_beat:new Date().toISOString(),status:"ok",metadata:{inserted,skipped,total_scanned:allProspects.length,duration_ms:Date.now()-startedAt}},{onConflict:"agent_name"});
  return new Response(JSON.stringify({ok:true,inserted,skipped,total_scanned:allProspects.length,duration_ms:Date.now()-startedAt}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
}));
