create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  selected_champion_team text not null,
  status text not null default 'active' check (status in ('active', 'eliminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_status_idx on public.participants (status);
create index if not exists participants_selected_champion_team_idx
  on public.participants (selected_champion_team);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists participants_set_updated_at on public.participants;

create trigger participants_set_updated_at
before update on public.participants
for each row
execute function public.set_updated_at();

alter table public.participants enable row level security;

-- Public users need read access. Write access is protected in the app by the
-- local admin password for this prototype. For production, replace write
-- policies with Supabase Auth/Firebase Auth backed admin roles.
drop policy if exists "Public can read participants" on public.participants;
create policy "Public can read participants"
on public.participants
for select
using (true);

drop policy if exists "Prototype admin writes through app" on public.participants;
create policy "Prototype admin writes through app"
on public.participants
for all
using (true)
with check (true);
