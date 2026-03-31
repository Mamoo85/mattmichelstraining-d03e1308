
-- Add admin SELECT policies to all B2B client tables
-- These tables have RLS enabled but only service_role policies, so admins can't query from client

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'ads_copy_clients','appointment_reminders','battlecard_clients','birthday_campaign_clients',
    'blog_post_clients','chatbot_clients','collections_clients','collections_contacts',
    'competitor_watch_clients','contractor_clients','direct_mail_clients','directory_submitter_clients',
    'estimate_generator_clients','faq_refresh_clients','gbp_saas_clients','google_qa_clients',
    'grant_finder_clients','handbook_clients','hiring_assistant_clients','holiday_sms_clients',
    'holiday_sms_contacts','inventory_alert_clients','inventory_items','kpi_email_clients',
    'linkedin_ghostwriting_clients','local_seo_clients','market_intel_clients','meeting_prep_clients',
    'newsletter_service_clients','onboarding_agent_clients','osha_compliance_clients',
    'payment_chaser_clients','permit_monitor_clients','phone_answering_clients','press_release_clients',
    'price_monitor_clients','promo_planner_clients','proposal_generator_clients','quote_followup_clients',
    'reactivation_contacts','reactivation_email_clients','reputation_clients','reputation_reports',
    'review_alert_clients','review_alerts_log','review_request_clients','review_responder_clients',
    'review_response_clients','sales_script_clients','satisfaction_survey_clients','seo_report_clients',
    'social_caption_clients','social_media_clients','social_proof_clients','speed_lead_clients',
    'staff_newsletter_clients','text_marketing_clients','text_marketing_contacts','thank_you_sms_clients',
    'video_script_clients','voicemail_clients','warranty_contacts','warranty_reminder_clients',
    'website_copy_clients','weekly_digest_clients','welcome_drip_clients','welcome_drip_contacts',
    'winback_sms_clients','winback_sms_contacts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY "Admins can read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))',
      tbl
    );
  END LOOP;
END $$;
