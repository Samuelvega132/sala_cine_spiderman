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
- `qrcode.react` para generar QR
- `@zxing/browser` para escanear QR en `/validar`

## Estructura Actual
- `app/`: paginas y API routes.
- `components/`: UI cliente principal, admin, validador, tickets y mapa de asientos.
- `lib/`: sesion, Supabase, tipos, controladores y servicios.
- `model/supabase/`: schema, migraciones y CSV template de invitados.
- `view/components/vip-app.tsx`: adaptador de compatibilidad hacia `components/vip-app`.

## Base De Datos
- `attendees`: invitados, correo, cedula/codigo de acceso, cupo (`seat_allowance`) y estado de canje (`has_claimed`).
- `seats`: 122 butacas con estado `AVAILABLE` / `OCCUPIED` y `occupied_by`.
- `tickets`: entradas generadas por butaca con:
  - `qr_code_hash`: hash opaco de 48 caracteres usado en `/verify/[hash]`.
  - `validation_code`: codigo corto unico de 4 caracteres alfanumericos para ingreso manual.
  - `checked_in_at`: fecha/hora en la que el ticket fue validado en puerta; evita reutilizar el mismo ticket.
- `reserve_seats(text[], uuid)`: RPC atomica con bloqueo de fila para evitar dobles reservas.
- `generate_ticket_validation_code()`: RPC/helper que genera codigos cortos unicos evitando caracteres confusos.

## Migraciones Importantes
- `model/supabase/schema.sql`: schema completo para instalaciones nuevas.
- `model/supabase/migrations/20260722_multi_seat_allowance.sql`: habilita reservas grupales y `seat_allowance`.
- `model/supabase/migrations/20260722_short_validation_codes.sql`: agrega `validation_code`, rellena tickets existentes y actualiza la RPC de reserva.
- `model/supabase/migrations/20260722_ticket_check_in.sql`: agrega `checked_in_at` para marcar tickets ya usados.

## Rutas Publicas
- `GET /`: flujo principal para invitados.
- `GET /verify/[hash]`: pantalla visual de ticket verificado/no encontrado. Sirve para abrir la URL del QR.
- `GET /validar`: pantalla privada para el equipo de puerta. Escanea QR o valida codigo corto manual.
- `GET /admin`: panel privado para administrar invitados, reservas y asientos.

## API Publica/Invitado
- `GET /api/session`: obtiene el invitado autenticado por cookie HTTP-only.
- `POST /api/session`: valida `accessCode` o `email + fullName`, crea cookie HTTP-only.
- `DELETE /api/session`: cierra sesion de invitado.
- `GET /api/seats`: retorna estado actual de butacas.
- `POST /api/reserve`: reserva butacas via RPC atomica con `SUPABASE_SERVICE_ROLE_KEY`.
- `GET /api/ticket`: retorna tickets del invitado autenticado.

## API Admin/Validacion
- `GET /api/admin/session`: confirma si existe sesion admin.
- `POST /api/admin/session`: valida `ADMIN_PASSWORD` y crea cookie HTTP-only admin.
- `DELETE /api/admin/session`: cierra sesion admin.
- `GET /api/admin/overview`: retorna invitados, asientos y tickets para el panel.
- `POST /api/admin/seats`: permite asignar, mover o liberar butacas.
- `POST /api/admin/verify`: valida por URL `/verify/...`, hash completo o `validation_code` de 4 caracteres.

## Flujo De Invitado
1. Invitado entra en `/`.
2. Se valida con cedula/codigo VIP o correo + nombre completo.
3. Servidor crea cookie HTTP-only firmada con `SESSION_SECRET`.
4. Invitado elige asientos segun `seat_allowance`.
5. Reserva ocurre en servidor via `reserve_seats`.
6. Cada ticket muestra QR, butaca y codigo manual corto de 4 caracteres.

## Flujo De Puerta
1. Staff entra en `/validar`.
2. Inicia sesion con `ADMIN_PASSWORD`.
3. Puede escanear el QR con camara usando `@zxing/browser`.
4. Si el QR falla, escribe el codigo corto de 4 caracteres que aparece en el ticket.
5. El sistema marca el ticket como usado, muestra un modal de resultado y permite seguir validando.
6. Si el ticket ya fue usado, muestra alerta de ticket repetido.

## Flujo Admin
1. Admin entra en `/admin`.
2. Inicia sesion con `ADMIN_PASSWORD`.
3. Puede asignar una butaca nueva a un invitado.
4. Puede mover una reserva existente desde una butaca hacia otra.
5. Puede liberar una butaca, eliminando el ticket asociado.
6. Puede buscar por nombre, correo, cedula, asiento o codigo.

## Variables De Entorno
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_PASSWORD`

## Despliegue En Vercel
- Configurar todas las variables anteriores en Vercel.
- `NEXT_PUBLIC_APP_URL` debe ser el dominio final, por ejemplo `https://tu-dominio.vercel.app`.
- No subir `.env.local`.
- Ejecutar schema/migraciones en Supabase antes de abrir reservas.
- Build verificado con `bun run build`.

## Recomendaciones Pendientes
- Agregar columna `checked_in_at` a `tickets` para marcar entradas ya usadas en puerta.
- Agregar auditoria admin (`admin_audit_logs`) para registrar movimientos/liberaciones.
- Crear rol separado `VALIDATOR_PASSWORD` para staff de puerta sin permisos de mover asientos.
- Exportar CSV de reservas/invitados desde `/admin`.
- Mostrar metricas por fila/zona y conteo de ingresos reales el dia del evento.
