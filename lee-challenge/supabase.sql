-- Run in Supabase SQL Editor. Then create your researcher account in Authentication > Users,
-- and insert its auth UUID into admin_users.
create table if not exists public.participants (
 id uuid primary key, name text, organisation text, email text,
 organisation_type text not null, country text not null, consented boolean not null default false,
 excluded_from_dashboard boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.events (
 id bigint generated always as identity primary key, participant_id uuid not null references public.participants(id),
 event_type text not null check (event_type in ('scheme','assessment','submitted')),
 image_id text, payload jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.admin_users (user_id uuid primary key);
alter table public.participants enable row level security;
alter table public.events enable row level security;
alter table public.admin_users enable row level security;
create policy "public may register" on public.participants for insert to anon with check (consented=true);
create policy "public may submit events" on public.events for insert to anon with check (true);
create policy "admins read participants" on public.participants for select to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins read events" on public.events for select to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins see own admin row" on public.admin_users for select to authenticated using (user_id=auth.uid());
create policy "admins update participants" on public.participants for update to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()))
 with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins delete participants" on public.participants for delete to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admins delete events" on public.events for delete to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
