-- Fix data source URLs that were set wrong; matches 20260419000000_fix_data_source_urls.sql
UPDATE public.data_source_endpoints
SET primary_url = 'https://data.michigan.gov/resource/midl-yni7.json',
    backup_url  = 'https://data.michigan.gov/api/views'
WHERE source_name = 'michigan_open_data';

UPDATE public.data_source_endpoints
SET primary_url = 'https://api.nursys.com/api/enotify',
    backup_url  = 'https://www.nursys.com/NursysEnotify/EnotifyService.svc'
WHERE source_name = 'nursys_enotify';

UPDATE public.data_source_endpoints
SET primary_url = 'https://api.apollo.io/v1/auth/health'
WHERE source_name = 'apollo_api';

DELETE FROM public.data_source_endpoints WHERE source_name = 'openai_api';