import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { ComplejoId } from '../config/complejos'
import { SesionVencida } from './turnos'
import { hoyISO, sumarDias } from './fechas'
import { DIAS_HISTORIA } from '../config/limites'

const TABLA = 'reservas_bloqueos'

export type Motivo = 'reparacion' | 'evento' | 'otro'

export const MOTIVOS: Record<Motivo, { texto: string; icono: string; cartel: string }> = {
  reparacion: { texto: 'Reparación', icono: '🔧', cartel: 'EN REPARACIÓN' },
  evento: { texto: 'Evento', icono: '🎉', cartel: 'EVENTO PRIVADO' },
  otro: { texto: 'Otro', icono: '📅', cartel: 'NO DISPONIBLE' },
}

export interface Bloqueo {
  id: string
  complejo: ComplejoId
  canchas: string[] | null // null = todas
  desde: string
  hasta: string
  horas: string[] | null // null = todo el día
  motivo: Motivo
  nota: string | null
  creado_por: string | null
  actualizado_por: string | null
}

export interface DatosBloqueo {
  canchas: string[] | null
  desde: string
  hasta: string
  horas: string[] | null
  motivo: Motivo
  nota: string
}

/** Un turno que choca con el bloqueo (reserva cargada o fecha futura de un fijo) */
export interface Choque {
  fecha: string
  cancha: string
  hora: string
  para: string | null
  cargo: string | null
  fijo: boolean
  futuro_fijo: boolean
}

/** El bloqueo que afecta a ese turno, si hay */
export function bloqueoEn(bloqueos: Bloqueo[], fecha: string, cancha: string, hora: string): Bloqueo | undefined {
  return bloqueos.find((b) => fecha >= b.desde && fecha <= b.hasta
    && (!b.canchas || b.canchas.includes(cancha))
    && (!b.horas || b.horas.includes(hora)))
}

/** El bloqueo que deja a la cancha sin turnos ese día (todo el día), si hay */
export function bloqueoDiaCompleto(bloqueos: Bloqueo[], fecha: string, cancha: string): Bloqueo | undefined {
  return bloqueos.find((b) => fecha >= b.desde && fecha <= b.hasta && !b.horas && (!b.canchas || b.canchas.includes(cancha)))
}

function error(e: { code?: string; message: string }): Error {
  if (e.code === '28000') return new SesionVencida(e.message)
  if (e.code === '22023') return new Error(e.message)
  return new Error('No se pudo guardar el cambio. Revisá la conexión.')
}

export async function previsualizarBloqueo(complejo: ComplejoId, d: DatosBloqueo): Promise<Choque[]> {
  const { data, error: e } = await supabase.rpc('reservas_bloqueo_previsualizar', {
    p_complejo: complejo, p_canchas: d.canchas, p_desde: d.desde, p_hasta: d.hasta, p_horas: d.horas,
  })
  if (e) throw new Error('No se pudo revisar si choca con reservas. Revisá la conexión.')
  return data as Choque[]
}

export async function guardarBloqueo(token: string, complejo: ComplejoId, id: string | null, d: DatosBloqueo) {
  const { error: e } = await supabase.rpc('reservas_bloqueo_guardar', {
    p_token: token, p_id: id, p_complejo: complejo, p_canchas: d.canchas, p_desde: d.desde, p_hasta: d.hasta,
    p_horas: d.horas, p_motivo: d.motivo, p_nota: d.nota || null,
  })
  if (e) throw error(e)
}

export async function eliminarBloqueo(token: string, id: string) {
  const { error: e } = await supabase.rpc('reservas_bloqueo_eliminar', { p_token: token, p_id: id })
  if (e) throw error(e)
}

/** Bloqueos del complejo que todavía importan (los vencidos se ven solo en el historial de la tabla) */
export function useBloqueos(complejo: ComplejoId) {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [cargado, setCargado] = useState(false)
  const pedido = useRef(0)

  const recargar = useCallback(async () => {
    const n = ++pedido.current
    const { data, error: e } = await supabase.from(TABLA).select('*')
      .eq('complejo', complejo).gte('hasta', sumarDias(hoyISO(), -DIAS_HISTORIA)).order('desde')
    if (n !== pedido.current) return
    if (!e) setBloqueos(data as Bloqueo[])
    setCargado(true)
  }, [complejo])

  useEffect(() => {
    setCargado(false)
    setBloqueos([])
    recargar()
    const canal = supabase
      .channel(`bloqueos:${complejo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLA }, () => recargar())
      .subscribe()
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [complejo, recargar])

  return { bloqueos, cargado, recargar }
}