-- Supabase SQL schema for the locations table.
-- Run this once in the Supabase SQL editor, or use the table editor.

create table if not exists public.locations (
  id bigint generated always as identity primary key,
  ip text,
  latitude double precision,
  longitude double precision,
  city text,
  region text,
  country text,
  "countryCode" text,
  timezone text,
  isp text,
  "page" text,
  timestamp timestamptz default now(),
  "userAgent" text
);

alter table public.locations enable row level security;

-- Allow anon key to insert and select (needed for the web dashboard + tracking endpoint).
create policy "allow insert" on public.locations for insert with check (true);
create policy "allow select" on public.locations for select using (true);

-- Note: the app's /api/locations DELETE clears rows. The service role key
-- (server-side) bypasses RLS automatically.
