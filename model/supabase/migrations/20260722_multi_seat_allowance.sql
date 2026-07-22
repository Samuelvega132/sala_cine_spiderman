-- Run this migration in the Supabase SQL Editor to enable group bookings.
-- It is safe when tickets already exist; existing guests receive a one-seat allowance.
begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.attendees
  add column if not exists seat_allowance smallint not null default 1
  check (seat_allowance between 1 and 12);

alter table public.tickets drop constraint if exists tickets_attendee_id_key;
create index if not exists tickets_attendee_id_idx on public.tickets(attendee_id);

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
  if v_requested_count <> (select count(distinct seat_id) from unnest(p_seat_ids) as requested_seat(seat_id)) then raise exception 'Duplicate seats selected'; end if;

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
  select p_attendee_id, seat_id, encode(extensions.gen_random_bytes(24), 'hex') from unnest(p_seat_ids) as selected_seat(seat_id);
  return true;
end;
$$;

create or replace function public.reserve_seat(p_seat_id text, p_attendee_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin return public.reserve_seats(array[p_seat_id], p_attendee_id); end;
$$;

revoke all on function public.reserve_seats(text[], uuid) from public, anon, authenticated;
grant execute on function public.reserve_seats(text[], uuid) to service_role;
commit;
