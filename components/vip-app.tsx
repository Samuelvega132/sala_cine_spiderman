"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LoaderCircle, LogOut, ShieldCheck, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Attendee, Seat, Ticket } from "@/lib/types";
import { SeatMap } from "@/components/seat-map";
import { TicketCollection } from "@/components/ticket-card";
import { THEATER_SEAT_COUNT } from "@/lib/theater-layout";

type Step = "auth" | "seats" | "ticket";
type LoginMode = "id" | "email";

const selectionMessage = (remaining: number) => `Selecciona ${remaining} ${remaining === 1 ? "butaca" : "butacas"} para continuar.`;

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function VipApp() {
  const [step, setStep] = useState<Step>("auth");
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<LoginMode>("id");

  const seatAllowance = attendee?.seat_allowance ?? 1;
  const remainingSeats = Math.max(0, seatAllowance - tickets.length);

  async function loadSeats() {
    const response = await fetch("/api/seats", { cache: "no-store" });
    const data = await readJson(response);

    if (!response.ok) {
      setMessage(data.error ?? "No pudimos cargar las butacas.");
      return;
    }

    if (Array.isArray(data.seats)) {
      setSeats(data.seats);
    }
  }

  async function restoreSession() {
    const [sessionResponse, ticketsResponse] = await Promise.all([
      fetch("/api/session", { cache: "no-store" }),
      fetch("/api/ticket", { cache: "no-store" }),
    ]);

    const session = await readJson(sessionResponse);
    const saved = await readJson(ticketsResponse);

    if (!sessionResponse.ok || !session.attendee) {
      return;
    }

    const savedTickets = Array.isArray(saved.tickets) ? saved.tickets : [];
    setAttendee(session.attendee);
    setTickets(savedTickets);
    setStep(savedTickets.length >= session.attendee.seat_allowance ? "ticket" : "seats");
  }

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (step !== "seats") {
      return;
    }

    void loadSeats();

    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel("seat-status")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "seats" }, payload => {
        const updatedSeat = payload.new as Seat;
        setSeats(current => current.map(seat => seat.id === updatedSeat.id ? { ...seat, status: updatedSeat.status } : seat));

        if (updatedSeat.status === "OCCUPIED") {
          setSelectedSeatIds(current => {
            if (!current.includes(updatedSeat.id)) {
              return current;
            }

            setMessage("Una de tus butacas seleccionadas acaba de ser tomada. Elige otra opcion.");
            return current.filter(id => id !== updatedSeat.id);
          });
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [step]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const body = mode === "id"
      ? { accessCode: form.get("accessCode") }
      : { email: form.get("email"), fullName: form.get("fullName") };

    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "No pudimos validar tu invitacion.");
      return;
    }

    const ticketResponse = await fetch("/api/ticket", { cache: "no-store" });
    const saved = await readJson(ticketResponse);
    const savedTickets = Array.isArray(saved.tickets) ? saved.tickets : [];

    setAttendee(data.attendee);
    setTickets(savedTickets);
    setSelectedSeatIds([]);
    setStep(savedTickets.length >= data.attendee.seat_allowance ? "ticket" : "seats");
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAttendee(null);
    setTickets([]);
    setSelectedSeatIds([]);
    setMessage("");
    setStep("auth");
  }

  function toggleSeat(seatId: string) {
    setMessage("");

    if (selectedSeatIds.includes(seatId)) {
      setSelectedSeatIds(current => current.filter(id => id !== seatId));
      return;
    }

    if (selectedSeatIds.length >= remainingSeats) {
      setMessage(`Tu invitacion permite ${seatAllowance} ${seatAllowance === 1 ? "asiento" : "asientos"}. Quita una butaca antes de elegir otra.`);
      return;
    }

    setSelectedSeatIds(current => [...current, seatId]);
  }

  async function reserve() {
    if (selectedSeatIds.length !== remainingSeats) {
      setMessage(selectionMessage(remainingSeats));
      return;
    }

    setBusy(true);
    setMessage("");

    const response = await fetch("/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatIds: selectedSeatIds }),
    });

    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setSelectedSeatIds([]);
      setMessage(data.error ?? "No pudimos confirmar la reserva.");
      void loadSeats();
      return;
    }

    setTickets(data.tickets ?? []);
    setSelectedSeatIds([]);
    setStep("ticket");
  }

  if (step === "ticket" && tickets.length) {
    return (
      <main className="min-h-screen p-4 sm:p-10">
        <header className="mx-auto mb-8 max-w-2xl text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-neon" />
          <p className="mt-3 font-bold tracking-[.28em] text-neon">VIP ACCESS CONFIRMED</p>
          <h1 className="mt-2 text-3xl font-black">Tus entradas estan listas</h1>
          <p className="mt-2 text-sm text-slate-400">Guarda un ticket PNG por cada asiento asignado.</p>
          <button type="button" onClick={logout} className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200">
            <LogOut size={16} />
            Salir
          </button>
        </header>
        <TicketCollection tickets={tickets} />
      </main>
    );
  }

  if (step === "auth") {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/85 p-7 shadow-neon">
          <div className="mb-7 text-center">
            <ShieldCheck className="mx-auto h-12 w-12 text-neon" />
            <p className="mt-4 text-xs font-bold tracking-[.25em] text-spider">MULTICINES - MANTA</p>
            <h1 className="mt-2 text-3xl font-black">Spider-Man VIP</h1>
            <p className="mt-2 text-sm text-slate-400">Reserva tu butaca para el estreno privado.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-xl bg-white/5 p-1">
            <button type="button" onClick={() => setMode("id")} className={`rounded-lg py-2 text-sm ${mode === "id" ? "bg-spider font-bold" : "text-slate-400"}`}>
              Cedula
            </button>
            <button type="button" onClick={() => setMode("email")} className={`rounded-lg py-2 text-sm ${mode === "email" ? "bg-spider font-bold" : "text-slate-400"}`}>
              Correo + nombre
            </button>
          </div>

          <form onSubmit={authenticate} className="space-y-4">
            {mode === "id" ? (
              <label className="block text-sm">
                Cedula / codigo VIP
                <input name="accessCode" inputMode="numeric" required className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon" />
              </label>
            ) : (
              <>
                <label className="block text-sm">
                  Correo electronico
                  <input name="email" type="email" required className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon" />
                </label>
                <label className="block text-sm">
                  Nombre completo
                  <input name="fullName" required className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon" />
                </label>
              </>
            )}
            <button disabled={busy} className="flex w-full justify-center rounded-xl bg-spider p-3 font-bold disabled:opacity-60">
              {busy ? <LoaderCircle className="animate-spin" /> : "Continuar"}
            </button>
          </form>

          {message && <p role="alert" className="mt-4 text-center text-sm text-amber-300">{message}</p>}
        </motion.section>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-3 sm:p-10">
      <section className="w-full rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl backdrop-blur sm:p-8">
        <header className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-bold tracking-[.25em] text-neon">HOLA, {attendee?.full_name}</p>
            <h1 className="mt-2 text-3xl font-black">Elige tus butacas</h1>
            <p className="mt-1 text-sm text-slate-400">Sala 6 - {THEATER_SEAT_COUNT} butacas disponibles para el evento.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-neon/30 bg-neon/10 px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-300">Cupo</p>
              <p className="mt-1 text-xl font-black text-neon">{selectedSeatIds.length} / {remainingSeats}</p>
            </div>
            <button type="button" onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm text-slate-200">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-slate-600" />Ocupado</span>
          <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-neon" />Seleccionado</span>
          <span className="flex items-center gap-1"><i className="h-3 w-3 rounded border border-white/40" />Libre</span>
          <span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-slate-800" />Pasillo</span>
        </div>

        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 py-2 text-center text-xs tracking-[.35em] text-slate-300">PANTALLA / SCREEN</div>
        <SeatMap seats={seats} selectedSeatIds={selectedSeatIds} onToggleSeat={toggleSeat} />

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {selectedSeatIds.length ? selectedSeatIds.map(id => (
              <button type="button" key={id} onClick={() => toggleSeat(id)} className="inline-flex items-center gap-1 rounded-lg bg-neon px-2 py-1 text-xs font-bold text-slate-950">
                {id}
                <X size={13} />
              </button>
            )) : <p className="text-sm text-slate-400">{selectionMessage(remainingSeats)}</p>}
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-4 sm:flex-row">
            <p className="text-sm text-slate-300">{selectedSeatIds.length === remainingSeats ? "Tu seleccion esta lista para confirmar." : selectionMessage(remainingSeats - selectedSeatIds.length)}</p>
            <button disabled={selectedSeatIds.length !== remainingSeats || busy} onClick={reserve} className="w-full rounded-xl bg-spider px-6 py-3 font-bold shadow-red disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {busy ? "Confirmando..." : `Confirmar ${remainingSeats} ${remainingSeats === 1 ? "asiento" : "asientos"}`}
            </button>
          </div>
        </div>

        {message && <p role="alert" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-center text-sm text-amber-200">{message}</p>}
      </section>
    </main>
  );
}