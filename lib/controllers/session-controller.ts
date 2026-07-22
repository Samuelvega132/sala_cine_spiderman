import { NextResponse } from "next/server";
import { createSession, destroySession, getSessionAttendeeId } from "@/lib/session";
import { findAttendeeByAccessCode, findAttendeeByEmailAndName, getAttendeeById } from "@/lib/services/attendeeService";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getCurrentSessionAttendee() {
  const attendeeId = await getSessionAttendeeId();
  if (!attendeeId) {
    return null;
  }

  return getAttendeeById(attendeeId);
}

export async function GET() {
  try {
    return NextResponse.json({ attendee: await getCurrentSessionAttendee() });
  } catch {
    return error("No pudimos leer la sesion.", 500);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return error("Solicitud invalida.");
  }

  const payload = body as Record<string, unknown>;
  const accessCode = payload.accessCode;
  const email = payload.email;
  const fullName = payload.fullName;

  if (!accessCode && (!email || !fullName)) {
    return error("Ingresa tu cedula o correo con nombre completo.");
  }

  try {
    const attendee = accessCode
      ? await findAttendeeByAccessCode(accessCode)
      : await findAttendeeByEmailAndName(email, fullName);

    if (!attendee) {
      return error("No encontramos una invitacion con esos datos.", 401);
    }

    await createSession(attendee.id);
    return NextResponse.json({ attendee });
  } catch {
    return error("El servidor no esta configurado para validar invitados.", 500);
  }
}

export async function DELETE() {
  destroySession();
  return NextResponse.json({ ok: true });
}