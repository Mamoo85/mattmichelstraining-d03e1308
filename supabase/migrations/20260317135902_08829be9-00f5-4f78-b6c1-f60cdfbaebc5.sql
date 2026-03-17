-- Update CMS to remove guide references
UPDATE site_content 
SET content_value = 'Sport-Specific Programs',
    updated_at = now()
WHERE section = 'guides' AND content_key = 'section_title';

UPDATE site_content 
SET content_value = '4-week & 8-week programs · Written by Matt · Download & print as PDF',
    updated_at = now()
WHERE section = 'guides' AND content_key = 'section_subtitle';

UPDATE site_content 
SET content_value = 'Each program gives your athlete Matt''s proven training system for their sport — with the WHY behind every movement. Built for youth athletes from middle school through college prep. Download and print to keep forever.',
    updated_at = now()
WHERE section = 'guides' AND content_key = 'section_description';

UPDATE site_content 
SET content_value = 'I can only train so many athletes in person. But I can give you exactly what I''d give them. Every program teaches the WHY — not just what to do. When they understand why, they do it better. 100% of the time.',
    updated_at = now()
WHERE section = 'shop_products' AND content_key = 'value_hook';

UPDATE site_content 
SET content_value = 'Matt charges $100+/hour in person and can only see so many athletes a week. These programs are how he shares 20+ years of knowledge with athletes he can''t reach in person. Same system. Same coaching. No overhead markup.',
    updated_at = now()
WHERE section = 'shop_products' AND content_key = 'affordable_text';

UPDATE site_content 
SET content_value = 'Start with a $20 program',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'hero_cta_primary';

UPDATE site_content 
SET content_value = 'When you buy a program, Matt is on the other end. Not AI. Not a chatbot. When your athlete logs a workout and something doesn''t feel right — they tap "Ask Matt" and he personally reads it, responds, and walks them through it. For $20, your kid gets a 20-year veteran coach.',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'matt_coaching_text';

UPDATE site_content 
SET content_value = 'Start with a $20 program. See how Matt approaches training. Then decide if you want the full experience — online or in-person.',
    updated_at = now()
WHERE section = 'for_parents' AND content_key = 'final_cta_text';