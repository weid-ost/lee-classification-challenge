-- Run this once in the Supabase SQL Editor for an existing challenge database.
-- It makes identity fields optional and enables reversible hiding and permanent deletion by admins.

alter table public.participants alter column name drop not null;
alter table public.participants alter column organisation drop not null;
alter table public.participants alter column email drop not null;
alter table public.participants add column if not exists excluded_from_dashboard boolean not null default false;

drop policy if exists "admins update participants" on public.participants;
create policy "admins update participants" on public.participants for update to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()))
 with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

drop policy if exists "admins delete participants" on public.participants;
create policy "admins delete participants" on public.participants for delete to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

drop policy if exists "admins delete events" on public.events;
create policy "admins delete events" on public.events for delete to authenticated
 using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
