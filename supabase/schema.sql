-- Run this whole file once in Supabase > SQL Editor
create extension if not exists pgcrypto;

create table players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  school text not null,
  grade text not null,
  token_hash text not null unique,
  consent_status boolean not null default false,   -- PDPA consent given at registration
  consent_at timestamptz,                           -- consent timestamp
  consent_version text,                             -- which notice text was accepted
  created_at timestamptz not null default now(),
  constraint consent_required check (consent_status = true and consent_at is not null)
);
create table booths (
  id text primary key,
  name text not null,
  description text,
  secret_code text not null,
  is_active boolean not null default true
);
create table stamps (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  booth_id text not null references booths(id),
  unlocked_at timestamptz not null default now(),
  unique (player_id, booth_id)            -- one stamp per booth per player
);
create table rewards (
  id bigint generated always as identity primary key,
  player_id uuid not null unique references players(id) on delete cascade, -- one reward per player
  status text not null default 'NOT_REDEEMED' check (status in ('NOT_REDEEMED','REDEEMED')),
  stamp_count int not null default 0,
  finished_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by text,
  completed_at timestamptz                          -- set when feedback is submitted (event finished)
);
create table activity_logs (
  id bigint generated always as identity primary key,
  player_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create table feedback (
  id bigint generated always as identity primary key,
  player_id uuid not null unique references players(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index on activity_logs (player_id, action, created_at);

-- RLS on, no policies: the public anon key can read/write nothing.
-- Only the server API (service role key) touches the data.
alter table players enable row level security;
alter table booths enable row level security;
alter table stamps enable row level security;
alter table rewards enable row level security;
alter table activity_logs enable row level security;
alter table feedback enable row level security;

-- PDPA retention: deletes players (and their stamps, rewards, feedback) and logs older than N days.
-- Run after the event:  select purge_personal_data(90);
create or replace function purge_personal_data(retention_days int default 90) returns void
language plpgsql security definer as $$
begin
  delete from players where created_at < now() - make_interval(days => retention_days);
  delete from activity_logs where created_at < now() - make_interval(days => retention_days);
end $$;
revoke all on function purge_personal_data(int) from public, anon, authenticated;

-- Secret codes: CHANGE THESE before the event (they live only in the database)
insert into booths (id, name, description, secret_code) values
 ('BOOTH01','VR','VR Experience','676767'),
 ('BOOTH02','IoT','IoT Lab','767676'),
 ('BOOTH03','Project Showcase','Project Showcase','345876'),
 ('BOOTH04','Data Analysis','Data Analysis','987321');
