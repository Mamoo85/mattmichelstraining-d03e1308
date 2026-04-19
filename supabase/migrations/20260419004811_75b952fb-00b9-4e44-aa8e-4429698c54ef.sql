-- Update michigan_open_data: midl-yni7 also doesn't exist; use catalog root instead
UPDATE public.data_source_endpoints
SET primary_url = 'https://data.michigan.gov/api/views.json',
    backup_url  = 'https://data.michigan.gov/api/catalog/v1'
WHERE source_name = 'michigan_open_data';

-- Update firecrawl_api: credit-usage endpoint instead of /v1/scrape (which 404s on HEAD)
UPDATE public.data_source_endpoints
SET primary_url = 'https://api.firecrawl.dev/v2/team/credit-usage',
    backup_url  = 'https://api.firecrawl.dev/v2/scrape'
WHERE source_name = 'firecrawl_api';

-- Update nursys_enotify: api.nursys.com/api/enotify also 404s; use the SOAP svc root which at least responds
UPDATE public.data_source_endpoints
SET primary_url = 'https://www.nursys.com/NursysEnotify/EnotifyService.svc',
    backup_url  = 'https://www.nursys.com'
WHERE source_name = 'nursys_enotify';