-- Run this migration to add short 4-character manual validation codes.
begin;

create extension if not exists pgcrypto with schema extensions;

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

    exit when not exists (select 1 from public.tickets where validation_code = v_code);
  end loop;

  return v_code;
end;
$$;

alter table public.tickets add column if not exists validation_code text;

update public.tickets
set validation_code = public.generate_ticket_validation_code()
where validation_code is null or validation_code !~ '^[A-Z0-9]{4}$';

alter table public.tickets
  alter column validation_code set not null;

alter table public.tickets
  drop constraint if exists tickets_validation_code_check;

alter table public.tickets
  add constraint tickets_validation_code_check check (validation_code ~ '^[A-Z0-9]{4}$');

create unique index if not exists tickets_validation_code_key on public.tickets(validation_code);
create index if not exists tickets_validation_code_idx on public.tickets(validation_code);

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
  insert into tickets (attendee_id, seat_id, qr_code_hash, validation_code)
  select p_attendee_id, seat_id, encode(extensions.gen_random_bytes(24), 'hex'), public.generate_ticket_validation_code()
  from unnest(p_seat_ids) as selected_seat(seat_id);
  return true;
end;
$$;

revoke all on function public.generate_ticket_validation_code() from public, anon, authenticated;
revoke all on function public.reserve_seats(text[], uuid) from public, anon, authenticated;
grant execute on function public.reserve_seats(text[], uuid) to service_role;

commit;
