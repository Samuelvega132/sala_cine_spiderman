import { createAdminSupabase } from "@/lib/supabase";

export type AdminSeat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: "AVAILABLE" | "OCCUPIED";
  occupied_by: string | null;
};

export type AdminTicket = {
  id: string;
  attendee_id: string;
  seat_id: string;
  qr_code_hash: string;
  created_at: string;
  attendee: { full_name: string; email: string; access_code: string } | { full_name: string; email: string; access_code: string }[] | null;
};

export type AdminAttendee = {
  id: string;
  full_name: string;
  email: string;
  access_code: string;
  seat_allowance: number;
  has_claimed: boolean;
};

type VerifyRow = {
  id: string;
  attendee_id: string;
  seat_id: string;
  qr_code_hash: string;
  created_at: string;
  attendee: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

function firstAttendee<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getAdminOverview() {
  const supabase = createAdminSupabase();
  const [attendees, seats, tickets] = await Promise.all([
    supabase
      .from("attendees")
      .select("id, full_name, email, access_code, seat_allowance, has_claimed")
      .order("full_name", { ascending: true }),
    supabase
      .from("seats")
      .select("id, row_label, seat_number, status, occupied_by")
      .order("row_label", { ascending: true })
      .order("seat_number", { ascending: true }),
    supabase
      .from("tickets")
      .select("id, attendee_id, seat_id, qr_code_hash, created_at, attendee:attendees(full_name, email, access_code)")
      .order("created_at", { ascending: false }),
  ]);

  if (attendees.error) throw attendees.error;
  if (seats.error) throw seats.error;
  if (tickets.error) throw tickets.error;

  return {
    attendees: (attendees.data ?? []) as AdminAttendee[],
    seats: (seats.data ?? []) as AdminSeat[],
    tickets: (tickets.data ?? []) as AdminTicket[],
  };
}

export async function assignSeatToAttendee(attendeeId: string, seatId: string, fromSeatId?: string) {
  const supabase = createAdminSupabase();
  const normalizedSeatId = seatId.trim().toUpperCase();
  const normalizedFromSeatId = fromSeatId?.trim().toUpperCase();

  const { data: seat, error: seatError } = await supabase
    .from("seats")
    .select("id, status")
    .eq("id", normalizedSeatId)
    .maybeSingle();

  if (seatError) throw seatError;
  if (!seat) return { ok: false, message: "La butaca destino no existe." };
  if (seat.status === "OCCUPIED" && normalizedSeatId !== normalizedFromSeatId) {
    return { ok: false, message: "La butaca destino ya esta ocupada. Liberala antes de asignarla." };
  }

  if (normalizedFromSeatId) {
    const { data: existingTicket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, attendee_id")
      .eq("seat_id", normalizedFromSeatId)
      .maybeSingle();

    if (ticketError) throw ticketError;
    if (!existingTicket) return { ok: false, message: "No hay ticket en la butaca origen." };

    const { error: updateTicketError } = await supabase
      .from("tickets")
      .update({ attendee_id: attendeeId, seat_id: normalizedSeatId })
      .eq("id", existingTicket.id);

    if (updateTicketError) throw updateTicketError;

    if (normalizedFromSeatId !== normalizedSeatId) {
      const { error: clearOldSeatError } = await supabase
        .from("seats")
        .update({ status: "AVAILABLE", occupied_by: null })
        .eq("id", normalizedFromSeatId);

      if (clearOldSeatError) throw clearOldSeatError;
    }
  } else {
    const { error: insertError } = await supabase
      .from("tickets")
      .insert({
        attendee_id: attendeeId,
        seat_id: normalizedSeatId,
        qr_code_hash: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      });

    if (insertError) throw insertError;
  }

  const { error: updateSeatError } = await supabase
    .from("seats")
    .update({ status: "OCCUPIED", occupied_by: attendeeId })
    .eq("id", normalizedSeatId);

  if (updateSeatError) throw updateSeatError;

  const { error: attendeeError } = await supabase
    .from("attendees")
    .update({ has_claimed: true })
    .eq("id", attendeeId);

  if (attendeeError) throw attendeeError;

  return { ok: true, message: "Butaca asignada." };
}

export async function releaseSeat(seatId: string) {
  const supabase = createAdminSupabase();
  const normalizedSeatId = seatId.trim().toUpperCase();

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("attendee_id")
    .eq("seat_id", normalizedSeatId)
    .maybeSingle();

  if (ticketError) throw ticketError;

  const { error: deleteError } = await supabase.from("tickets").delete().eq("seat_id", normalizedSeatId);
  if (deleteError) throw deleteError;

  const { error: seatError } = await supabase
    .from("seats")
    .update({ status: "AVAILABLE", occupied_by: null })
    .eq("id", normalizedSeatId);

  if (seatError) throw seatError;

  if (ticket?.attendee_id) {
    const { count, error: countError } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("attendee_id", ticket.attendee_id);

    if (countError) throw countError;

    if (!count) {
      const { error: attendeeError } = await supabase
        .from("attendees")
        .update({ has_claimed: false })
        .eq("id", ticket.attendee_id);

      if (attendeeError) throw attendeeError;
    }
  }

  return { ok: true, message: "Butaca liberada." };
}

export async function verifyTicketCode(input: string) {
  const hash = input.trim().split("/verify/").pop()?.split(/[?#]/)[0]?.trim() ?? "";
  if (!/^[a-f0-9]{48}$/i.test(hash)) {
    return null;
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, attendee_id, seat_id, qr_code_hash, created_at, attendee:attendees(full_name, email)")
    .eq("qr_code_hash", hash)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as VerifyRow;
  return {
    id: row.id,
    attendee_id: row.attendee_id,
    seat_id: row.seat_id,
    qr_code_hash: row.qr_code_hash,
    created_at: row.created_at,
    attendee: firstAttendee(row.attendee),
  };
}
