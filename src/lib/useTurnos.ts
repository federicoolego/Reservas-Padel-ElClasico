import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComplejoId } from '../config/complejos'
import { claveTurno, escucharTurnos, traerTurnos, type MapaTurnos, type Turno } from './turnos'

/** Turnos de un día/complejo, siempre sincronizados con la base (tiempo real + al volver a la pestaña) */
export function useTurnos(fecha: string, complejo: ComplejoId) {
  const [turnos, setTurnos] = useState<MapaTurnos>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pedido = useRef(0)

  const recargar = useCallback(async () => {
    const n = ++pedido.current
    try {
      const m = await traerTurnos(fecha, complejo)
      if (n === pedido.current) {
        setTurnos(m)
        setError(null)
      }
    } catch (e) {
      if (n === pedido.current) setError((e as Error).message)
    } finally {
      if (n === pedido.current) setCargando(false)
    }
  }, [fecha, complejo])

  useEffect(() => {
    setCargando(true)
    setTurnos({})
    recargar()
    const aplicar = (t: Turno) => setTurnos((prev) => ({ ...prev, [claveTurno(t.cancha, t.hora)]: t }))
    const cortar = escucharTurnos(fecha, complejo, aplicar)
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', recargar)
    return () => {
      cortar()
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', recargar)
    }
  }, [fecha, complejo, recargar])

  const aplicarLocal = useCallback((t: Turno) => {
    setTurnos((prev) => ({ ...prev, [claveTurno(t.cancha, t.hora)]: t }))
  }, [])

  return { turnos, cargando, error, recargar, aplicarLocal }
}
