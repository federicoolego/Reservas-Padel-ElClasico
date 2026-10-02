import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { ComplejoId } from '../config/complejos'
import { SesionVencida } from './turnos'

export interface Fijo {
  id: string
  complejo: ComplejoId
  cancha: string
  dia_semana: number // 0 = domingo
  hora: string
  para: string
  desde: string
  hasta: string | null
  creado_por: string | null
  actualizado_por: string | null
}

export interface DatosFijo {
  cancha: string
  dia_semana: number
  hora: string
  para: string
  desde: string
  hasta: string | null
}

/** Una fecha que tocaría el fijo, con las canchas libres a esa hora */
export interface FechaPrevia {
  dia: string
  libres: string[]
  ocupado_por: string | null
  ocupado_para: string | null
  ocupado_fijo: boolean
}

// Orden de la semana para mostrar (lunes primero)
export const DIAS_SEMANA = [
  { n: 1, nombre: 'Lunes' },
  { n: 2, nombre: 'Martes' },
  { n: 3, nombre: 'Miércoles' },
  { n: 4, nombre: 'Jueves' },
  { n: 5, nombre: 'Viernes' },
  { n: 6, nombre: 'Sábado' },
  { n: 0, nombre: 'Domingo' },
]

export const nombreDia = (n: number) => DIAS_SEMANA.find((d) => d.n === n)!.nombre
export const losDias = (n: number) => `los ${nombreDia(n).toLowerCase()}${n === 6 || n === 0 ? 's' : ''}`
export const ordenSemana = (n: number) => (n + 6) % 7

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD */
export function diaSemanaDe(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

function error(e: { code?: string; message: string }): Error {
  if (e.code === '28000') return new SesionVencida(e.message)
  if (e.code === '22023') return new Error(e.message)
  return new Error('No se pudo guardar el cambio. Revisá la conexión.')
}

export async function previsualizarFijo(
  complejo: ComplejoId, canchas: string[], datos: DatosFijo, excluir: string | null,
): Promise<FechaPrevia[]> {
  const { data, error: e } = await supabase.rpc('reservas_fijo_previsualizar', {
    p_complejo: complejo, p_canchas: canchas, p_cancha: datos.cancha, p_dia: datos.dia_semana,
    p_hora: datos.hora, p_desde: datos.desde, p_hasta: datos.hasta, p_excluir: excluir,
  })
  if (e) throw new Error('No se pudo revisar la disponibilidad. Revisá la conexión.')
  return data as FechaPrevia[]
}

export async function guardarFijo(token: string, complejo: ComplejoId, id: string | null, datos: DatosFijo) {
  const { error: e } = await supabase.rpc('reservas_fijo_guardar', {
    p_token: token, p_id: id, p_complejo: complejo, p_cancha: datos.cancha, p_dia: datos.dia_semana,
    p_hora: datos.hora, p_para: datos.para, p_desde: datos.desde, p_hasta: datos.hasta,
  })
  if (e) throw error(e)
}

export async function eliminarFijo(token: string, id: string) {
  const { error: e } = await supabase.rpc('reservas_fijo_eliminar', { p_token: token, p_id: id })
  if (e) throw error(e)
}

/** Crea las reservas de los fijos que entraron en la ventana de días. Idempotente. */
export async function sincronizarFijos(token: string) {
  const { error: e } = await supabase.rpc('reservas_fijos_sincronizar', { p_token: token })
  if (e) throw error(e)
}

/** Fijos de un complejo, sincronizados en tiempo real */
export function useFijos(complejo: ComplejoId) {
  const [fijos, setFijos] = useState<Fijo[]>([])
  const [cargado, setCargado] = useState(false)
  const pedido = useRef(0)

  const recargar = useCallback(async () => {
    const n = ++pedido.current
    const { data, error: e } = await supabase.from('reservas_fijos').select('*').eq('complejo', complejo)
    if (n !== pedido.current) return
    if (!e) {
      const lista = (data as Fijo[]).sort((a, b) =>
        ordenSemana(a.dia_semana) - ordenSemana(b.dia_semana) || a.hora.localeCompare(b.hora) || a.cancha.localeCompare(b.cancha))
      setFijos(lista)
    }
    setCargado(true)
  }, [complejo])

  useEffect(() => {
    setCargado(false)
    setFijos([])
    recargar()
    const canal = supabase
      .channel(`fijos:${complejo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_fijos' }, () => recargar())
      .subscribe()
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [complejo, recargar])

  return { fijos, cargado, recargar }
}
