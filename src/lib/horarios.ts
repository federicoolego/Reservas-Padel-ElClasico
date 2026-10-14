import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { ComplejoId } from '../config/complejos'
import { SesionVencida } from './turnos'

const TABLA = 'reservas_horarios'

export interface Horario {
  complejo: ComplejoId
  hora: string
}

/** Lo que usa ese horario y se vería afectado si se elimina */
export interface ChoquesHorario {
  reservas: { fecha: string; cancha: string; para: string | null; cargo: string | null }[]
  fijos: { id: string; cancha: string; para: string; dia_semana: number }[]
  bloqueos: { id: string; canchas: string[] | null; desde: string; hasta: string; motivo: string; nota: string | null }[]
}

function error(e: { code?: string; message: string }): Error {
  if (e.code === '28000') return new SesionVencida(e.message)
  if (e.code === '22023') return new Error(e.message)
  return new Error('No se pudo guardar el cambio. Revisá la conexión.')
}

export async function previsualizarHorario(complejo: ComplejoId, hora: string): Promise<ChoquesHorario> {
  const { data, error: e } = await supabase.rpc('reservas_horario_previsualizar', { p_complejo: complejo, p_hora: hora })
  if (e) throw new Error('No se pudo revisar si está en uso. Revisá la conexión.')
  return data as ChoquesHorario
}

export async function agregarHorario(token: string, complejo: ComplejoId, hora: string) {
  const { error: e } = await supabase.rpc('reservas_horario_agregar', { p_token: token, p_complejo: complejo, p_hora: hora })
  if (e) throw error(e)
}

export async function eliminarHorario(token: string, complejo: ComplejoId, hora: string) {
  const { error: e } = await supabase.rpc('reservas_horario_eliminar', { p_token: token, p_complejo: complejo, p_hora: hora })
  if (e) throw error(e)
}

/** Horarios del complejo, en tiempo real. Mientras no cargó, cargado = false (ver App.tsx). */
export function useHorarios(complejo: ComplejoId) {
  const [horarios, setHorarios] = useState<string[]>([])
  const [cargado, setCargado] = useState(false)
  const pedido = useRef(0)

  const recargar = useCallback(async () => {
    const n = ++pedido.current
    const { data, error: e } = await supabase.from(TABLA).select('hora').eq('complejo', complejo).order('hora')
    if (n !== pedido.current) return
    if (!e) setHorarios((data as { hora: string }[]).map((h) => h.hora))
    setCargado(true)
  }, [complejo])

  useEffect(() => {
    setCargado(false)
    setHorarios([])
    recargar()
    const canal = supabase
      .channel(`horarios:${complejo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLA, filter: `complejo=eq.${complejo}` }, () => recargar())
      .subscribe()
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [complejo, recargar])

  return { horarios, cargado, recargar }
}
