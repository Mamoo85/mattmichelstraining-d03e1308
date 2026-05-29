-- BATCH 1: Fix "service_role_full_*" policies (TO PUBLIC -> TO service_role)

DROP POLICY IF EXISTS "service_role_full_birthday" ON public.birthday_campaign_clients;
CREATE POLICY "service_role_full_birthday" ON public.birthday_campaign_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_chatbot" ON public.chatbot_clients;
CREATE POLICY "service_role_full_chatbot" ON public.chatbot_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_collections" ON public.collections_clients;
CREATE POLICY "service_role_full_collections" ON public.collections_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_coll_contacts" ON public.collections_contacts;
CREATE POLICY "service_role_full_coll_contacts" ON public.collections_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_contractor" ON public.contractor_clients;
CREATE POLICY "service_role_full_contractor" ON public.contractor_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_directmail" ON public.direct_mail_clients;
CREATE POLICY "service_role_full_directmail" ON public.direct_mail_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_estimate" ON public.estimate_generator_clients;
CREATE POLICY "service_role_full_estimate" ON public.estimate_generator_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_gbpsaas" ON public.gbp_saas_clients;
CREATE POLICY "service_role_full_gbpsaas" ON public.gbp_saas_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_googleqa" ON public.google_qa_clients;
CREATE POLICY "service_role_full_googleqa" ON public.google_qa_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_hiring" ON public.hiring_assistant_clients;
CREATE POLICY "service_role_full_hiring" ON public.hiring_assistant_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_holidaysms" ON public.holiday_sms_clients;
CREATE POLICY "service_role_full_holidaysms" ON public.holiday_sms_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_holidaysms_contacts" ON public.holiday_sms_contacts;
CREATE POLICY "service_role_full_holidaysms_contacts" ON public.holiday_sms_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_inventory" ON public.inventory_alert_clients;
CREATE POLICY "service_role_full_inventory" ON public.inventory_alert_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_inv_items" ON public.inventory_items;
CREATE POLICY "service_role_full_inv_items" ON public.inventory_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_kpi" ON public.kpi_email_clients;
CREATE POLICY "service_role_full_kpi" ON public.kpi_email_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_linkedin" ON public.linkedin_ghostwriting_clients;
CREATE POLICY "service_role_full_linkedin" ON public.linkedin_ghostwriting_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_osha" ON public.osha_compliance_clients;
CREATE POLICY "service_role_full_osha" ON public.osha_compliance_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_permit" ON public.permit_monitor_clients;
CREATE POLICY "service_role_full_permit" ON public.permit_monitor_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_phone" ON public.phone_answering_clients;
CREATE POLICY "service_role_full_phone" ON public.phone_answering_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_press_release" ON public.press_release_clients;
CREATE POLICY "service_role_full_press_release" ON public.press_release_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_promo" ON public.promo_planner_clients;
CREATE POLICY "service_role_full_promo" ON public.promo_planner_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_proposal" ON public.proposal_generator_clients;
CREATE POLICY "service_role_full_proposal" ON public.proposal_generator_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_quote" ON public.quote_followup_clients;
CREATE POLICY "service_role_full_quote" ON public.quote_followup_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_reactivation_contacts" ON public.reactivation_contacts;
CREATE POLICY "service_role_full_reactivation_contacts" ON public.reactivation_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_reactivation" ON public.reactivation_email_clients;
CREATE POLICY "service_role_full_reactivation" ON public.reactivation_email_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_reviewalert" ON public.review_alert_clients;
CREATE POLICY "service_role_full_reviewalert" ON public.review_alert_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_reviewalerts_log" ON public.review_alerts_log;
CREATE POLICY "service_role_full_reviewalerts_log" ON public.review_alerts_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_reviewresponder" ON public.review_responder_clients;
CREATE POLICY "service_role_full_reviewresponder" ON public.review_responder_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_sales_script" ON public.sales_script_clients;
CREATE POLICY "service_role_full_sales_script" ON public.sales_script_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_satisfaction" ON public.satisfaction_survey_clients;
CREATE POLICY "service_role_full_satisfaction" ON public.satisfaction_survey_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_seoreport" ON public.seo_report_clients;
CREATE POLICY "service_role_full_seoreport" ON public.seo_report_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_captions" ON public.social_caption_clients;
CREATE POLICY "service_role_full_captions" ON public.social_caption_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_socialmedia" ON public.social_media_clients;
CREATE POLICY "service_role_full_socialmedia" ON public.social_media_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_speed_lead" ON public.speed_lead_clients;
CREATE POLICY "service_role_full_speed_lead" ON public.speed_lead_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_staff_newsletter" ON public.staff_newsletter_clients;
CREATE POLICY "service_role_full_staff_newsletter" ON public.staff_newsletter_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_textmktg" ON public.text_marketing_clients;
CREATE POLICY "service_role_full_textmktg" ON public.text_marketing_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_textmktg_contacts" ON public.text_marketing_contacts;
CREATE POLICY "service_role_full_textmktg_contacts" ON public.text_marketing_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_thankyou" ON public.thank_you_sms_clients;
CREATE POLICY "service_role_full_thankyou" ON public.thank_you_sms_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_video_script" ON public.video_script_clients;
CREATE POLICY "service_role_full_video_script" ON public.video_script_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_voicemail" ON public.voicemail_clients;
CREATE POLICY "service_role_full_voicemail" ON public.voicemail_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_warranty_contacts" ON public.warranty_contacts;
CREATE POLICY "service_role_full_warranty_contacts" ON public.warranty_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_warranty" ON public.warranty_reminder_clients;
CREATE POLICY "service_role_full_warranty" ON public.warranty_reminder_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_webcopy" ON public.website_copy_clients;
CREATE POLICY "service_role_full_webcopy" ON public.website_copy_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_digest" ON public.weekly_digest_clients;
CREATE POLICY "service_role_full_digest" ON public.weekly_digest_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_welcome_drip" ON public.welcome_drip_clients;
CREATE POLICY "service_role_full_welcome_drip" ON public.welcome_drip_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_welcome_drip_contacts" ON public.welcome_drip_contacts;
CREATE POLICY "service_role_full_welcome_drip_contacts" ON public.welcome_drip_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_winback" ON public.winback_sms_clients;
CREATE POLICY "service_role_full_winback" ON public.winback_sms_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_winback_contacts" ON public.winback_sms_contacts;
CREATE POLICY "service_role_full_winback_contacts" ON public.winback_sms_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- BATCH 2: Fix "Service role *" named policies

DROP POLICY IF EXISTS "Service role full access on ads_copy_clients" ON public.ads_copy_clients;
CREATE POLICY "service_role_full_ads_copy" ON public.ads_copy_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on appointment_reminders" ON public.appointment_reminders;
CREATE POLICY "service_role_full_appointment" ON public.appointment_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on blog_post_clients" ON public.blog_post_clients;
CREATE POLICY "service_role_full_blog" ON public.blog_post_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on call_summaries" ON public.call_summaries;
CREATE POLICY "service_role_full_call_summaries" ON public.call_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on competitor_watch_clients" ON public.competitor_watch_clients;
CREATE POLICY "service_role_full_competitor" ON public.competitor_watch_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on directory_submitter_clients" ON public.directory_submitter_clients;
CREATE POLICY "service_role_full_directory" ON public.directory_submitter_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on faq_refresh_clients" ON public.faq_refresh_clients;
CREATE POLICY "service_role_full_faq" ON public.faq_refresh_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on legal_documents" ON public.legal_documents;
CREATE POLICY "service_role_full_legal" ON public.legal_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on local_seo_clients" ON public.local_seo_clients;
CREATE POLICY "service_role_full_local_seo" ON public.local_seo_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on meeting_prep_clients" ON public.meeting_prep_clients;
CREATE POLICY "service_role_full_meeting" ON public.meeting_prep_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on newsletter_service_clients" ON public.newsletter_service_clients;
CREATE POLICY "service_role_full_newsletter_svc" ON public.newsletter_service_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on onboarding_agent_clients" ON public.onboarding_agent_clients;
CREATE POLICY "service_role_full_onboarding" ON public.onboarding_agent_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on payment_chaser_clients" ON public.payment_chaser_clients;
CREATE POLICY "service_role_full_payment_chaser" ON public.payment_chaser_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on price_monitor_clients" ON public.price_monitor_clients;
CREATE POLICY "service_role_full_price_monitor" ON public.price_monitor_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on reputation_clients" ON public.reputation_clients;
CREATE POLICY "service_role_full_reputation" ON public.reputation_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on reputation_reports" ON public.reputation_reports;
CREATE POLICY "service_role_full_rep_reports" ON public.reputation_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on review_request_clients" ON public.review_request_clients;
CREATE POLICY "service_role_full_review_request" ON public.review_request_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on sms_consent_log" ON public.sms_consent_log;
CREATE POLICY "service_role_full_sms_consent" ON public.sms_consent_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on social_proof_clients" ON public.social_proof_clients;
CREATE POLICY "service_role_full_social_proof" ON public.social_proof_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on upsell_emails_sent" ON public.upsell_emails_sent;
CREATE POLICY "service_role_full_upsell" ON public.upsell_emails_sent FOR ALL TO service_role USING (true) WITH CHECK (true);

-- BATCH 3: Remove sensitive admin-only tables from Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.b2b_clients;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.service_subscriptions;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;