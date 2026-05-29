// meta-oauth-start — Facebook OAuth using JS SDK popup flow
// No redirect URI registration needed — uses postMessage from popup.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((_req: Request) => {
  const APP_ID = Deno.env.get("META_APP_ID") ?? "1026276313908972";
  const SAVE_URL = Deno.env.get("SUPABASE_URL") + "/functions/v1/meta-oauth-save";

  return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connect Meta Ads</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 500px; margin: 80px auto; padding: 20px; text-align: center; }
    h2 { color: #1877f2; }
    button { background: #1877f2; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 20px; }
    button:hover { background: #1558b0; }
    #status { margin-top: 20px; color: #444; min-height: 40px; }
    .success { color: #16a34a; font-weight: bold; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <h2>Connect Meta Ads</h2>
  <p>Click below to authorize Meta Ads access.<br>A Facebook login popup will appear.</p>
  <button onclick="startLogin()">Connect Facebook Account</button>
  <div id="status"></div>

  <script>
    const APP_ID = "${APP_ID}";
    const SAVE_URL = "${SAVE_URL}";

    function startLogin() {
      document.getElementById('status').textContent = 'Opening Facebook login...';

      const params = new URLSearchParams({
        client_id: APP_ID,
        redirect_uri: window.location.href.split('?')[0] + '?done=1',
        scope: 'ads_management,ads_read,business_management,public_profile',
        response_type: 'token',
        display: 'popup',
      });

      const width = 600, height = 700;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;

      const popup = window.open(
        'https://www.facebook.com/v21.0/dialog/oauth?' + params,
        'fb_oauth',
        'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top
      );

      // Poll for popup close or token in URL
      const interval = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(interval);
            document.getElementById('status').textContent = 'Popup closed. Try again.';
            return;
          }
          const hash = popup.location.hash;
          if (hash && hash.includes('access_token')) {
            clearInterval(interval);
            popup.close();
            const tokenMatch = hash.match(/access_token=([^&]+)/);
            if (tokenMatch) {
              handleToken(tokenMatch[1]);
            }
          }
        } catch(e) {
          // Cross-origin, still loading — keep polling
        }
      }, 300);
    }

    async function handleToken(token) {
      document.getElementById('status').textContent = 'Got token! Saving...';
      try {
        const res = await fetch(SAVE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('status').innerHTML =
            '<span class="success">✅ Connected! Permissions: ' + data.permissions.join(', ') +
            '<br>Ad accounts: ' + data.adAccounts.map(a => a.name).join(', ') +
            '<br>Token saved — you can close this tab.</span>';
        } else {
          document.getElementById('status').innerHTML = '<span class="error">❌ ' + data.error + '</span>';
        }
      } catch(e) {
        document.getElementById('status').innerHTML = '<span class="error">❌ Save failed: ' + e.message + '</span>';
      }
    }

    // Handle redirect back with token in fragment
    if (window.location.search.includes('done=1') && window.location.hash.includes('access_token')) {
      const tokenMatch = window.location.hash.match(/access_token=([^&]+)/);
      if (tokenMatch) handleToken(tokenMatch[1]);
    }
  </script>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
});
