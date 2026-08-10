-- KHALED - escalation store
-- Run once in the Supabase SQL editor.

create table if not exists public.concierge_escalations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text,
  organisation  text,
  category      text not null,
  summary       text not null,
  language      text not null check (language in ('ar','en','ru','zh-Hans','fr','es','hi')),
  transcript    jsonb,
  email_sent    boolean not null default false,
  source_ip     text,
  status        text not null default 'open' check (status in ('open','in_progress','answered','closed')),
  answered_at   timestamptz,
  founder_notes text
);

create index if not exists concierge_escalations_created_at_idx
  on public.concierge_escalations (created_at desc);
create index if not exists concierge_escalations_status_idx
  on public.concierge_escalations (status);

-- No public access. The endpoint writes with the service role key, which bypasses
-- these policies. Records are read through the Supabase dashboard until an
-- authenticated admin console exists.
alter table public.concierge_escalations enable row level security;
revoke all on public.concierge_escalations from anon, authenticated;
