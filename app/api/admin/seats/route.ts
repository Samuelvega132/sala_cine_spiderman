import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/session";
import { assignSeatToAttendee, releaseSeat } from "@/lib/services/adminService";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!await isAdminSession()) {
    return error("Sesion admin requerida.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Solicitud invalida.");
  }

  const payload = body as Record<string, unknown>;
  const action = payload.action;
  const seatId = typeof payload.seatId === "string" ? payload.seatId : "";

  if (!seatId) {
    return error("Selecciona una butaca.");
  }

  try {
    if (action === "release") {
      return NextResponse.json(await releaseSeat(seatId));
    }

    if (action === "assign") {
      const attendeeId = typeof payload.attendeeId === "string" ? payload.attendeeId : "";
      const fromSeatId = typeof payload.fromSeatId === "string" ? payload.fromSeatId : undefined;

      if (!attendeeId) {
        return error("Selecciona un invitado.");
      }

      const result = await assignSeatToAttendee(attendeeId, seatId, fromSeatId);
      return NextResponse.json(result, { status: result.ok ? 200 : 409 });
    }

    return error("Accion no soportada.");
  } catch (adminError) {
    console.error("Admin seat action failed", adminError);
    return error("No pudimos actualizar la butaca.", 500);
  }
}
