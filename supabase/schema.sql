-- Run this once in your Supabase project: SQL Editor → New query → Paste → Run

-- Enable UUID extension (already enabled on Supabase by default)
create extension if not exists "uuid-ossp";

-- ===== videos table =====
create table if not exists public.videos (
  id              uuid primary key default uuid_generate_v4(),

  -- TikTok video ID used as deduplication key
  tiktok_id       text not null unique,

  -- Core video metadata from TikTok API (or seed data)
  title           text not null default '',
  caption         text not null default '',
  cover_image_url text not null default '',
  share_url       text not null default '',
  duration        integer not null default 0,   -- seconds
  published_at    timestamptz not null,

  -- Public stats (updated on each sync)
  view_count      bigint not null default 0,
  like_count      bigint not null default 0,
  comment_count   bigint not null default 0,
  share_count     bigint not null default 0,

  -- AI-generated summary
  -- source: 'caption' = generated from caption text (no transcript available)
  -- source: 'transcript' = generated from transcript (Phase 2)
  summary         text,
  summary_source  text check (summary_source in ('caption', 'transcript', 'manual')) default 'caption',

  -- Internal housekeeping
  synced_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Newest-first index for the main feed query
create index if not exists videos_published_at_desc on public.videos (published_at desc);

-- ===== sync_log table =====
-- Tracks every sync run so we can show "Last updated" on the frontend
create table if not exists public.sync_log (
  id          uuid primary key default uuid_generate_v4(),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text check (status in ('running', 'success', 'error')) default 'running',
  new_videos  integer default 0,
  error_msg   text
);

-- Row-level security: public read, no public write
alter table public.videos enable row level security;
alter table public.sync_log enable row level security;

create policy "Public read videos"
  on public.videos for select using (true);

create policy "Public read sync_log"
  on public.sync_log for select using (true);

-- Service role can do everything (our server uses service_role key)
-- No additional policy needed — service_role bypasses RLS by default.
