-- Add pipeline_stage + source columns to outreach_leads for CRM kanban view

alter table outreach_leads
  add column if not exists pipeline_stage text not null default 'new'
    check (pipeline_stage in ('new','enriched','emailed','replied','demo_booked','won','lost')),
  add column if not exists source text,
  add column if not exists pipeline_updated_at timestamptz;

create index if not exists outreach_leads_pipeline_stage_idx on outreach_leads(pipeline_stage);

comment on column outreach_leads.pipeline_stage is
  'CRM kanban stage: new → enriched → emailed → replied → demo_booked → won/lost';
