"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, CheckCircle2, Keyboard, LoaderCircle, LogOut, ShieldCheck, XCircle } from "lucide-react";

type VerifyTicket = {
  id: string;
  seat_id: string;
  qr_code_hash: string;
  validation_code: string;
  checked_in_at: string | null;
  status: "VALIDATED" | "USED";
  created_at: string;
  attendee: { full_name: string; email: string } | null;
};

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function cleanManualCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 48);
}

export function ValidatorApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<VerifyTicket | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [lastFailed, setLastFailed] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  async function restoreSession() {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    const data = await readJson(response);
    setAuthenticated(Boolean(data.admin));
  }

  useEffect(() => {
    void restoreSession();
    return () => stopCamera();
  }, []);

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

    setAuthenticated(true);
  }

  async function logout() {
    stopCamera();
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setTicket(null);
    setResultOpen(false);
    setCode("");
  }

  async function validate(value = code) {
    const cleanValue = value.trim();
    if (!cleanValue) {
      setMessage("Ingresa o escanea un codigo.");
      return;
    }

    setBusy(true);
    setMessage("");
    setTicket(null);
    setLastFailed("");
    const response = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: cleanValue }),
    });
    const data = await readJson(response);
    setBusy(false);

    if (!response.ok) {
      setLastFailed(data.error ?? "Ticket no encontrado.");
      setResultOpen(true);
      return;
    }

    setTicket(data.ticket);
    setCode(data.ticket.validation_code ?? cleanValue);
    setResultOpen(true);
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setMessage("");
    setTicket(null);

    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, result => {
        const text = result?.getText();
        if (!text) return;
        stopCamera();
        void validate(text);
      });
      controlsRef.current = controls;
      setCameraActive(true);
    } catch {
      setMessage("No pudimos abrir la camara. Revisa permisos o usa el codigo de 4 caracteres.");
      stopCamera();
    }
  }

  function resetForNextScan() {
    setResultOpen(false);
    setTicket(null);
    setLastFailed("");
    setCode("");
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center p-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-neon">
          <ShieldCheck className="h-11 w-11 text-neon" />
          <h1 className="mt-4 text-2xl font-black">Validar acceso</h1>
          <p className="mt-2 text-sm text-slate-400">Ingreso del equipo de puerta para escanear QR o codigo corto.</p>
          <label className="mt-6 block text-sm">
            Clave
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
    <main className="min-h-screen bg-[#070914] p-4 text-white sm:p-6">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-5xl items-center gap-6 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-neon">Control de ingreso</p>
              <h1 className="mt-2 text-3xl font-black">Validar acceso</h1>
            </div>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm">
              <LogOut size={16} />
              Salir
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black">
            <video ref={videoRef} muted playsInline className={`aspect-[3/4] w-full object-cover sm:aspect-video ${cameraActive ? "block" : "hidden"}`} />
            {!cameraActive && (
              <div className="grid aspect-[3/4] place-items-center text-center text-slate-400 sm:aspect-video">
                <div>
                  <Camera className="mx-auto h-11 w-11 text-slate-500" />
                  <p className="mt-2 text-sm">Camara lista</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button onClick={cameraActive ? stopCamera : startCamera} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neon px-4 py-3 font-bold text-slate-950">
              <Camera size={18} />
              {cameraActive ? "Detener camara" : "Escanear QR"}
            </button>
            <button disabled={busy || !code.trim()} onClick={() => validate()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 font-bold disabled:opacity-50">
              <Keyboard size={18} />
              Validar codigo
            </button>
          </div>

          <label className="mt-4 block text-sm">
            Codigo manual
            <input value={code} onChange={event => setCode(cleanManualCode(event.target.value))} placeholder="Ej. A7K2" className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 p-4 text-center font-mono text-3xl font-black uppercase tracking-[.25em] outline-none focus:border-neon" />
          </label>
          <p className="mt-2 text-xs text-slate-500">Tambien acepta URL completa o hash del QR.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
          {ticket ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-neon" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-neon">Ticket valido</p>
              <h2 className="mt-3 text-4xl font-black">{ticket.attendee?.full_name ?? "Invitado"}</h2>
              <p className="mt-2 text-slate-400">{ticket.attendee?.email}</p>
              <div className="mt-8 rounded-2xl border border-neon/30 bg-neon/10 p-6">
                <p className="text-xs uppercase tracking-[.18em] text-slate-300">Butaca</p>
                <p className="mt-2 text-8xl font-black leading-none text-neon">{ticket.seat_id}</p>
                <p className="mt-6 text-xs uppercase tracking-[.18em] text-slate-300">Codigo</p>
                <p className="mt-2 font-mono text-5xl font-black tracking-[.18em] text-white">{ticket.validation_code}</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-96 place-items-center text-center">
              <div>
                {message ? <XCircle className="mx-auto h-16 w-16 text-red-200" /> : <ShieldCheck className="mx-auto h-16 w-16 text-slate-600" />}
                <h2 className="mt-5 text-2xl font-black">{message ? "No autorizado" : "Esperando validacion"}</h2>
                <p className={`mt-3 max-w-sm text-sm ${message ? "text-red-100" : "text-slate-400"}`}>{message || "Escanea el QR o escribe el codigo corto de 4 caracteres que aparece en el ticket."}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {resultOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <section className={`w-full max-w-md overflow-hidden rounded-2xl border bg-[#10131f] shadow-2xl ${ticket?.status === "VALIDATED" ? "border-neon/40" : ticket?.status === "USED" ? "border-amber-300/40" : "border-red-300/40"}`}>
            <div className={`h-2 ${ticket?.status === "VALIDATED" ? "bg-neon" : ticket?.status === "USED" ? "bg-amber-300" : "bg-red-400"}`} />
            <div className="p-6 text-center">
              {ticket?.status === "VALIDATED" && <CheckCircle2 className="mx-auto h-16 w-16 text-neon" />}
              {ticket?.status === "USED" && <XCircle className="mx-auto h-16 w-16 text-amber-200" />}
              {!ticket && <XCircle className="mx-auto h-16 w-16 text-red-200" />}

              <p className={`mt-4 text-xs font-bold uppercase tracking-[.2em] ${ticket?.status === "VALIDATED" ? "text-neon" : ticket?.status === "USED" ? "text-amber-200" : "text-red-200"}`}>
                {ticket?.status === "VALIDATED" ? "Acceso validado" : ticket?.status === "USED" ? "Ticket ya usado" : "No autorizado"}
              </p>

              <h2 className="mt-3 text-3xl font-black">{ticket?.attendee?.full_name ?? (ticket ? "Invitado" : "Ticket no encontrado")}</h2>
              {ticket?.attendee?.email && <p className="mt-2 text-sm text-slate-400">{ticket.attendee.email}</p>}

              {ticket ? (
                <div className={`mt-6 rounded-2xl border p-5 ${ticket.status === "VALIDATED" ? "border-neon/30 bg-neon/10" : "border-amber-300/30 bg-amber-300/10"}`}>
                  <p className="text-xs uppercase tracking-[.18em] text-slate-300">Butaca</p>
                  <p className={`mt-2 text-7xl font-black leading-none ${ticket.status === "VALIDATED" ? "text-neon" : "text-amber-200"}`}>{ticket.seat_id}</p>
                  <p className="mt-5 text-xs uppercase tracking-[.18em] text-slate-300">Codigo</p>
                  <p className="mt-1 font-mono text-4xl font-black tracking-[.18em] text-white">{ticket.validation_code}</p>
                  {ticket.status === "USED" && <p className="mt-4 text-sm text-amber-100">Este ticket ya habia sido validado antes.</p>}
                </div>
              ) : (
                <p className="mt-5 rounded-xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">{lastFailed}</p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button onClick={resetForNextScan} className="rounded-xl bg-spider px-4 py-3 font-bold">
                  Continuar
                </button>
                <button onClick={() => { resetForNextScan(); void startCamera(); }} className="rounded-xl border border-white/15 px-4 py-3 font-bold">
                  Escanear otro
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
