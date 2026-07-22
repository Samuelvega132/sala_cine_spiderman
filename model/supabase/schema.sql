-- Run this file in the Supabase SQL Editor before starting the application.
create extension if not exists pgcrypto;

create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  access_code text not null unique, -- cédula, kept server-side only
  seat_allowance smallint not null default 1 check (seat_allowance between 1 and 12),
  has_claimed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.seats (
  id text primary key,
  row_label text not null,
  seat_number integer not null check (seat_number > 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'OCCUPIED')),
  occupied_by uuid references public.attendees(id),
  updated_at timestamptz not null default now(),
  unique (row_label, seat_number)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id),
  seat_id text not null unique references public.seats(id),
  qr_code_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists seats_status_idx on public.seats(status);
create index if not exists tickets_qr_code_hash_idx on public.tickets(qr_code_hash);
create index if not exists tickets_attendee_id_idx on public.tickets(attendee_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists seats_set_updated_at on public.seats;
create trigger seats_set_updated_at before update on public.seats for each row execute procedure public.set_updated_at();

-- The server invokes this with the service role. Locking the attendee serializes
-- concurrent attempts by the same guest; locking all seats makes a group booking atomic.
create or replace function public.reserve_seats(p_seat_ids text[], p_attendee_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowance smallint;
  v_existing_count integer;
  v_requested_count integer;
  v_locked_count integer;
  v_available_count integer;
begin
  if p_seat_ids is null or cardinality(p_seat_ids) = 0 then raise exception 'No seats selected'; end if;
  select count(*) into v_requested_count from unnest(p_seat_ids) as requested_seat(seat_id);
  if v_requested_count <> (select count(distinct seat_id) from unnest(p_seat_ids) as requested_seat(seat_id)) then
    raise exception 'Duplicate seats selected';
  end if;

  select seat_allowance into v_allowance from attendees where id = p_attendee_id for update;
  if not found then raise exception 'Attendee not found'; end if;
  select count(*) into v_existing_count from tickets where attendee_id = p_attendee_id;
  if v_existing_count + v_requested_count > v_allowance then raise exception 'Seat allowance exceeded'; end if;

  perform id from seats where id = any(p_seat_ids) order by id for update;
  get diagnostics v_locked_count = row_count;
  if v_locked_count <> v_requested_count then raise exception 'Seat not found'; end if;
  select count(*) into v_available_count from seats where id = any(p_seat_ids) and status = 'AVAILABLE';
  if v_available_count <> v_requested_count then return false; end if;

  update seats set status = 'OCCUPIED', occupied_by = p_attendee_id where id = any(p_seat_ids);
  update attendees set has_claimed = true where id = p_attendee_id;
  insert into tickets (attendee_id, seat_id, qr_code_hash)
  select p_attendee_id, seat_id, encode(gen_random_bytes(24), 'hex') from unnest(p_seat_ids) as selected_seat(seat_id);
  return true;
end;
$$;

-- Backwards-compatible wrapper for any previous one-seat integration.
create or replace function public.reserve_seat(p_seat_id text, p_attendee_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin return public.reserve_seats(array[p_seat_id], p_attendee_id); end;
$$;

alter table public.attendees enable row level security;
alter table public.seats enable row level security;
alter table public.tickets enable row level security;

-- Realtime clients may read seat state only; attendee and ticket records remain server-only.
drop policy if exists "public reads seat availability" on public.seats;
create policy "public reads seat availability" on public.seats for select to anon, authenticated using (true);
revoke all on public.attendees, public.tickets from anon, authenticated;
revoke all on public.seats from anon, authenticated;
grant select on public.seats to anon, authenticated;
revoke all on function public.reserve_seat(text, uuid) from public, anon, authenticated;
revoke all on function public.reserve_seats(text[], uuid) from public, anon, authenticated;
grant execute on function public.reserve_seat(text, uuid) to service_role;
grant execute on function public.reserve_seats(text[], uuid) to service_role;

-- Required for live status updates in the seat selector.
alter publication supabase_realtime add table public.seats;

-- Official visual layout: Multicines Mall del Pacífico, Sala 6 (122 seats).
-- The dark blocks in the reference session (I10, I11 and J12) were already-reserved
-- seats, so they are seeded as AVAILABLE here. Only C11-C14 and I4-I5 are aisles.
with layout(row_label, seat_numbers) as (
  values
    ('A', array[1,2,3,4,5,6,7,8,9,10,11,12,13,14]),
    ('B', array[1,2,3,4,5,6,7,8,9,10,11,12,13,14]),
    ('C', array[6,7,8,9,10,15,16]),
    ('D', array[6,7,8,9,10,11,12,13,14,15,16]),
    ('E', array[6,7,8,9,10,11,12,13,14,15,16]),
    ('F', array[6,7,8,9,10,11,12,13,14,15,16]),
    ('G', array[6,7,8,9,10,11,12,13,14,15,16]),
    ('H', array[6,7,8,9,10,11,12,13,14,15,16]),
    ('I', array[1,2,3,6,7,8,9,10,11,12,13,14,15,16]),
    ('J', array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18])
)
insert into public.seats (id, row_label, seat_number)
select row_label || seat_number, row_label, seat_number
from layout cross join lateral unnest(seat_numbers) as seat_number
on conflict (id) do nothing;
