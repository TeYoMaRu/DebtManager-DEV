-- My Money Flow - Supabase schema
-- รันไฟล์นี้ใน Supabase > SQL Editor > New query > Run

create table if not exists public.money_flow_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.money_flow_state enable row level security;

drop policy if exists "money_flow_select_own" on public.money_flow_state;
create policy "money_flow_select_own"
on public.money_flow_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "money_flow_insert_own" on public.money_flow_state;
create policy "money_flow_insert_own"
on public.money_flow_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "money_flow_update_own" on public.money_flow_state;
create policy "money_flow_update_own"
on public.money_flow_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "money_flow_delete_own" on public.money_flow_state;
create policy "money_flow_delete_own"
on public.money_flow_state
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.money_flow_state to authenticated;
