# Spider-Man VIP Ticket System

Sistema Next.js para validar invitados VIP, reservar butacas de Sala 6 y emitir tickets con QR.

## Estructura

- `app/`: paginas y API routes de Next.js.
- `components/`: componentes cliente reutilizables.
- `lib/`: sesion, cliente Supabase, tipos, servicios y controladores.
- `model/supabase/`: schema, migraciones y plantilla de asistentes.

## Inicio local

1. Crea un proyecto en Supabase y ejecuta [model/supabase/schema.sql](./model/supabase/schema.sql) en el SQL Editor.
2. Copia `.env.example` a `.env.local` y completa las variables reales. Genera `SESSION_SECRET` con al menos 32 caracteres aleatorios y define `ADMIN_PASSWORD`.
3. Si ya habias creado la base de datos, ejecuta tambien [model/supabase/migrations/20260722_multi_seat_allowance.sql](./model/supabase/migrations/20260722_multi_seat_allowance.sql).
4. Importa los asistentes con las columnas de [model/supabase/attendees.template.csv](./model/supabase/attendees.template.csv).
5. Instala dependencias y ejecuta:

```bash
bun install
bun run dev
```

La aplicacion permite validar por `access_code` o por correo mas nombre completo. No publiques la Service Role Key. `seat_allowance` acepta de 1 a 12 asientos por invitacion.

## Panel admin

El panel privado vive en `/admin` y usa `ADMIN_PASSWORD`. Desde ahi puedes asignar una nueva butaca, mover una reserva existente, liberar asientos y validar tickets pegando la URL `/verify/...`, el hash completo o escaneando el QR con una camara compatible.

## Despliegue en Vercel

1. Crea el proyecto en Vercel desde este repositorio.
2. Configura estas Environment Variables en Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `ADMIN_PASSWORD` y `NEXT_PUBLIC_APP_URL`.
3. En produccion, `NEXT_PUBLIC_APP_URL` debe ser tu dominio final, por ejemplo `https://tu-dominio.vercel.app`.
4. Ejecuta el SQL de `model/supabase/schema.sql` y las migraciones necesarias en Supabase antes de abrir reservas.
5. Despliega con el build normal de Next.js. Vercel detecta el proyecto y usa `bun install` por el `packageManager`.
