import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(() => new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Guilds and Grains</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         max-width:640px;margin:80px auto;padding:0 24px;color:#111;}
    h1{font-size:28px;font-weight:800;}
    p{font-size:16px;line-height:1.6;color:#444;}
    a{color:#FE2C55;text-decoration:none;}
  </style>
</head>
<body>
  <h1>🌾 Guilds and Grains</h1>
  <p>
    Guilds and Grains is a content automation platform for e-commerce sellers.
    It uses TikTok's Content Posting API to automatically generate and publish
    AI-created lifestyle videos promoting products listed on Etsy.
  </p>
  <p>
    <a href="https://mattmichelstraining.com/terms">Terms of Service</a> ·
    <a href="https://mattmichelstraining.com/privacy-policy">Privacy Policy</a>
  </p>
</body>
</html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
