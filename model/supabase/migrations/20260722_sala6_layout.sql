-- Use this migration ONLY when the former provisional 122-seat seed was already run.
-- It intentionally stops if a reservation exists, so historical tickets are never lost.
begin;

do $$
begin
  if exists (select 1 from public.tickets) or exists (select 1 from public.attendees where has_claimed) then
    raise exception 'Sala 6 migration aborted: reservations already exist. Do not replace a live layout.';
  end if;
end;
$$;

delete from public.seats;

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
from layout cross join lateral unnest(seat_numbers) as seat_number;

commit;
