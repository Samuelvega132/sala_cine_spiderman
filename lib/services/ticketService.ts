import { createAdminSupabase } from "@/lib/supabase";
import type { Ticket } from "@/lib/types";

type TicketRow = {
  qr_code_hash: string;
  validation_code: string | null;
  seat_id: string;
  created_at: string;
  attendee: { full_name: string } | { full_name: string }[] | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
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
    validation_code: row.validation_code ?? "",
    seat_id: row.seat_id,
    created_at: row.created_at,
    attendee: { full_name: attendeeName(row) },
  };
}

function missingValidationCodeColumn(error: unknown) {
  const supabaseError = error as SupabaseErrorLike;
  return supabaseError.code === "42703" || supabaseError.message?.includes("validation_code");
}

export async function getTicketsForAttendee(attendeeId: string): Promise<Ticket[]> {
  const supabase = createAdminSupabase();
  const withValidationCode = await supabase
    .from("tickets")
    .select("qr_code_hash, validation_code, seat_id, created_at, attendee:attendees(full_name)")
    .eq("attendee_id", attendeeId)
    .order("created_at", { ascending: true })
    .order("seat_id", { ascending: true });

  if (!withValidationCode.error) {
    return ((withValidationCode.data ?? []) as TicketRow[]).map(toTicket);
  }

  if (!missingValidationCodeColumn(withValidationCode.error)) {
    throw withValidationCode.error;
  }

  const fallback = await supabase
    .from("tickets")
    .select("qr_code_hash, seat_id, created_at, attendee:attendees(full_name)")
    .eq("attendee_id", attendeeId)
    .order("created_at", { ascending: true })
    .order("seat_id", { ascending: true });

  if (fallback.error) {
    throw fallback.error;
  }

  return ((fallback.data ?? []) as Omit<TicketRow, "validation_code">[]).map(row => toTicket({ ...row, validation_code: null }));
}

export async function getTicketByHash(hash: string): Promise<Ticket | null> {
  const cleanHash = typeof hash === "string" ? hash.trim() : "";
  if (!/^[a-f0-9]{48}$/i.test(cleanHash)) {
    return null;
  }

  const supabase = createAdminSupabase();
  const withValidationCode = await supabase
    .from("tickets")
    .select("qr_code_hash, validation_code, seat_id, created_at, attendee:attendees(full_name)")
    .eq("qr_code_hash", cleanHash)
    .maybeSingle();

  if (!withValidationCode.error && withValidationCode.data) {
    return toTicket(withValidationCode.data as TicketRow);
  }

  if (withValidationCode.error && !missingValidationCodeColumn(withValidationCode.error)) {
    return null;
  }

  const fallback = await supabase
    .from("tickets")
    .select("qr_code_hash, seat_id, created_at, attendee:attendees(full_name)")
    .eq("qr_code_hash", cleanHash)
    .maybeSingle();

  if (fallback.error || !fallback.data) {
    return null;
  }

  return toTicket({ ...(fallback.data as Omit<TicketRow, "validation_code">), validation_code: null });
}
