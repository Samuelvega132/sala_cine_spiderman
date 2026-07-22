import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/session";
import { getAdminOverview } from "@/lib/services/adminService";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isAdminSession()) {
    return error("Sesion admin requerida.", 401);
  }

  try {
    return NextResponse.json(await getAdminOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (adminError) {
    console.error("Admin overview failed", adminError);
    return error("No pudimos cargar el panel admin.", 500);
  }
}
