import { createAdminSupabase } from "@/lib/supabase";
import type { Seat } from "@/lib/types";

export async function listSeats(): Promise<Seat[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("seats")
    .select("id, row_label, seat_number, status")
    .order("row_label", { ascending: true })
    .order("seat_number", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Seat[];
}

export async function reserveSeatSet(attendeeId: string, seatIds: string[]) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("reserve_seats", {
    p_attendee_id: attendeeId,
    p_seat_ids: seatIds,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}
