/**
 * ebay-oauth-start
 * Redirects Matt to eBay's OAuth consent page.
 * Visit: https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-oauth-start
 */

const APP_ID   = Deno.env.get("EBAY_APP_ID")  ?? "MatthewM-Gngstore-PRD-c18432bc3-2f92d0a1";
const RU_NAME  = "Matthew_Michels-MatthewM-Gngsto-lxningvnx";

// eBay OAuth 2.0 scopes needed for listing + selling
const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly",
].join(" ");

Deno.serve(async (_req: Request) => {
  const authUrl = new URL("https://auth.ebay.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", APP_ID);
  authUrl.searchParams.set("redirect_uri", RU_NAME);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("prompt", "login");

  return Response.redirect(authUrl.toString(), 302);
});
