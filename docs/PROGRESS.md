# Estado del proyecto

Actualizado: 22 de julio de 2026.

## Hecho

- Aplicación Next.js 14, TypeScript, Tailwind, Framer Motion y componentes organizados por responsabilidad.
- Validación de invitado por cédula o por correo más nombre, con sesión HTTP-only firmada.
- SQL de Supabase con RLS, cupos por invitado y RPC transaccional que evita dobles reservas, incluso para grupos.
- Mapa responsivo con actualizaciones Realtime, selección/desselección, aviso de conflicto y navegación táctil horizontal/vertical.
- Plano oficial de Sala 6 modelado en `lib/theater-layout.ts` y en el seed SQL.
- Ticket visual con QR, descarga PNG con contingencia para Safari y página pública de verificación.
- Plantilla CSV e instrucciones de importación.

## Dato confirmado del plano

El plano se configuró con 122 butacas disponibles para el evento: A 14, B 14, C 7, D 11, E 11, F 11, G 11, H 11, I 14 y J 18. Los únicos asientos reservados en la captura de referencia eran I10, I11 y J12; aquí se crean disponibles. C11–C14 e I4–I5 permanecen como pasillos físicos sin butaca.

## Pendiente antes de publicar

1. En la base de datos actual, ejecutar `supabase/migrations/20260722_multi_seat_allowance.sql`. Esta migración es obligatoria para corregir la reserva y habilitar grupos.
2. Asignar `seat_allowance` a cada asistente antes de abrir el enlace. Ejemplo: `update attendees set seat_allowance = 3 where access_code = '0999999999';`.
3. Si aún no se ejecutó ningún seed, crear el proyecto Supabase y ejecutar `supabase/schema.sql` una sola vez. Si solo debes corregir un seed antiguo de sala y no hay reservas, ejecuta después `supabase/migrations/20260722_sala6_layout.sql`.
4. Completar `.env.local` con las claves reales, una URL final y `SESSION_SECRET` aleatorio.
5. Exportar los asistentes a CSV e importarlos en `attendees`.
6. Probar con dos navegadores la colisión de una misma butaca y revisar la actualización Realtime.
7. Probar descarga PNG y lectura del QR en iPhone/Android reales.
8. Configurar las variables en Vercel, desplegar y ejecutar una reserva de prueba antes de abrir el enlace.

## Fuera del MVP actual

- Panel de administración e importador web de asistentes.
- Check-in único y auditoría de ingreso en puerta.
- Hold temporal de butaca antes de confirmar.
