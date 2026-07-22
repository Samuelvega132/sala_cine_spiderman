# CONTEXT

## Evento
Estreno privado de Spider-Man el 1 de agosto de 2026 en Multicines - Mall del Pacifico, Sala 6. El aforo de trabajo es de 122 asientos.

## Tech Stack
- Next.js 14 con App Router
- TypeScript
- Bun
- Supabase
- Tailwind CSS
- Framer Motion

## Base De Datos
- `attendees`: invitados, correo, cedula/codigo de acceso, cupo y estado de canje
- `seats`: 122 butacas de la sala con estado `AVAILABLE` / `OCCUPIED`
- `tickets`: entradas generadas por butaca con `qr_code_hash` opaco
- `reserve_seats(text[], uuid)`: RPC atomica con bloqueo de fila para evitar dobles reservas

## API
- `GET /api/session`: obtiene el invitado autenticado por cookie HTTP-only
- `POST /api/session`: valida `accessCode` o `email + fullName`, crea cookie HTTP-only
- `DELETE /api/session`: cierra sesion
- `GET /api/seats`: retorna el estado actual de las 122 butacas
- `POST /api/reserve`: reserva butacas via RPC atomica
- `GET /api/ticket`: retorna los tickets del invitado autenticado

## Flujo De Autenticacion
1. El usuario se valida con cedula o con correo + nombre completo normalizados.
2. El servidor crea una cookie HTTP-only firmada con `SESSION_SECRET`.
3. La UI consulta session y ticket usando esa cookie.
4. La reserva solo ocurre en servidor con `SUPABASE_SERVICE_ROLE_KEY`.
5. El QR expone solo el hash del ticket, no cedula ni correo.

## Notas Operativas
- Ejecutar `supabase/schema.sql` en Supabase antes de levantar la app.
- Mantener `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `SESSION_SECRET` en `.env.local`.
