-- Mark stale orphaned "pending" log rows as expired (their pgmq messages are long gone)
INSERT INTO email_send_log (message_id, template_name, recipient_email, status, error_message, created_at)
SELECT message_id, template_name, recipient_email, 'failed',
       'orphaned_pending_swept: pgmq message expired/lost during worker pool outage',
       now()
FROM (
  SELECT DISTINCT ON (message_id) message_id, template_name, recipient_email, status, created_at
  FROM email_send_log
  WHERE message_id IS NOT NULL
  ORDER BY message_id, created_at DESC
) latest
WHERE status = 'pending'
  AND created_at < now() - interval '2 hours';