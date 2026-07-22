import { createAdminSupabase } from "@/lib/supabase";
import type { Ticket } from "@/lib/types";

type TicketRow = {
  qr_code_hash: string;
  seat_id: string;
  created_at: string;
  attendee: { full_name: string } | { full_name: string }[] | null;
};

function attendeeName(row: TicketRow) {
  if (Array.isArray(row.attendee)) {
    return row.attendee[0]?.full_name ?? "Invitado";
  }

  return row.attendee?.full_name ?? "Invitado";
}

function toTicket(row: TicketRow): Ticket {
  return {
    qr_code_hash: row.qr_code_hash,
    seat_id: row.seat_id,
    created_at: row.created_at,
    attendee: { full_name: attendeeName(row) },
  };
}

export async function getTicketsForAttendee(attendeeId: string): Promise<Ticket[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("qr_code_hash, seat_id, created_at, attendee:attendees(full_name)")
    .eq("attendee_id", attendeeId)
    .order("created_at", { ascending: true })
    .order("seat_id", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TicketRow[]).map(toTicket);
}

export async function getTicketByHash(hash: string): Promise<Ticket | null> {
  const cleanHash = typeof hash === "string" ? hash.trim() : "";
  if (!/^[a-f0-9]{48}$/i.test(cleanHash)) {
    return null;
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("qr_code_hash, seat_id, created_at, attendee:attendees(full_name)")
    .eq("qr_code_hash", cleanHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toTicket(data as TicketRow);
}