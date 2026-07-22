import { NextResponse } from "next/server";
import { getSessionAttendeeId } from "@/lib/session";
import { getTicketsForAttendee, getTicketByHash } from "@/lib/services/ticketService";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export { getTicketByHash, getTicketsForAttendee };

export async function GET() {
  const attendeeId = await getSessionAttendeeId();
  if (!attendeeId) {
    return error("Sesion requerida.", 401);
  }

  try {
    return NextResponse.json({ tickets: await getTicketsForAttendee(attendeeId) });
  } catch {
    return error("No pudimos cargar tus tickets.", 500);
  }
}