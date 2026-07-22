-- Run this migration to prevent a ticket from being validated more than once.
begin;

alter table public.tickets add column if not exists checked_in_at timestamptz;
create index if not exists tickets_checked_in_at_idx on public.tickets(checked_in_at);

commit;
