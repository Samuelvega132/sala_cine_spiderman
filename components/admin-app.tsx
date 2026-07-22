"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Camera, CheckCircle2, LoaderCircle, LogOut, RefreshCcw, Search, ShieldCheck, Trash2, UserRoundCheck, XCircle } from "lucide-react";

type AdminAttendee = {
  id: string;
  full_name: string;
  email: string;
  access_code: string;
  seat_allowance: number;
  has_claimed: boolean;
};

type AdminSeat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: "AVAILABLE" | "OCCUPIED";
  occupied_by: string | null;
};

type AdminTicket = {
  id: string;
  attendee_id: string;
  seat_id: string;
  qr_code_hash: string;
  validation_code: string;
  created_at: string;
  attendee: { full_name: string; email: string; access_code: string } | { full_name: string; email: string; access_code: string }[] | null;
};

type VerifyTicket = {
  id: string;
  seat_id: string;
  qr_code_hash: string;
  validation_code: string;
  created_at: string;
  attendee: { full_name: string; email: string } | null;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function attendeeFromTicket(ticket: AdminTicket) {
  return Array.isArray(ticket.attendee) ? ticket.attendee[0] ?? null : ticket.attendee;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8).toUpperCase()}-${hash.slice(-6).toUpperCase()}`;
}

export function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [attendees, setAttendees] = useState<AdminAttendee[]>([]);
  const [seats, setSeats] = useState<AdminSeat[]>([]);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState("");
  const [fromSeatId, setFromSeatId] = useState("");
  const [toSeatId, setToSeatId] = useState("");
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState<VerifyTicket | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const attendeeById = useMemo(() => new Map(attendees.map(attendee => [attendee.id, attendee])), [attendees]);
  const ticketsBySeat = useMemo(() => new Map(tickets.map(ticket => [ticket.seat_id, ticket])), [tickets]);
  const reservedCount = tickets.length;
  const availableCount = seats.filter(seat => seat.status === "AVAILABLE").length;

  const filteredTickets = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return tickets;

    return tickets.filter(ticket => {
      const attendee = attendeeFromTicket(ticket);
      return [
        ticket.seat_id,
        ticket.qr_code_hash,
        attendee?.full_name,
        attendee?.email,
        attendee?.access_code,
      ].some(value => value?.toLowerCase().includes(cleanQuery));
    });
  }, [query, tickets]);

  async function loadOverview(showError = true) {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    const data = await readJson(response);

    if (!response.ok) {
      setAuthenticated(false);
      setMessage(showError ? data.error ?? "No pudimos cargar el panel." : "");
      return;
    }

    setAttendees(data.attendees ?? []);
    setSeats(data.seats ?? []);
    setTickets(data.tickets ?? []);
    setAuthenticated(true);
    setMessage("");
  }

  async function restoreAdmin() {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    const data = await readJson(response);
    if (data.admin) {
      await loadOverview(false);
    }
  }

  useEffect(() => {
    void restoreAdmin();
  }, []);

  useEffect(() => () => stopCamera(), []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.get("password") }),
    });
    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "No pudimos iniciar sesion.");
      return;
    }

    await loadOverview();
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    stopCamera();
    setAuthenticated(false);
    setTickets([]);
    setSeats([]);
    setAttendees([]);
  }

  async function assignSeat() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", attendeeId: selectedAttendeeId, fromSeatId: fromSeatId || undefined, seatId: toSeatId }),
    });
    const data = await readJson(response);
    setBusy(false);

    if (!response.ok || data.ok === false) {
      setMessage(data.error ?? data.message ?? "No pudimos asignar la butaca.");
      return;
    }

    setFromSeatId("");
    setToSeatId("");
    setMessage(data.message ?? "Butaca asignada.");
    await loadOverview();
  }

  async function releaseSeat(seatId: string) {
    if (!seatId) return;

    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/seats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release", seatId }),
    });
    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "No pudimos liberar la butaca.");
      return;
    }

    if (fromSeatId === seatId) setFromSeatId("");
    if (toSeatId === seatId) setToSeatId("");
    setMessage(data.message ?? "Butaca liberada.");
    await loadOverview();
  }

  async function verify(value = code) {
    setBusy(true);
    setMessage("");
    setVerified(null);
    const response = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setMessage(data.error ?? "Ticket no encontrado.");
      return;
    }

    setVerified(data.ticket);
    setCode(value);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    setMessage("");
    setVerified(null);

    if (!window.BarcodeDetector) {
      setMessage("Este navegador no soporta lectura QR nativa. Usa Chrome/Edge o ingresa el codigo manualmente.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return;
        const barcodes = await detector.detect(videoRef.current);
        const value = barcodes[0]?.rawValue;
        if (value) {
          stopCamera();
          await verify(value);
          return;
        }
        window.setTimeout(scan, 450);
      };

      window.setTimeout(scan, 450);
    } catch {
      setMessage("No pudimos abrir la camara. Revisa permisos del navegador.");
      stopCamera();
    }
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-neon">
          <ShieldCheck className="h-11 w-11 text-neon" />
          <h1 className="mt-4 text-2xl font-black">Administrador</h1>
          <p className="mt-2 text-sm text-slate-400">Gestion de butacas y validacion de accesos.</p>
          <label className="mt-6 block text-sm">
            Clave admin
            <input name="password" type="password" required className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon" />
          </label>
          <button disabled={busy} className="mt-4 flex w-full justify-center rounded-xl bg-spider p-3 font-bold disabled:opacity-60">
            {busy ? <LoaderCircle className="animate-spin" /> : "Entrar"}
          </button>
          {message && <p className="mt-4 text-sm text-amber-300">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-neon">Control de sala</p>
            <h1 className="mt-2 text-3xl font-black">Panel administrador</h1>
            <p className="mt-1 text-sm text-slate-400">Asigna, mueve, libera y valida tickets del estreno.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => loadOverview()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm">
              <RefreshCcw size={16} />
              Actualizar
            </button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm">
              <LogOut size={16} />
              Salir
            </button>
          </div>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Reservas" value={reservedCount} />
          <Stat label="Disponibles" value={availableCount} />
          <Stat label="Invitados" value={attendees.length} />
        </div>

        {message && <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">{message}</p>}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
            <div className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-neon" />
              <h2 className="text-xl font-black">Gestion de asientos</h2>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="text-sm md:col-span-3">
                Invitado
                <select value={selectedAttendeeId} onChange={event => setSelectedAttendeeId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon">
                  <option value="">Selecciona invitado</option>
                  {attendees.map(attendee => (
                    <option key={attendee.id} value={attendee.id}>{attendee.full_name} - {attendee.email}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                Desde
                <select value={fromSeatId} onChange={event => setFromSeatId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon">
                  <option value="">Nueva asignacion</option>
                  {tickets.map(ticket => {
                    const attendee = attendeeFromTicket(ticket);
                    return <option key={ticket.id} value={ticket.seat_id}>{ticket.seat_id} - {attendee?.full_name ?? "Invitado"}</option>;
                  })}
                </select>
              </label>

              <label className="text-sm">
                Hacia
                <select value={toSeatId} onChange={event => setToSeatId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-3 outline-none focus:border-neon">
                  <option value="">Butaca destino</option>
                  {seats.map(seat => (
                    <option key={seat.id} value={seat.id}>{seat.id} - {seat.status === "AVAILABLE" ? "Libre" : "Ocupada"}</option>
                  ))}
                </select>
              </label>

              <button disabled={busy || !selectedAttendeeId || !toSeatId} onClick={assignSeat} className="self-end rounded-xl bg-spider px-4 py-3 font-bold disabled:opacity-50">
                Asignar / mover
              </button>
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre, correo, cedula, asiento o codigo" className="w-full bg-transparent text-sm outline-none" />
            </div>

            <div className="mt-4 max-h-[44rem] overflow-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 bg-[#111827] text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3">Butaca</th>
                    <th className="p-3">Invitado</th>
                    <th className="p-3">Codigo</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map(ticket => {
                    const attendee = attendeeFromTicket(ticket);
                    return (
                      <tr key={ticket.id} className="border-t border-white/10">
                        <td className="p-3 font-black text-neon">{ticket.seat_id}</td>
                        <td className="p-3">
                          <p className="font-bold">{attendee?.full_name ?? "Invitado"}</p>
                          <p className="text-xs text-slate-400">{attendee?.email}</p>
                        </td>
                        <td className="p-3 font-mono text-lg font-black text-white">{ticket.validation_code || shortHash(ticket.qr_code_hash)}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => releaseSeat(ticket.seat_id)} className="inline-flex items-center gap-2 rounded-lg border border-red-300/30 px-3 py-2 text-xs text-red-200">
                            <Trash2 size={14} />
                            Liberar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
            <div className="flex items-center gap-2">
              <UserRoundCheck className="h-5 w-5 text-neon" />
              <h2 className="text-xl font-black">Validacion de acceso</h2>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <video ref={videoRef} muted playsInline className={`aspect-video w-full bg-black object-cover ${cameraActive ? "block" : "hidden"}`} />
              {!cameraActive && (
                <div className="grid aspect-video place-items-center text-center text-sm text-slate-400">
                  <div>
                    <Camera className="mx-auto h-9 w-9 text-slate-500" />
                    <p className="mt-2">Camara lista para escanear QR</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button onClick={cameraActive ? stopCamera : startCamera} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-bold text-slate-950">
                <Camera size={16} />
                {cameraActive ? "Detener" : "Escanear QR"}
              </button>
              <button disabled={busy || !code.trim()} onClick={() => verify()} className="rounded-xl border border-white/15 px-4 py-3 font-bold disabled:opacity-50">
                Validar codigo
              </button>
            </div>

            <textarea value={code} onChange={event => setCode(event.target.value)} placeholder="Pega aqui la URL /verify/... o el hash completo del ticket" className="mt-4 min-h-24 w-full resize-none rounded-xl border border-white/15 bg-black/30 p-3 text-sm outline-none focus:border-neon" />

            {verified && (
              <div className="mt-5 rounded-2xl border border-neon/30 bg-neon/10 p-5">
                <CheckCircle2 className="h-9 w-9 text-neon" />
                <p className="mt-3 text-xs font-bold uppercase tracking-[.18em] text-neon">Ticket valido</p>
                <h3 className="mt-1 text-2xl font-black">{verified.attendee?.full_name ?? "Invitado"}</h3>
                <p className="mt-3 text-sm text-slate-300">{verified.attendee?.email}</p>
                <p className="mt-5 text-xs uppercase tracking-widest text-slate-400">Butaca</p>
                <p className="text-6xl font-black text-neon">{verified.seat_id}</p>
                <p className="mt-4 font-mono text-2xl font-black text-white">{verified.validation_code}</p>
              </div>
            )}

            {!verified && message.includes("Ticket no encontrado") && (
              <div className="mt-5 rounded-2xl border border-red-300/30 bg-red-500/10 p-5">
                <XCircle className="h-9 w-9 text-red-200" />
                <p className="mt-3 font-bold text-red-100">Ticket no encontrado</p>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <p className="font-bold text-white">Recomendaciones para sumar luego</p>
              <p className="mt-2">Historial de cambios admin, check-in marcado como usado, exportar CSV de invitados y cupos por fila para operacion en puerta.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
      <p className="text-xs uppercase tracking-[.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}
