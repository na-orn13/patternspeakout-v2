-- Run this in Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/wtchyduomagzkyexysub/sql/new

-- ===== app_users table =====
-- Stores registered users (NOT the Supabase auth.users — we manage our own)
create table if not exists public.app_users (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null unique,
  password_hash text not null,
  display_name text not null default '',
  role        text not null default 'user' check (role in ('admin', 'user')),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'removed')),
  expires_at  timestamptz,  -- NULL = no expiry; set a date to auto-remove
  created_at  timestamptz not null default now()
);

-- Index for login queries
create index if not exists app_users_email_idx on public.app_users (email);

-- ===== favourites table =====
-- Links users to their saved idioms
create table if not exists public.favourites (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.app_users(id) on delete cascade,
  tiktok_id   text not null,
  created_at  timestamptz not null default now(),
  unique(user_id, tiktok_id)
);

create index if not exists favourites_user_idx on public.favourites (user_id);

-- ===== RLS policies =====
alter table public.app_users enable row level security;
alter table public.favourites enable row level security;

-- Service role bypasses RLS, so our API routes work fine.
-- Public read for app_users is NOT needed (only server reads them).
-- Public read for favourites is NOT needed (only server reads them).
