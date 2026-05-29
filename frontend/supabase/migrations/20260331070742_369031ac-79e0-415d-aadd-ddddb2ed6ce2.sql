
CREATE TABLE IF NOT EXISTS public.kpi_email_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  report_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.kpi_email_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_kpi" ON public.kpi_email_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.sales_script_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  script_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.sales_script_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_sales_script" ON public.sales_script_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.staff_newsletter_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.staff_newsletter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_staff_newsletter" ON public.staff_newsletter_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.speed_lead_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  lead_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.speed_lead_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_speed_lead" ON public.speed_lead_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.welcome_drip_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.welcome_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_welcome_drip" ON public.welcome_drip_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.welcome_drip_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.welcome_drip_clients(id) ON DELETE CASCADE NOT NULL,
  contact_email text NOT NULL,
  contact_name text,
  drip_step integer DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.welcome_drip_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_welcome_drip_contacts" ON public.welcome_drip_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.reactivation_email_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reactivation_email_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_reactivation" ON public.reactivation_email_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.reactivation_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.reactivation_email_clients(id) ON DELETE CASCADE NOT NULL,
  contact_email text NOT NULL,
  contact_name text,
  last_active_at timestamptz,
  reactivation_step integer DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reactivation_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_reactivation_contacts" ON public.reactivation_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.satisfaction_survey_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.satisfaction_survey_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_satisfaction" ON public.satisfaction_survey_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.video_script_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  script_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.video_script_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_video_script" ON public.video_script_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.press_release_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  release_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.press_release_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_press_release" ON public.press_release_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.hiring_assistant_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.hiring_assistant_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_hiring" ON public.hiring_assistant_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.estimate_generator_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  estimate_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.estimate_generator_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_estimate" ON public.estimate_generator_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.promo_planner_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  plan_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.promo_planner_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_promo" ON public.promo_planner_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.proposal_generator_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  proposal_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.proposal_generator_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_proposal" ON public.proposal_generator_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.weekly_digest_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  digest_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.weekly_digest_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_digest" ON public.weekly_digest_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.quote_followup_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  followup_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.quote_followup_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_quote" ON public.quote_followup_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.warranty_reminder_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.warranty_reminder_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_warranty" ON public.warranty_reminder_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.warranty_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.warranty_reminder_clients(id) ON DELETE CASCADE NOT NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  product_name text,
  warranty_expiry date,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.warranty_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_warranty_contacts" ON public.warranty_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.thank_you_sms_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.thank_you_sms_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_thankyou" ON public.thank_you_sms_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.text_marketing_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.text_marketing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_textmktg" ON public.text_marketing_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.text_marketing_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.text_marketing_clients(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL,
  name text,
  opted_in boolean DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.text_marketing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_textmktg_contacts" ON public.text_marketing_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.google_qa_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  gbp_url text,
  active boolean DEFAULT true,
  answer_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.google_qa_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_googleqa" ON public.google_qa_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.website_copy_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  website_url text,
  active boolean DEFAULT true,
  refresh_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.website_copy_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_webcopy" ON public.website_copy_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.direct_mail_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  mail_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.direct_mail_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_directmail" ON public.direct_mail_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.holiday_sms_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.holiday_sms_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_holidaysms" ON public.holiday_sms_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.holiday_sms_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.holiday_sms_clients(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL,
  name text,
  opted_in boolean DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.holiday_sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_holidaysms_contacts" ON public.holiday_sms_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.review_alert_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  google_place_id text,
  active boolean DEFAULT true,
  alert_count integer DEFAULT 0,
  last_checked_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.review_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_reviewalert" ON public.review_alert_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.review_alerts_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.review_alert_clients(id) ON DELETE CASCADE NOT NULL,
  review_text text,
  reviewer_name text,
  rating integer,
  alerted_at timestamptz DEFAULT now()
);
ALTER TABLE public.review_alerts_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_reviewalerts_log" ON public.review_alerts_log FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.winback_sms_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  send_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.winback_sms_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_winback" ON public.winback_sms_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.winback_sms_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.winback_sms_clients(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL,
  name text,
  days_inactive integer DEFAULT 0,
  last_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.winback_sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_winback_contacts" ON public.winback_sms_contacts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.linkedin_ghostwriting_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  linkedin_url text,
  active boolean DEFAULT true,
  post_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.linkedin_ghostwriting_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_linkedin" ON public.linkedin_ghostwriting_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.seo_report_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  website_url text,
  active boolean DEFAULT true,
  report_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.seo_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_seoreport" ON public.seo_report_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.chatbot_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  website_url text,
  active boolean DEFAULT true,
  chat_count integer DEFAULT 0,
  last_active_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.chatbot_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_chatbot" ON public.chatbot_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.review_responder_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  google_place_id text,
  active boolean DEFAULT true,
  response_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.review_responder_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_reviewresponder" ON public.review_responder_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.social_media_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  plan text DEFAULT 'standard',
  platforms text[] DEFAULT ARRAY['facebook'],
  active boolean DEFAULT true,
  post_count integer DEFAULT 0,
  last_posted_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.social_media_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_socialmedia" ON public.social_media_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.contractor_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text DEFAULT 'contractor',
  service_area text,
  active boolean DEFAULT true,
  lead_count integer DEFAULT 0,
  last_lead_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.contractor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_contractor" ON public.contractor_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gbp_saas_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  gbp_account_id text,
  plan text DEFAULT 'basic',
  active boolean DEFAULT true,
  post_count integer DEFAULT 0,
  last_posted_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.gbp_saas_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_gbpsaas" ON public.gbp_saas_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.social_caption_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  active boolean DEFAULT true,
  caption_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.social_caption_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_captions" ON public.social_caption_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.voicemail_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  transcription_count integer DEFAULT 0,
  last_sent_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.voicemail_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_voicemail" ON public.voicemail_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.phone_answering_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  business_name text NOT NULL,
  industry text,
  twilio_number text,
  active boolean DEFAULT true,
  call_count integer DEFAULT 0,
  last_call_at timestamptz,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.phone_answering_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_phone" ON public.phone_answering_clients FOR ALL USING (true) WITH CHECK (true);
