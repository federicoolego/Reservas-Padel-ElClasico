import { supabase } from './supabase'
import type { ComplejoId } from '../config/complejos'

export type Estado = 'reservada' | 'libre'

export interface Turno {
  fecha: string
  complejo: ComplejoId
  cancha: string
  hora: string
  estado: Estado
  actualizado_por: string | null
  actualizado: string
}

export const claveTurno = (cancha: string, hora: string) => `${cancha}|${hora}`

export type MapaTurnos = Record<string, Turno>

export async function traerTurnos(fecha: string, complejo: ComplejoId): Promise<MapaTurnos> {
  const { data, error } = await supabase
    .from('reservas_turnos')
    .select('*')
    .eq('fecha', fecha)
    .eq('complejo', complejo)
  if (error) throw new Error('No se pudieron cargar los turnos.')
  const mapa: MapaTurnos = {}
  for (const t of data as Turno[]) mapa[claveTurno(t.cancha, t.hora)] = t
  return mapa
}

export class SesionVencida extends Error {}

export async function cambiarEstado(
  token: string,
  fecha: string,
  complejo: ComplejoId,
  cancha: string,
  hora: string,
  estado: Estado,
): Promise<Turno> {
  const { data, error } = await supabase.rpc('reservas_set_estado', {
    p_token: token,
    p_fecha: fecha,
    p_complejo: complejo,
    p_cancha: cancha,
    p_hora: hora,
    p_estado: estado,
  })
  if (error) {
    if (error.code === '28000') throw new SesionVencida(error.message)
    throw new Error('No se pudo guardar el cambio. Revisá la conexión.')
  }
  return data as Turno
}

/** Se suscribe a los cambios de un día y complejo. Devuelve la función para desuscribirse. */
export function escucharTurnos(fecha: string, complejo: ComplejoId, alCambiar: (t: Turno) => void) {
  const canal = supabase
    .channel(`reservas:${complejo}:${fecha}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservas_turnos', filter: `fecha=eq.${fecha}` },
      (p) => {
        const t = p.new as Turno
        if (t && t.complejo === complejo) alCambiar(t)
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(canal)
  }
}
