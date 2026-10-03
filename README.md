# Turnos · El Clásico

App para gestionar las reservas de canchas de **El Clásico** (BX1, BX2, C1) y **El Clásico 2**, y generar la imagen de turnos para compartir por WhatsApp.

- Varias personas cargan reservas a la vez desde el celu o la compu: los cambios se ven al instante en todos los dispositivos (Supabase Realtime).
- Cada complejo tiene dos pestañas: **Turnos** (tabla Libre / Reservada) e **Imagen** (se arma sola con el estado de la tabla).
- Login genérico: usuario **ELCLASICO**. La contraseña se guarda hasheada (bcrypt) en la base, no en el código.

Stack: Vite + React + TypeScript + Tailwind + Supabase. Publicada con GitHub Pages.

## 1. Base de datos

En el proyecto de Supabase, abrí **SQL Editor** y corré `supabase/reservas.sql` una sola vez.
Crea tablas y funciones con prefijo `reservas_`; no toca nada de la app de torneos.
Después corré las migraciones de `supabase/` en orden (`migracion-001-limites.sql`, `migracion-002-…`, `migracion-003-reservado-para.sql`, `migracion-004-turnos-fijos.sql`, `migracion-005-ventana.sql`).

## Turnos fijos

Pestaña **Fijos** (tabla `reservas_fijos`, migración 004). Cada fijo se materializa como reservas reales en
`reservas_turnos` (columna `fijo_id`) hasta el último día del mes próximo; nunca pisa un turno ya reservado.
La app llama a `reservas_fijos_sincronizar()` al abrir, y así la ventana se corre sola (el día 1 de cada mes se suma
un mes). Si querés que pase aunque nadie abra la app, programalo con pg_cron (comentado al final de la migración 004).

## Fechas

- **Reservar / cancelar**: desde hoy hasta el último día del mes próximo.
- **Días anteriores a hoy**: solo consulta. La app avisa "Solo se puede reservar/cancelar turnos del día o posteriores." y la base rechaza cualquier cambio.
- **Historial**: se ven los últimos 90 días; lo más viejo se borra solo cada vez que alguien cambia un turno.

Las reglas están en dos lugares: `src/config/limites.ts` (la app) y `reservas__dias_historia()` /
`reservas__fecha_maxima()` (migración 005, la base).

## 2. Publicar

1. Creá el repo (por ejemplo `Reservas-Padel-Clasico`) y subí el contenido de esta carpeta a la raíz, incluida `.github`, en `main`.
2. **Settings → Environments → github-pages → Environment variables**: cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (los mismos valores que la app de torneos).
3. **Settings → Pages → Source**: elegí **GitHub Actions**.

Queda en `https://federicoolego.github.io/Reservas-Padel-Clasico/`.

## Cambiar canchas, horarios o teléfonos

Canchas y horarios están en `src/config/complejos.ts`. Los teléfonos de la imagen se editan desde la app
(pestaña Imagen → Contactos de la imagen) y se guardan en `reservas_contactos` (migración 002).

## Cambiar la contraseña

En el SQL Editor de Supabase:

```sql
update public.reservas_acceso
   set clave_hash = extensions.crypt('ClaveNueva', extensions.gen_salt('bf', 10))
 where usuario = 'ELCLASICO';
delete from public.reservas_sesiones where usuario = 'ELCLASICO'; -- cierra las sesiones abiertas
```

No hace falta volver a publicar la app.

## Correr local

```bash
cp .env.example .env   # completar URL y anon key
npm install
npm run dev
```