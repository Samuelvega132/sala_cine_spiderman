"use client";

import { useMemo, useRef, useState } from "react";
import { Download, ExternalLink, TicketCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { EVENT } from "@/lib/event";
import type { Ticket } from "@/lib/types";

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const verifyUrl = useMemo(() => {
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
    const origin = configuredOrigin || (typeof window === "undefined" ? "" : window.location.origin);
    return `${origin}/verify/${ticket.qr_code_hash}`;
  }, [ticket.qr_code_hash]);

  async function download() {
    try {
      setError("");
      if (!ref.current) return;

      const dataUrl = await toPng(ref.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
        imagePlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
      });

      const link = document.createElement("a");
      link.download = `spider-man-vip-${ticket.seat_id}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("No pudimos generar la descarga. Abre el ticket y guardalo como imagen.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-md text-center">
      <div ref={ref} className="ticket-cut overflow-hidden rounded-3xl border border-neon/40 bg-[#090b15] p-1 text-left shadow-neon">
        <div className="rounded-[22px] bg-gradient-to-br from-[#11152a] via-[#080912] to-[#25060a] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-[.25em] text-neon">PRIVATE SCREENING</p>
              <h2 className="mt-2 text-3xl font-black italic tracking-tight text-white">SPIDER-MAN</h2>
            </div>
            <TicketCheck className="h-9 w-9 text-spider" />
          </div>

          <div className="my-6 border-t border-dashed border-white/30" />

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <p className="text-lg font-bold">{ticket.attendee.full_name}</p>
              <p className="text-sm text-slate-300">{EVENT.venue}</p>
              <p className="text-sm text-slate-300">{EVENT.date}</p>
              <p className="text-sm text-slate-300">{EVENT.hours}</p>
              <p className="pt-2 text-xs uppercase tracking-widest text-slate-400">Seat / Butaca</p>
              <p className="text-4xl font-black text-neon">{ticket.seat_id}</p>
            </div>

            <div className="self-end rounded-xl bg-white p-2">
              <QRCodeSVG value={verifyUrl} size={112} level="M" includeMargin />
            </div>
          </div>

          <p className="mt-5 text-[10px] uppercase tracking-[.16em] text-slate-500">Issued: {new Date(ticket.created_at).toLocaleString("es-EC")}</p>
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-3">
        <button onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-spider px-5 py-3 font-bold text-white shadow-red">
          <Download size={18} />
          Descargar PNG
        </button>
        <a href={verifyUrl} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm" rel="noreferrer">
          <ExternalLink size={16} />
          Abrir
        </a>
      </div>

      {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
    </section>
  );
}

export function TicketCollection({ tickets }: { tickets: Ticket[] }) {
  return <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">{tickets.map(ticket => <TicketCard key={ticket.qr_code_hash} ticket={ticket} />)}</div>;
}
