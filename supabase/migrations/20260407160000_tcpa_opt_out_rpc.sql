-- find_opted_out_active_clients(p_table, p_phone_col)
-- Returns rows from any SMS client table where the phone is in sms_opt_outs
-- and the client is still active. Uses a dynamic EXISTS query so no full
-- table scan happens in application memory.
--
-- Used by: comply-monitor edge function

create or replace function find_opted_out_active_clients(
  p_table  text,
  p_phone_col text
)
returns table(id uuid, phone text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Whitelist allowed tables to prevent SQL injection
  if p_table not in (
    'sms_blast_clients',
    'noshow_clients',
    'estimate_drip_clients',
    'invoice_chaser_clients',
    'afterjob_drip_clients',
    'promo_blaster_clients',
    'referral_program_clients',
    'slow_day_clients',
    'homeowner_campaign_clients',
    'review_monitor_clients'
  ) then
    raise exception 'Table % is not in the allowed list', p_table;
  end if;

  if p_phone_col not in ('phone_number', 'phone') then
    raise exception 'Column % is not in the allowed list', p_phone_col;
  end if;

  return query execute format(
    'select c.id, c.%I as phone
     from %I c
     where c.active = true
       and exists (
         select 1 from sms_opt_outs o
         where o.phone_number = c.%I
       )',
    p_phone_col, p_table, p_phone_col
  );
end;
$$;

-- Only callable by service_role (edge functions)
revoke all on function find_opted_out_active_clients(text, text) from public;
grant execute on function find_opted_out_active_clients(text, text) to service_role;
