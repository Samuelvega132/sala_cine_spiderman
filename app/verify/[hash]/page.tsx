import { Armchair, CalendarDays, CheckCircle2, Clock, MapPin, ShieldCheck, Ticket, XCircle } from "lucide-react";
import { EVENT } from "@/lib/event";
import { getTicketByHash } from "@/lib/controllers/ticket-controller";

export const dynamic = "force-dynamic";

function shortCode(hash: string) {
  return `${hash.slice(0, 8).toUpperCase()}-${hash.slice(-6).toUpperCase()}`;
}

export default async function VerifyTicketPage({ params }: { params: { hash: string } }) {
  const ticket = await getTicketByHash(params.hash);

  if (!ticket) {
    return (
      <main className="min-h-screen bg-[#070914] px-4 py-6 text-white sm:px-6 lg:px-8">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center">
          <div className="w-full overflow-hidden rounded-2xl border border-red-400/30 bg-[#10131f] shadow-2xl">
            <div className="h-2 bg-red-500" />
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-200">
                  <XCircle size={34} strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[.18em] text-red-200">Acceso no autorizado</p>
                  <h1 className="mt-1 text-2xl font-black sm:text-3xl">Ticket no encontrado</h1>
                </div>
              </div>

              <div className="mt-7 rounded-xl border border-white/10 bg-white/[.04] p-5">
                <p className="text-sm leading-6 text-slate-300">
                  El codigo escaneado no coincide con una entrada emitida. Revisa que el QR este completo o solicita apoyo al equipo de ingreso.
                </p>
                <div className="mt-5 flex items-center gap-3 rounded-lg bg-black/25 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 text-red-200" />
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-300">Verificacion privada Spider-Man VIP</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070914] px-4 py-6 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center">
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#10131f] shadow-2xl">
          <div className="grid h-2 grid-cols-[1fr_8rem]">
            <div className="bg-neon" />
            <div className="bg-spider" />
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-neon/15 text-neon">
                  <CheckCircle2 size={34} strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[.18em] text-neon">Ticket verificado</p>
                  <h1 className="mt-1 text-2xl font-black sm:text-4xl">{ticket.attendee.full_name}</h1>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-white/10 bg-white/[.04] p-5">
                <div className="flex items-center gap-3 text-slate-300">
                  <Ticket className="h-5 w-5 text-neon" />
                  <p className="text-xs font-bold uppercase tracking-[.16em]">Codigo de validacion</p>
                </div>
                <p className="mt-3 font-mono text-lg font-bold text-white sm:text-xl">{shortCode(ticket.qr_code_hash)}</p>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <MapPin className="h-5 w-5 text-neon" />
                  <span>{EVENT.venue}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <CalendarDays className="h-5 w-5 text-neon" />
                  <span>{EVENT.date}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 sm:col-span-2">
                  <Clock className="h-5 w-5 text-neon" />
                  <span>{EVENT.hours}</span>
                </div>
              </div>
            </div>

            <aside className="border-t border-white/10 bg-black/25 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="flex h-full min-h-64 flex-col justify-between rounded-2xl border border-neon/30 bg-[#07131c] p-6 shadow-neon">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">Butaca asignada</p>
                    <Armchair className="h-7 w-7 text-neon" />
                  </div>
                  <p className="mt-6 text-7xl font-black leading-none text-neon sm:text-8xl">{ticket.seat_id}</p>
                </div>

                <div className="mt-8 border-t border-white/10 pt-5">
                  <p className="text-sm font-bold text-white">{EVENT.title}</p>
                  <p className="mt-2 text-sm text-slate-400">{EVENT.city}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
