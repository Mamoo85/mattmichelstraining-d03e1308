-- Update hero subtitle to match new copy
UPDATE site_content 
SET content_value = '20+ years developing athletes the right way. Custom programs, real coaching, zero injuries. In-person in Grosse Pointe or online anywhere.',
    updated_at = now()
WHERE section = 'hero' AND content_key = 'subtitle';

-- Update guides section to match new copy
UPDATE site_content 
SET content_value = 'Sport-Specific Guides',
    updated_at = now()
WHERE section = 'guides' AND content_key = 'section_title';

UPDATE site_content 
SET content_value = 'PDF · Written by Matt · Instant download · Keep forever',
    updated_at = now()
WHERE section = 'guides' AND content_key = 'section_subtitle';

UPDATE site_content 
SET content_value = 'Each guide gives your athlete Matt''s top exercises for their sport — with the WHY behind every movement. Built for youth athletes from middle school through college prep. No filler.',
    updated_at = now()
WHERE section = 'guides' AND content_key = 'section_description';

-- Update premium program copy
UPDATE site_content 
SET content_value = 'You fill out the intake. Matt reads every word. Then he builds your athlete''s program from scratch — their sport, their goals, their equipment, their level. Not a template. Not AI-generated. 20 years of experience, written personally.',
    updated_at = now()
WHERE section = 'premium_program' AND content_key = 'description';

-- Update pricing page copy
UPDATE site_content 
SET content_value = 'Every plan is month-to-month. Cancel anytime. No contracts.',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'page_subtitle';

UPDATE site_content 
SET content_value = 'Most families spend $200–$600/month on in-person youth training and still get generic programming. M² delivers 20 years of experience direct to your phone starting at $12.99/month. No travel. No scheduling conflicts. Same proven system.',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'value_banner';

UPDATE site_content 
SET content_value = 'Online Training Plans',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'page_heading';

UPDATE site_content 
SET content_value = 'Free With Every Account',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'free_banner_title';

UPDATE site_content 
SET content_value = 'No subscription needed. Create an account and you immediately get Monthly Focus Plans, member challenges, and full workout logging.',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'free_banner_text';

-- Update Pro features to reflect Fix It library accurately
UPDATE site_content 
SET content_value = 'Everything in Basic|Custom program from intake form|🖐️ Flag Coach Matt — get personal feedback on any exercise|Optional postural video assessment|Monthly program updates|Full Fix It rehab library',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'pro_features';

-- Update Elite features
UPDATE site_content 
SET content_value = 'Everything in Pro|1-on-1 monthly check-ins with Matt|Priority postural assessments|Direct messaging with Matt|Priority coach responses',
    updated_at = now()
WHERE section = 'pricing_page' AND content_key = 'elite_features';

-- Update shop value hook
UPDATE site_content 
SET content_value = 'I can only train so many athletes in person. But I can give you exactly what I''d give them. Every guide teaches the WHY — not just what to do. When they understand why, they do it better. 100% of the time.',
    updated_at = now()
WHERE section = 'shop_products' AND content_key = 'value_hook';

-- Update affordability text  
UPDATE site_content 
SET content_value = 'Matt charges $100+/hour in person and can only see so many athletes a week. These programs are how he shares 20+ years of knowledge with athletes he can''t reach in person. Same system. Same coaching. No overhead markup.',
    updated_at = now()
WHERE section = 'shop_products' AND content_key = 'affordable_text';

-- Update for_parents hero subtitle
UPDATE site_content 
SET content_value = 'Most youth training programs are built by people who learned from social media — not from 20 years of watching what actually breaks down in a young athlete''s body. Matt has trained thousands of kids. 50+ went on to compete at the college level. Zero got injured. That''s not a slogan — it''s a track record.',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'hero_subtitle';

-- Update for_parents matt coaching text
UPDATE site_content 
SET content_value = 'When you buy a program, Matt is on the other end. Not AI. Not a chatbot. When your athlete logs a workout and something doesn''t feel right — they tap "Ask Matt" and he personally reads it, responds, and walks them through it. For $15–$20, your kid gets a 20-year veteran coach.',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'matt_coaching_text';

-- Update for_parents final CTA
UPDATE site_content 
SET content_value = 'Start with a $15 guide or a $20 custom program. See how Matt approaches training. Then decide if you want the full experience — online or in-person.',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'final_cta_text';

UPDATE site_content 
SET content_value = 'Start with a $15 guide',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'hero_cta_primary';