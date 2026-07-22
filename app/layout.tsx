import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spider-Man VIP | Reserva de butacas",
  description: "Sistema privado de reserva de butacas para invitados VIP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
