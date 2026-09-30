// Rango de días que se pueden ver y editar en la app.
// IMPORTANTE: si cambiás estos valores, cambiá también los de la función
// public.reservas_limites() en Supabase (supabase/migracion-001-limites.sql),
// que es la que valida en la base y borra lo viejo.

/** Días hacia atrás que se guardan (historial). Lo anterior se borra solo. */
export const DIAS_HISTORIA = 90

/** Días hacia adelante en los que se puede reservar. */
export const DIAS_ADELANTE = 60