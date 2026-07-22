# Estado del proyecto

Actualizado: 22 de julio de 2026.

## Hecho

- Aplicacion Next.js 14 con TypeScript, Tailwind, Framer Motion y estructura MVC.
- Capa `view/app` restaurada con layout, pagina principal, estilos globales y pagina publica de verificacion.
- Endpoints API conectados a controladores en `controller/`.
- Validacion de invitado por cedula/codigo o por correo mas nombre, con sesion HTTP-only firmada.
- SQL de Supabase con RLS, cupos por invitado y RPC transaccional para evitar dobles reservas.
- Mapa responsivo con actualizaciones Realtime, seleccion multiple y aviso de conflicto.
- Plano oficial de Sala 6 modelado en `model/lib/theater-layout.ts` y en el seed SQL.
- Ticket visual con QR y descarga PNG.
- Plantilla CSV e instrucciones de importacion.

## Dato confirmado del plano

El plano se configuro con 122 butacas disponibles para el evento: A 14, B 14, C 7, D 11, E 11, F 11, G 11, H 11, I 14 y J 18. C11-C14 e I4-I5 son pasillos fisicos sin butaca.

## Pendiente antes de publicar

1. En la base de datos actual, ejecutar `model/supabase/migrations/20260722_multi_seat_allowance.sql`.
2. Asignar `seat_allowance` a cada asistente antes de abrir el enlace.
3. Si aun no se ejecuto ningun seed, crear el proyecto Supabase y ejecutar `model/supabase/schema.sql` una sola vez.
4. Completar `.env.local` con las claves reales, una URL final y un `SESSION_SECRET` aleatorio.
5. Exportar los asistentes a CSV e importarlos en `attendees`.
6. Probar con dos navegadores la colision de una misma butaca y revisar la actualizacion Realtime.
7. Probar descarga PNG y lectura del QR en iPhone/Android reales.
8. Configurar las variables en Vercel, desplegar y ejecutar una reserva de prueba antes de abrir el enlace.

## Fuera del MVP actual

- Panel de administracion e importador web de asistentes.
- Check-in unico y auditoria de ingreso en puerta.
- Hold temporal de butaca antes de confirmar.
