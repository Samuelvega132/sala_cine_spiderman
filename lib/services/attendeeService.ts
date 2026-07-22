import { createAdminSupabase } from "@/lib/supabase";
import type { Attendee } from "@/lib/types";

const ATTENDEE_FIELDS = "id, full_name, seat_allowance";

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase()
    : "";
}

function cleanAccessCode(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function toAttendee(row: { id: string; full_name: string; seat_allowance: number | null }): Attendee {
  return {
    id: row.id,
    full_name: row.full_name,
    seat_allowance: Number(row.seat_allowance || 1),
  };
}

export function normalizeText(value: unknown) {
  return cleanText(value);
}

export function normalizeEmail(value: unknown) {
  return cleanText(value);
}

export async function getAttendeeById(attendeeId: string): Promise<Attendee | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("attendees")
    .select(ATTENDEE_FIELDS)
    .eq("id", attendeeId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toAttendee(data);
}

export async function findAttendeeByAccessCode(accessCode: unknown): Promise<Attendee | null> {
  const normalizedAccessCode = cleanAccessCode(accessCode);
  if (!normalizedAccessCode) {
    return null;
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("attendees")
    .select(ATTENDEE_FIELDS)
    .eq("access_code", normalizedAccessCode)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toAttendee(data);
}

export async function findAttendeeByEmailAndName(email: unknown, fullName: unknown): Promise<Attendee | null> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedFullName = normalizeText(fullName);

  if (!normalizedEmail || !normalizedFullName) {
    return null;
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("attendees")
    .select(ATTENDEE_FIELDS)
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (normalizeText(data.full_name) !== normalizedFullName) {
    return null;
  }

  return toAttendee(data);
}