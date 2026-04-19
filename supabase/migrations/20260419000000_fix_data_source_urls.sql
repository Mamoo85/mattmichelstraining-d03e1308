-- Fix Michigan Open Data: wrong Socrata dataset ID (az5f-bwij doesn't exist; midl-yni7 = professional licenses)
UPDATE public.data_source_endpoints
SET primary_url = 'https://data.michigan.gov/resource/midl-yni7.json',
    backup_url  = 'https://data.michigan.gov/api/views'
WHERE source_name = 'michigan_open_data';

-- Fix Nursys: SOAP service URL in DB → REST API endpoint used by actual code
UPDATE public.data_source_endpoints
SET primary_url = 'https://api.nursys.com/api/enotify',
    backup_url  = 'https://www.nursys.com/NursysEnotify/EnotifyService.svc'
WHERE source_name = 'nursys_enotify';

-- Fix Apollo: switch from POST-only /people/match to GET /auth/health
UPDATE public.data_source_endpoints
SET primary_url = 'https://api.apollo.io/v1/auth/health'
WHERE source_name = 'apollo_api';

-- Remove OpenAI: no key configured, not used in codebase, always broken
DELETE FROM public.data_source_endpoints WHERE source_name = 'openai_api';
