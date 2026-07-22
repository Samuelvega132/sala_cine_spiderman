import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/session";
import { verifyTicketCode } from "@/lib/services/adminService";

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

  const code = (body as Record<string, unknown>).code;
  if (typeof code !== "string" || !code.trim()) {
    return error("Ingresa o escanea un codigo.");
  }

  try {
    const ticket = await verifyTicketCode(code);
    if (!ticket) {
      return error("Ticket no encontrado.", 404);
    }

    return NextResponse.json({ ticket });
  } catch (adminError) {
    console.error("Admin verify failed", adminError);
    return error("No pudimos validar el ticket.", 500);
  }
}
