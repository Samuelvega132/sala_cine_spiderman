export type Seat = {
  id: string;
  row_label: string;
  seat_number: number;
  status: "AVAILABLE" | "OCCUPIED";
};

export type Attendee = {
  id: string;
  full_name: string;
  seat_allowance: number;
};

export type Ticket = {
  qr_code_hash: string;
  validation_code: string;
  seat_id: string;
  created_at: string;
  attendee: { full_name: string };
};
