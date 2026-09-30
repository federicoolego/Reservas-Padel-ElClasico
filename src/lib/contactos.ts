import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { ComplejoId } from '../config/complejos'
import { SesionVencida } from './turnos'

export const MAX_CONTACTOS = 4

export interface Contacto {
  id: string
  complejo: ComplejoId
  nombre: string
  telefono: string
  orden: number
}

function error(e: { code?: string; message: string }): Error {
  if (e.code === '28000') return new SesionVencida(e.message)
  if (e.code === '22023') return new Error(e.message)
  return new Error('No se pudo guardar el cambio. Revisá la conexión.')
}

export async function guardarContacto(token: string, complejo: ComplejoId, id: string | null, nombre: string, telefono: string) {
  const { error: e } = await supabase.rpc('reservas_contacto_guardar', {
    p_token: token, p_id: id, p_complejo: complejo, p_nombre: nombre, p_telefono: telefono,
  })
  if (e) throw error(e)
}

export async function eliminarContacto(token: string, id: string) {
  const { error: e } = await supabase.rpc('reservas_contacto_eliminar', { p_token: token, p_id: id })
  if (e) throw error(e)
}

export async function moverContacto(token: string, id: string, direccion: -1 | 1) {
  const { error: e } = await supabase.rpc('reservas_contacto_mover', { p_token: token, p_id: id, p_direccion: direccion })
  if (e) throw error(e)
}

/** Contactos de un complejo, sincronizados en tiempo real */
export function useContactos(complejo: ComplejoId) {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [cargado, setCargado] = useState(false)
  const pedido = useRef(0)

  const recargar = useCallback(async () => {
    const n = ++pedido.current
    const { data, error: e } = await supabase
      .from('reservas_contactos')
      .select('id, complejo, nombre, telefono, orden')
      .eq('complejo', complejo)
      .order('orden')
    if (n !== pedido.current) return
    if (!e) setContactos(data as Contacto[])
    setCargado(true)
  }, [complejo])

  useEffect(() => {
    setCargado(false)
    setContactos([])
    recargar()
    // Los contactos son pocos: ante cualquier cambio (incluidos los borrados) se vuelven a traer
    const canal = supabase
      .channel(`contactos:${complejo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas_contactos' }, () => recargar())
      .subscribe()
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [complejo, recargar])

  return { contactos, cargado, recargar }
}