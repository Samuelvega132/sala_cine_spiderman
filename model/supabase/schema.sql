create extension if not exists pgcrypto with schema extensions;

create table if not exists public.attendees (
  id uuid primary key default extensions.gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  access_code text not null unique,
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
  id uuid primary key default extensions.gen_random_uuid(),
  attendee_id uuid not null references public.attendees(id),
  seat_id text not null unique references public.seats(id),
  qr_code_hash text not null unique,
  validation_code text not null unique check (validation_code ~ '^[A-Z0-9]{4}$'),
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists seats_status_idx on public.seats(status);
create index if not exists tickets_qr_code_hash_idx on public.tickets(qr_code_hash);
create index if not exists tickets_validation_code_idx on public.tickets(validation_code);
create index if not exists tickets_checked_in_at_idx on public.tickets(checked_in_at);
create index if not exists tickets_attendee_id_idx on public.tickets(attendee_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists seats_set_updated_at on public.seats;
create trigger seats_set_updated_at before update on public.seats for each row execute procedure public.set_updated_at();

create or replace function public.generate_ticket_validation_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code :=
      substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1) ||
      substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1) ||
      substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1) ||
      substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);

    exit when not exists (select 1 from tickets where validation_code = v_code);
  end loop;

  return v_code;
end;
$$;

create or replace function public.reserve_seat(p_seat_ids text[], p_attendee_id uuid)
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
  if p_seat_ids is null or cardinality(p_seat_ids) = 0 then
    raise exception 'No seats selected';
  end if;

  select count(*) into v_requested_count from unnest(p_seat_ids) as requested_seat(seat_id);

  if v_requested_count <> (select count(distinct seat_id) from unnest(p_seat_ids) as requested_seat(seat_id)) then
    raise exception 'Duplicate seats selected';
  end if;

  select seat_allowance into v_allowance from attendees where id = p_attendee_id for update;
  if not found then
    raise exception 'Attendee not found';
  end if;

  select count(*) into v_existing_count from tickets where attendee_id = p_attendee_id;
  if v_existing_count + v_requested_count > v_allowance then
    raise exception 'Seat allowance exceeded';
  end if;

  perform 1 from seats where id = any(p_seat_ids) order by id for update;
  get diagnostics v_locked_count = row_count;
  if v_locked_count <> v_requested_count then
    raise exception 'Seat not found';
  end if;

  select count(*) into v_available_count from seats where id = any(p_seat_ids) and status = 'AVAILABLE';
  if v_available_count <> v_requested_count then
    return false;
  end if;

  update seats set status = 'OCCUPIED', occupied_by = p_attendee_id where id = any(p_seat_ids);
  update attendees set has_claimed = true where id = p_attendee_id;

  insert into tickets (attendee_id, seat_id, qr_code_hash, validation_code)
  select p_attendee_id, selected_seat.seat_id, encode(extensions.gen_random_bytes(24), 'hex'), public.generate_ticket_validation_code()
  from unnest(p_seat_ids) as selected_seat(seat_id);

  return true;
end;
$$;

create or replace function public.reserve_seats(p_seat_ids text[], p_attendee_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.reserve_seat(p_seat_ids, p_attendee_id);
$$;

alter table public.attendees enable row level security;
alter table public.seats enable row level security;
alter table public.tickets enable row level security;

drop policy if exists "public reads seat availability" on public.seats;
create policy "public reads seat availability" on public.seats for select to anon, authenticated using (true);

revoke all on public.attendees, public.tickets from anon, authenticated;
revoke all on public.seats from anon, authenticated;
grant select on public.seats to anon, authenticated;

revoke all on function public.reserve_seat(text[], uuid) from public, anon, authenticated;
revoke all on function public.reserve_seats(text[], uuid) from public, anon, authenticated;
grant execute on function public.reserve_seat(text[], uuid) to service_role;
grant execute on function public.reserve_seats(text[], uuid) to service_role;

alter publication supabase_realtime add table public.seats;

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
