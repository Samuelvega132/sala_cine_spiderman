/**
 * Source of truth for the visual geometry of Multicines Mall del Pacifico - Sala 6.
 * `seats` are selectable positions; `gaps` are physical aisles with no seat.
 * Rows A and B are centered visually, hence their two-column offset.
 */
export type TheaterRow = {
  label: string;
  seats: number[];
  gaps: number[];
  visualOffset?: number;
};

export const THEATER_ROWS: TheaterRow[] = [
  { label: "A", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], gaps: [], visualOffset: 2 },
  { label: "B", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], gaps: [], visualOffset: 2 },
  { label: "C", seats: [6, 7, 8, 9, 10, 15, 16], gaps: [11, 12, 13, 14] },
  { label: "D", seats: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], gaps: [] },
  { label: "E", seats: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], gaps: [] },
  { label: "F", seats: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], gaps: [] },
  { label: "G", seats: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], gaps: [] },
  { label: "H", seats: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], gaps: [] },
  { label: "I", seats: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], gaps: [4, 5] },
  { label: "J", seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], gaps: [] },
];

export const THEATER_SEAT_COUNT = THEATER_ROWS.reduce((total, row) => total + row.seats.length, 0);
export const THEATER_COLUMNS = 18;