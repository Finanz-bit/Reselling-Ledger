create table if not exists public.ledger_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"pieces":[],"orders":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ledger_states enable row level security;

drop policy if exists "Users can read own ledger" on public.ledger_states;
drop policy if exists "Users can insert own ledger" on public.ledger_states;
drop policy if exists "Users can update own ledger" on public.ledger_states;
drop policy if exists "Users can delete own ledger" on public.ledger_states;

create policy "Users can read own ledger"
on public.ledger_states
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own ledger"
on public.ledger_states
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own ledger"
on public.ledger_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own ledger"
on public.ledger_states
for delete
to authenticated
using (auth.uid() = user_id);
