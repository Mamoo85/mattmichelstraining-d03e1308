-- ═══════════════════════════════════════════════════════════════
-- 30 New Autonomous Products Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. Commercial Lease Abstractor
CREATE TABLE IF NOT EXISTS commercial_lease_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  leases_processed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE commercial_lease_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON commercial_lease_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS lease_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES commercial_lease_clients(id) ON DELETE CASCADE,
  lease_filename TEXT,
  lease_text TEXT,
  analysis_result TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lease_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON lease_analyses TO service_role USING (true) WITH CHECK (true);

-- 2. Patent Watch Intelligence
CREATE TABLE IF NOT EXISTS patent_watch_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  tech_domains TEXT,
  competitors TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE patent_watch_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON patent_watch_clients TO service_role USING (true) WITH CHECK (true);

-- 3. PE / Investor Sector Intelligence
CREATE TABLE IF NOT EXISTS pe_intelligence_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  sectors TEXT,
  focus_companies TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE pe_intelligence_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON pe_intelligence_clients TO service_role USING (true) WITH CHECK (true);

-- 4. Franchise Disclosure Document Analyzer
CREATE TABLE IF NOT EXISTS franchise_analyzer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  documents_analyzed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE franchise_analyzer_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON franchise_analyzer_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS franchise_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES franchise_analyzer_clients(id) ON DELETE CASCADE,
  franchise_name TEXT,
  document_text TEXT,
  analysis_result TEXT,
  risk_score INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE franchise_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON franchise_analyses TO service_role USING (true) WITH CHECK (true);

-- 5. Regulatory Change Monitor
CREATE TABLE IF NOT EXISTS regulatory_monitor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  industry TEXT,
  regulatory_bodies TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE regulatory_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON regulatory_monitor_clients TO service_role USING (true) WITH CHECK (true);

-- 6. Nonprofit Grant Discovery Engine
CREATE TABLE IF NOT EXISTS grant_discovery_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  org_name TEXT,
  contact_name TEXT,
  phone TEXT,
  mission TEXT,
  geography TEXT,
  budget_range TEXT,
  cause_areas TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE grant_discovery_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON grant_discovery_clients TO service_role USING (true) WITH CHECK (true);

-- 7. Government RFP Alert Service
CREATE TABLE IF NOT EXISTS rfp_alert_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  services_offered TEXT,
  naics_codes TEXT,
  geography TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE rfp_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON rfp_alert_clients TO service_role USING (true) WITH CHECK (true);

-- 8. AI Obituary Service for Funeral Homes
CREATE TABLE IF NOT EXISTS obituary_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  funeral_home_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  obituaries_written INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE obituary_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON obituary_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS obituary_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES obituary_clients(id) ON DELETE CASCADE,
  deceased_name TEXT,
  intake_data JSONB,
  obituary_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE obituary_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON obituary_orders TO service_role USING (true) WITH CHECK (true);

-- 9. Competitor Price Intelligence
CREATE TABLE IF NOT EXISTS price_intelligence_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  competitor_urls TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE price_intelligence_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON price_intelligence_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS price_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES price_intelligence_clients(id) ON DELETE CASCADE,
  competitor_url TEXT,
  product_name TEXT,
  price_cents INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE price_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON price_tracking TO service_role USING (true) WITH CHECK (true);

-- 10. AI Executive LinkedIn Ghostwriter
CREATE TABLE IF NOT EXISTS linkedin_ghostwriter_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  linkedin_url TEXT,
  tone_preferences TEXT,
  industry TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_post_at TIMESTAMPTZ,
  posts_published INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE linkedin_ghostwriter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON linkedin_ghostwriter_clients TO service_role USING (true) WITH CHECK (true);

-- 11. HOA Board Secretary AI
CREATE TABLE IF NOT EXISTS hoa_secretary_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  hoa_name TEXT,
  contact_name TEXT,
  phone TEXT,
  member_emails TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  minutes_generated INTEGER DEFAULT 0,
  last_minutes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hoa_secretary_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON hoa_secretary_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS hoa_meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES hoa_secretary_clients(id) ON DELETE CASCADE,
  meeting_date DATE,
  raw_notes TEXT,
  formatted_minutes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hoa_meeting_minutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON hoa_meeting_minutes TO service_role USING (true) WITH CHECK (true);

-- 12. Local Government Meeting Tracker
CREATE TABLE IF NOT EXISTS gov_meeting_tracker_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  target_cities TEXT,
  keywords TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE gov_meeting_tracker_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON gov_meeting_tracker_clients TO service_role USING (true) WITH CHECK (true);

-- 13. Agricultural Price Alert System
CREATE TABLE IF NOT EXISTS ag_price_alert_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  commodities TEXT,
  alert_thresholds JSONB,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ag_price_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON ag_price_alert_clients TO service_role USING (true) WITH CHECK (true);

-- 14. Podcast Production Automation
CREATE TABLE IF NOT EXISTS podcast_production_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  show_name TEXT,
  contact_name TEXT,
  phone TEXT,
  show_description TEXT,
  target_audience TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  episodes_processed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE podcast_production_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON podcast_production_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES podcast_production_clients(id) ON DELETE CASCADE,
  episode_title TEXT,
  transcript_text TEXT,
  show_notes TEXT,
  social_posts TEXT,
  seo_title TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON podcast_episodes TO service_role USING (true) WITH CHECK (true);

-- 15. Luxury Real Estate Market Intelligence
CREATE TABLE IF NOT EXISTS luxury_re_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  target_markets TEXT,
  price_range_min INTEGER,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE luxury_re_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON luxury_re_clients TO service_role USING (true) WITH CHECK (true);

-- 16. Trade Show Follow-Up Automation
CREATE TABLE IF NOT EXISTS trade_show_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  campaigns_run INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trade_show_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON trade_show_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS trade_show_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES trade_show_clients(id) ON DELETE CASCADE,
  show_name TEXT,
  contacts_csv TEXT,
  contacts_count INTEGER DEFAULT 0,
  sequences_started INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trade_show_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON trade_show_campaigns TO service_role USING (true) WITH CHECK (true);

-- 17. Corporate R&D Academic Paper Intelligence
CREATE TABLE IF NOT EXISTS rd_intelligence_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  tech_domains TEXT,
  keywords TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE rd_intelligence_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON rd_intelligence_clients TO service_role USING (true) WITH CHECK (true);

-- 18. Insurance Agent Lead Drip
CREATE TABLE IF NOT EXISTS insurance_drip_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  prospects_enrolled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE insurance_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON insurance_drip_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS insurance_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES insurance_drip_clients(id) ON DELETE CASCADE,
  prospect_name TEXT,
  prospect_email TEXT,
  prospect_phone TEXT,
  coverage_type TEXT,
  step INTEGER DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE insurance_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON insurance_prospects TO service_role USING (true) WITH CHECK (true);

-- 19. Credit Dispute Letter Factory
CREATE TABLE IF NOT EXISTS credit_dispute_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  disputes_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE credit_dispute_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON credit_dispute_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS credit_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES credit_dispute_clients(id) ON DELETE CASCADE,
  bureau TEXT,
  dispute_type TEXT,
  account_details TEXT,
  letter_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE credit_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON credit_disputes TO service_role USING (true) WITH CHECK (true);

-- 20. Airbnb / STR Host Reputation Manager
CREATE TABLE IF NOT EXISTS str_reputation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  property_urls TEXT,
  property_count INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_check_at TIMESTAMPTZ,
  reviews_responded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE str_reputation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON str_reputation_clients TO service_role USING (true) WITH CHECK (true);

-- 21. Restaurant Menu Engineering Report
CREATE TABLE IF NOT EXISTS menu_engineering_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  restaurant_name TEXT,
  contact_name TEXT,
  phone TEXT,
  cuisine_type TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE menu_engineering_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON menu_engineering_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS menu_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES menu_engineering_clients(id) ON DELETE CASCADE,
  menu_data TEXT,
  sales_data TEXT,
  report_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE menu_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON menu_reports TO service_role USING (true) WITH CHECK (true);

-- 22. AI Sermon Prep for Clergy
CREATE TABLE IF NOT EXISTS sermon_prep_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  church_name TEXT,
  contact_name TEXT,
  phone TEXT,
  denomination TEXT,
  lectionary_type TEXT DEFAULT 'revised_common',
  sermon_day TEXT DEFAULT 'Sunday',
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  sermons_delivered INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sermon_prep_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON sermon_prep_clients TO service_role USING (true) WITH CHECK (true);

-- 23. Personal Trainer Client Progress Reports
CREATE TABLE IF NOT EXISTS fitness_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  reports_sent INTEGER DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE fitness_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON fitness_report_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS fitness_client_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES fitness_report_clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  goal TEXT,
  current_weight NUMERIC,
  start_weight NUMERIC,
  notes TEXT,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE fitness_client_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON fitness_client_roster TO service_role USING (true) WITH CHECK (true);

-- 24. Medical Bill Dispute Letters
CREATE TABLE IF NOT EXISTS medical_bill_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  disputes_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE medical_bill_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON medical_bill_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS medical_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES medical_bill_clients(id) ON DELETE CASCADE,
  provider_name TEXT,
  bill_amount NUMERIC,
  dispute_reason TEXT,
  bill_details TEXT,
  letter_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE medical_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON medical_disputes TO service_role USING (true) WITH CHECK (true);

-- 25. HOA Violation Letter Generator
CREATE TABLE IF NOT EXISTS hoa_violation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  hoa_name TEXT,
  contact_name TEXT,
  phone TEXT,
  state TEXT DEFAULT 'MI',
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  letters_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hoa_violation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON hoa_violation_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS hoa_violation_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES hoa_violation_clients(id) ON DELETE CASCADE,
  homeowner_address TEXT,
  violation_type TEXT,
  violation_description TEXT,
  letter_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hoa_violation_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON hoa_violation_letters TO service_role USING (true) WITH CHECK (true);

-- 26. Multi-Location Citation Monitor
CREATE TABLE IF NOT EXISTS citation_monitor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  locations JSONB,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_scan_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE citation_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON citation_monitor_clients TO service_role USING (true) WITH CHECK (true);

-- 27. Supplement Stack Analyzer
CREATE TABLE IF NOT EXISTS supplement_analyzer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  supplement_stack TEXT,
  health_goals TEXT,
  age INTEGER,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_analysis_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE supplement_analyzer_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON supplement_analyzer_clients TO service_role USING (true) WITH CHECK (true);

-- 28. Trade Association Intelligence Brief
CREATE TABLE IF NOT EXISTS trade_association_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  association_name TEXT,
  contact_name TEXT,
  phone TEXT,
  industry TEXT,
  member_count INTEGER,
  keywords TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_brief_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trade_association_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON trade_association_clients TO service_role USING (true) WITH CHECK (true);

-- 29. Children's Personalized Story Subscription
CREATE TABLE IF NOT EXISTS story_subscription_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  parent_name TEXT,
  phone TEXT,
  child_name TEXT NOT NULL,
  child_age INTEGER,
  child_interests TEXT,
  favorite_themes TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  stories_sent INTEGER DEFAULT 0,
  last_story_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE story_subscription_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON story_subscription_clients TO service_role USING (true) WITH CHECK (true);

-- 30. Landlord-Tenant Correspondence AI
CREATE TABLE IF NOT EXISTS landlord_letter_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  state TEXT DEFAULT 'MI',
  property_count INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  letters_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE landlord_letter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON landlord_letter_clients TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS landlord_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES landlord_letter_clients(id) ON DELETE CASCADE,
  tenant_name TEXT,
  property_address TEXT,
  situation_type TEXT,
  situation_details TEXT,
  letter_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE landlord_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON landlord_cases TO service_role USING (true) WITH CHECK (true);
