import { NextResponse } from "next/server";
import { getSessionAttendeeId } from "@/lib/session";
import { getAttendeeById } from "@/lib/services/attendeeService";
import { reserveSeatSet } from "@/lib/services/seatService";
import { getTicketsForAttendee } from "@/lib/services/ticketService";

const SEAT_ID_PATTERN = /^[A-J](?:[1-9]|1[0-8])$/;

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseSeatIds(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map(item => typeof item === "string" ? item.trim().toUpperCase() : "")
    .filter(Boolean);
}

export async function POST(request: Request) {
  const attendeeId = await getSessionAttendeeId();
  if (!attendeeId) {
    return error("Sesion requerida.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Solicitud invalida.");
  }

  const seatIds = parseSeatIds((body as Record<string, unknown>).seatIds);
  if (!seatIds?.length) {
    return error("Selecciona al menos una butaca.");
  }

  if (seatIds.length > 12) {
    return error("No puedes reservar mas de 12 butacas.");
  }

  if (new Set(seatIds).size !== seatIds.length) {
    return error("Hay butacas repetidas en la seleccion.");
  }

  if (seatIds.some(seatId => !SEAT_ID_PATTERN.test(seatId))) {
    return error("La seleccion contiene una butaca invalida.");
  }

  try {
    const attendee = await getAttendeeById(attendeeId);
    if (!attendee) {
      return error("No pudimos validar tu invitacion.", 401);
    }

    const currentTickets = await getTicketsForAttendee(attendeeId);
    if (currentTickets.length + seatIds.length > attendee.seat_allowance) {
      return error("Tu invitacion no tiene cupo para esa cantidad de butacas.", 409);
    }

    const reserved = await reserveSeatSet(attendeeId, seatIds);
    if (!reserved) {
      return error("Una de esas butacas acaba de ser tomada. Elige otra opcion.", 409);
    }

    return NextResponse.json({ tickets: await getTicketsForAttendee(attendeeId) });
  } catch (reservationError) {
    console.error("Reservation failed", reservationError);
    return error("No pudimos completar la reserva.", 500);
  }
}
