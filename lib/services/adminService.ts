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
  validation_code: string;
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
  validation_code: string;
  created_at: string;
  attendee: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

function firstAttendee<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function makeValidationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function missingValidationCodeColumn(error: unknown) {
  const supabaseError = error as SupabaseErrorLike;
  return supabaseError.code === "42703" || supabaseError.message?.includes("validation_code");
}

async function listAdminTickets() {
  const supabase = createAdminSupabase();
  const withValidationCode = await supabase
    .from("tickets")
    .select("id, attendee_id, seat_id, qr_code_hash, validation_code, created_at, attendee:attendees(full_name, email, access_code)")
    .order("created_at", { ascending: false });

  if (!withValidationCode.error) {
    return (withValidationCode.data ?? []) as AdminTicket[];
  }

  if (!missingValidationCodeColumn(withValidationCode.error)) {
    throw withValidationCode.error;
  }

  const fallback = await supabase
    .from("tickets")
    .select("id, attendee_id, seat_id, qr_code_hash, created_at, attendee:attendees(full_name, email, access_code)")
    .order("created_at", { ascending: false });

  if (fallback.error) throw fallback.error;

  return ((fallback.data ?? []) as Omit<AdminTicket, "validation_code">[]).map(ticket => ({
    ...ticket,
    validation_code: "",
  }));
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
    listAdminTickets(),
  ]);

  if (attendees.error) throw attendees.error;
  if (seats.error) throw seats.error;

  return {
    attendees: (attendees.data ?? []) as AdminAttendee[],
    seats: (seats.data ?? []) as AdminSeat[],
    tickets,
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
    let insertError: unknown = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { error } = await supabase
        .from("tickets")
        .insert({
          attendee_id: attendeeId,
          seat_id: normalizedSeatId,
          qr_code_hash: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          validation_code: makeValidationCode(),
        });

      if (!error) {
        insertError = null;
        break;
      }

      insertError = error;
    }

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
  const cleanInput = input.trim();
  const hash = cleanInput.split("/verify/").pop()?.split(/[?#]/)[0]?.trim() ?? "";
  const validationCode = cleanInput.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!/^[a-f0-9]{48}$/i.test(hash) && !/^[A-Z0-9]{4}$/.test(validationCode)) {
    return null;
  }

  const supabase = createAdminSupabase();
  let query = supabase
    .from("tickets")
    .select("id, attendee_id, seat_id, qr_code_hash, validation_code, created_at, attendee:attendees(full_name, email)");

  query = /^[a-f0-9]{48}$/i.test(hash)
    ? query.eq("qr_code_hash", hash)
    : query.eq("validation_code", validationCode);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as VerifyRow;
  return {
    id: row.id,
    attendee_id: row.attendee_id,
    seat_id: row.seat_id,
    qr_code_hash: row.qr_code_hash,
    validation_code: row.validation_code,
    created_at: row.created_at,
    attendee: firstAttendee(row.attendee),
  };
}
