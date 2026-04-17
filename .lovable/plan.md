
User has bundled 7 distinct asks. Let me parse:

1. Execute the DWA Admin restructure (the prompt they pasted)
2. Default landing page → /dwa-admin on login
3. Change voicemail robot voice (currently "alice" in call-whisper, missed-call-handler likely uses Polly or alice too)
4. Full audit of postcard system (campaigns, QR codes, Stripe flow, money safety)
5. Change postcard preview UI in admin panel
6. Brainstorm 5 more low-touch advertising methods like postcards
7. Audit client onboarding: FieldDesk as dashboard? Where do bought leads go? Need email + SMS + dashboard with notes/save/buy-more.

Let me quickly scan postcard system + missed call voice + onboarding flow before planning.

I already saw call-whisper uses `<Say voice="alice">`. That's the robot. Twilio supports `Polly.Matthew-Neural`, `Polly.Joanna-Neural`, etc. — way better.

I need to check:
- missed-call-handler for voice
- postcard system (send-postcard-lob seen above — Lob HTML cards, QR via api.qrserver.com, links to campaign.qr_url)
- AdminPostcardCampaigns component
- contractor leads dashboard / where leads land for buyer

Let me batch-read key files then plan.
