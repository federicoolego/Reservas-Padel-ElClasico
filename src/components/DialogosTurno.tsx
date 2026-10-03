import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Turno } from '../lib/turnos'
import { fechaHoraDe, fechaLarga } from '../lib/fechas'
import { diaSemanaDe, losDias } from '../lib/fijos'

/** Datos del turno que se muestran en el encabezado: "19:00 · BX1 · miércoles 30/09" */
export interface LugarTurno {
  hora: string
  cancha: string | null // null si el complejo tiene una sola cancha
  fecha: string
}

export const textoLugar = (l: LugarTurno) => (
  <>
    <span className="font-semibold text-pelota">{l.hora}</span>
    {l.cancha && <> · {l.cancha}</>} · {fechaLarga(l.fecha)}
  </>
)

export function Dialogo({ titulo, subtitulo, alCerrar, children }: { titulo: string; subtitulo?: ReactNode; alCerrar: () => void; children: ReactNode }) {
  // ref para no re-ejecutar el efecto en cada render (la tabla se actualiza en tiempo real)
  const alCerrarRef = useRef(alCerrar)
  alCerrarRef.current = alCerrar

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && alCerrarRef.current()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-dialogo"
      className="fixed inset-0 z-30 flex items-end justify-center bg-noche/60 sm:items-center" onClick={alCerrar}>
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-noche px-5 py-4 text-white">
          <h2 id="titulo-dialogo" className="font-tablero text-3xl font-extrabold leading-tight">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-sm text-white/75">{subtitulo}</p>}
        </div>
        <div className="max-h-[75dvh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-5">{children}</div>
      </div>
    </div>
  )
}

export function DialogoReservar({ lugar, alConfirmar, alCerrar }: {
  lugar: LugarTurno
  alConfirmar: (para: string) => void
  alCerrar: () => void
}) {
  const [para, setPara] = useState('')
  const valido = para.trim().length > 0

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (valido) alConfirmar(para.trim())
  }

  return (
    <Dialogo titulo="¿Para quién es la reserva?" subtitulo={textoLugar(lugar)} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <input
          className="w-full rounded-lg border border-linea bg-white px-4 py-3 text-base text-noche placeholder:text-tinta/60 focus:border-escudo focus:outline-none"
          value={para} onChange={(e) => setPara(e.target.value)} maxLength={40} required autoFocus
          placeholder="Nombre de quien juega" autoComplete="off" enterKeyHint="done" />
        <div className="flex gap-2">
          <button type="submit" disabled={!valido}
            className="flex-1 rounded-xl bg-rojo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-40">
            Reservar
          </button>
          <button type="button" onClick={alCerrar} className="rounded-xl border border-linea px-5 font-semibold text-noche">
            Cancelar
          </button>
        </div>
      </form>
    </Dialogo>
  )
}

export function DialogoDetalle({ lugar, turno, alLiberar, alCerrar, soloLectura = false }: {
  lugar: LugarTurno
  turno: Turno
  alLiberar: () => void
  alCerrar: () => void
  soloLectura?: boolean // día pasado: se puede ver, no liberar
}) {
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => cerrar.current?.focus(), [])

  const fila = (etiqueta: string, valor: ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-linea py-2.5 last:border-0">
      <dt className="shrink-0 text-sm text-tinta">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-noche">{valor}</dd>
    </div>
  )

  return (
    <Dialogo titulo={turno.fijo_id ? 'Turno fijo' : 'Turno reservado'} subtitulo={textoLugar(lugar)} alCerrar={alCerrar}>
      <dl className="rounded-xl bg-niebla px-4">
        {fila('Para', turno.reservado_para || <span className="font-normal italic text-tinta">Sin dato</span>)}
        {turno.fijo_id && fila('Se repite', `Todos ${losDias(diaSemanaDe(lugar.fecha))}`)}
        {fila('Reservó', turno.actualizado_por || <span className="font-normal italic text-tinta">Sin dato</span>)}
        {fila('Cuándo', fechaHoraDe(turno.actualizado))}
      </dl>
      <div className="mt-4 flex gap-2">
        <button ref={cerrar} onClick={alCerrar}
          className="flex-1 rounded-xl bg-noche py-3 font-tablero text-2xl font-bold text-white">
          Cerrar
        </button>
        {!soloLectura && (
          <button onClick={alLiberar} className="rounded-xl border-2 border-rojo px-5 font-semibold text-rojo">
            {turno.fijo_id ? 'Liberar solo este día' : 'Liberar turno'}
          </button>
        )}
      </div>
      {soloLectura && (
        <p className="mt-3 text-xs text-tinta">Solo se puede reservar/cancelar turnos del día o posteriores.</p>
      )}
      {turno.fijo_id && !soloLectura && (
        <p className="mt-3 text-xs text-tinta">
          Liberar solo este día no toca las otras semanas. Para cambiar o dar de baja el turno fijo, andá a la pestaña Fijos.
        </p>
      )}
    </Dialogo>
  )
}