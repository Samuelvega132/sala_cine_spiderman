import { NextResponse } from "next/server";
import { listSeats } from "@/lib/services/seatService";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      { seats: await listSeats() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return error("No pudimos cargar las butacas.", 500);
  }
}