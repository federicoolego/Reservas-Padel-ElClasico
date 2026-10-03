import { hoyISO } from '../lib/fechas'

// Reglas de fechas de la app.
// IMPORTANTE: si cambiás estas reglas, cambiá también reservas__dias_historia()
// y reservas__fecha_maxima() en Supabase (supabase/migracion-005-ventana.sql),
// que son las que validan en la base, borran lo viejo y reservan los turnos fijos.

/** Días hacia atrás que se pueden consultar (historial). Lo anterior se borra solo. */
export const DIAS_HISTORIA = 90

/** Último día que se puede reservar: el último día del mes próximo. */
export function fechaMaxima(hoy = hoyISO()): string {
  const [a, m] = hoy.split('-').map(Number)
  // día 0 del mes subsiguiente = último día del mes próximo (m viene 1-12)
  return new Date(Date.UTC(a, m + 1, 0)).toISOString().slice(0, 10)
}

/** Los días anteriores a hoy son de solo lectura */
export const esPasado = (fecha: string) => fecha < hoyISO()

export const MENSAJE_PASADO = 'Solo se puede reservar/cancelar turnos del día o posteriores.'