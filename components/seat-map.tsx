"use client";

import { Armchair } from "lucide-react";
import { useMemo } from "react";
import { THEATER_COLUMNS, THEATER_ROWS } from "@/lib/theater-layout";
import type { Seat } from "@/lib/types";

type SeatMapProps = {
  seats: Seat[];
  selectedSeatIds: string[];
  onToggleSeat: (seatId: string) => void;
};

export function SeatMap({ seats, selectedSeatIds, onToggleSeat }: SeatMapProps) {
  const seatsById = useMemo(() => new Map(seats.map(seat => [seat.id, seat])), [seats]);

  return (
    <div className="touch-pan-x touch-pan-y max-h-[57vh] overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-5">
      <div className="mx-auto min-w-[740px] space-y-2.5 sm:min-w-[900px] sm:space-y-3">
        {THEATER_ROWS.map(row => {
          const offset = row.visualOffset ?? 0;

          return (
            <div key={row.label} className="grid grid-cols-[20px_repeat(18,34px)] items-center gap-1.5 sm:grid-cols-[24px_repeat(18,40px)] sm:gap-2">
              <span className="text-center text-xs font-bold text-slate-500">{row.label}</span>
              {Array.from({ length: THEATER_COLUMNS }, (_, index) => {
                const column = index + 1;
                const seatNumber = row.seats.find(number => number + offset === column);
                const seat = seatNumber ? seatsById.get(`${row.label}${seatNumber}`) : undefined;
                const isGap = row.gaps.includes(column - offset);

                if (seat) {
                  const selected = selectedSeatIds.includes(seat.id);
                  return (
                    <button
                      key={column}
                      type="button"
                      disabled={seat.status === "OCCUPIED"}
                      aria-pressed={selected}
                      onClick={() => onToggleSeat(seat.id)}
                      className={`grid h-[34px] w-[34px] place-items-center rounded-t-lg border text-[10px] font-bold transition sm:h-10 sm:w-10 sm:rounded-t-xl sm:text-xs ${seat.status === "OCCUPIED" ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500" : selected ? "border-neon bg-neon text-slate-950 shadow-neon" : "border-white/30 bg-white/5 hover:border-spider hover:bg-spider/30"}`}
                      aria-label={`Butaca ${seat.id}`}
                    >
                      <Armchair size={15} />
                      <span className="sr-only">{seat.id}</span>
                    </button>
                  );
                }

                if (isGap) {
                  return <span key={column} aria-label="Pasillo" className="h-[34px] w-[34px] rounded bg-slate-800/90 sm:h-10 sm:w-10" />;
                }

                return <span key={column} className="h-[34px] w-[34px] sm:h-10 sm:w-10" />;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}