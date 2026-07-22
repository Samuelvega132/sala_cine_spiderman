# Spider-Man VIP Ticket System

## Inicio

1. Crea un proyecto en Supabase y ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en el SQL Editor.
2. Copia `.env.example` a `.env.local` y completa las cuatro variables. Genera `SESSION_SECRET` con al menos 32 caracteres aleatorios.
3. Si ya habías creado la base de datos, ejecuta también [`supabase/migrations/20260722_multi_seat_allowance.sql`](./supabase/migrations/20260722_multi_seat_allowance.sql). Añade `seat_allowance` a tu CSV: es la cantidad de butacas que puede seleccionar cada invitado.
4. Importa los asistentes: exporta tu Excel como CSV usando exactamente las columnas de [`supabase/attendees.template.csv`](./supabase/attendees.template.csv), después usa **Table Editor → attendees → Import data from CSV**.
4. Instala dependencias y ejecuta: `bun install && bun run dev`.

La aplicación permite validar por cédula (`access_code`) o por correo más nombre completo. No publiques la Service Role Key. El plano incluido corresponde a Sala 6 de Multicines Mall del Pacífico y contiene las **122 butacas disponibles** para este evento. `seat_allowance` acepta de 1 a 12 asientos por invitación. Consulta [`docs/PROGRESS.md`](./docs/PROGRESS.md) para el estado del proyecto.
