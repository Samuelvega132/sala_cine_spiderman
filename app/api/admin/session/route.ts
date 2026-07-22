import { NextResponse } from "next/server";
import { createAdminSession, destroyAdminSession, isAdminSession } from "@/lib/session";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  return NextResponse.json({ admin: await isAdminSession() });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return error("Solicitud invalida.");
  }

  const password = (body as Record<string, unknown>).password;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return error("ADMIN_PASSWORD no esta configurado.", 500);
  }

  if (typeof password !== "string" || password !== adminPassword) {
    return error("Clave de administrador incorrecta.", 401);
  }

  await createAdminSession();
  return NextResponse.json({ admin: true });
}

export async function DELETE() {
  destroyAdminSession();
  return NextResponse.json({ ok: true });
}
