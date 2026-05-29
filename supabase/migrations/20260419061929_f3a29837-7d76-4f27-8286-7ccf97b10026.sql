UPDATE public.hire_REDACTED
SET status = 'ok',
    error_message = 'manually released — was stuck in processing pre-Phase 18 fix',
    updated_at = NOW()
WHERE status = 'processing';