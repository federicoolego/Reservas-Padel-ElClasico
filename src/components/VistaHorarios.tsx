import { useState, type FormEvent } from 'react'
import { Dialogo } from './DialogosTurno'
import { ddmm } from '../lib/fechas'
import { losDias } from '../lib/fijos'
import { MOTIVOS, type Motivo } from '../lib/bloqueos'
import {
  agregarHorario, eliminarHorario, previsualizarHorario, type ChoquesHorario,
} from '../lib/horarios'
import { SesionVencida } from '../lib/turnos'
import type { ComplejoId } from '../config/complejos'

interface Props {
  token: string
  complejo: ComplejoId
  complejoNombre?: string // si hay más de un complejo, para dejar claro cuál se está editando
  horarios: string[]
  cargado: boolean
  alCerrar: () => void
  alVencerSesion: () => void
  alCambiar: () => void // algo cambió: recargar la tabla de turnos y los horarios
}

type Pendiente = { hora: string; datos: ChoquesHorario }

export default function VistaHorarios({ token, complejo, complejoNombre, horarios, cargado, alCerrar, alVencerSesion, alCambiar }: Props) {
  const [nuevo, setNuevo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<Pendiente | null>(null)

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
    } catch (e) {
      if (e instanceof SesionVencida) alVencerSesion()
      else setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nuevo) return
    if (horarios.includes(nuevo)) return setError('Ese horario ya está en la grilla.')
    ejecutar(async () => {
      await agregarHorario(token, complejo, nuevo)
      setNuevo('')
      alCambiar()
    })
  }

  /** Revisa qué usa ese horario: si no hay nada, elimina directo; si hay, pide confirmar */
  function pedirEliminar(hora: string) {
    ejecutar(async () => {
      const datos = await previsualizarHorario(complejo, hora)
      if (!datos.reservas.length && !datos.fijos.length && !datos.bloqueos.length) {
        await eliminarHorario(token, complejo, hora)
        alCambiar()
      } else {
        setPendiente({ hora, datos })
      }
    })
  }

  function confirmarEliminar() {
    if (!pendiente) return
    ejecutar(async () => {
      await eliminarHorario(token, complejo, pendiente.hora)
      setPendiente(null)
      alCambiar()
    })
  }

  const subtitulo = complejoNombre ? `La grilla de turnos de ${complejoNombre}` : 'La grilla de turnos de la app'

  if (pendiente) {
    const { hora, datos } = pendiente
    const total = datos.reservas.length + datos.fijos.length + datos.bloqueos.length
    return (
      <Dialogo titulo={`Eliminar el horario ${hora}`} subtitulo={`Se usa en ${total} lugar${total === 1 ? '' : 'es'}`} alCerrar={() => setPendiente(null)}>
        <div className="space-y-3">
          {datos.reservas.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-noche">Reservas que se liberan ({datos.reservas.length})</p>
              <div className="space-y-1.5">
                {datos.reservas.map((r, i) => (
                  <p key={i} className="rounded-lg bg-rojo/5 px-3 py-1.5 text-sm text-tinta">
                    {ddmm(r.fecha)} · {r.cancha} · para <strong className="text-noche">{r.para ?? 'sin nombre'}</strong>
                    {r.cargo && <> (cargó {r.cargo})</>}
                  </p>
                ))}
              </div>
            </div>
          )}
          {datos.fijos.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-noche">Turnos fijos que se eliminan ({datos.fijos.length})</p>
              <div className="space-y-1.5">
                {datos.fijos.map((f) => (
                  <p key={f.id} className="rounded-lg bg-rojo/5 px-3 py-1.5 text-sm text-tinta">
                    {f.cancha} · todos {losDias(f.dia_semana)} · para <strong className="text-noche">{f.para}</strong>
                  </p>
                ))}
              </div>
            </div>
          )}
          {datos.bloqueos.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-noche">Bloqueos a los que se les saca este horario ({datos.bloqueos.length})</p>
              <div className="space-y-1.5">
                {datos.bloqueos.map((b) => (
                  <p key={b.id} className="rounded-lg bg-rojo/5 px-3 py-1.5 text-sm text-tinta">
                    {MOTIVOS[b.motivo as Motivo].icono} {MOTIVOS[b.motivo as Motivo].texto} · {ddmm(b.desde)}{b.hasta !== b.desde ? ` al ${ddmm(b.hasta)}` : ''}
                    {b.nota && <> · {b.nota}</>}
                  </p>
                ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
          <button onClick={confirmarEliminar} disabled={ocupado}
            className="w-full rounded-xl bg-rojo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
            {ocupado ? 'Eliminando…' : `Eliminar ${hora} igual`}
          </button>
          <button onClick={() => setPendiente(null)} className="w-full py-1.5 font-semibold text-tinta">Cancelar</button>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo titulo="Horarios" subtitulo={subtitulo} alCerrar={alCerrar}>
      <div className="space-y-3">
        <p className="text-sm text-tinta">
          Acá administrás los horarios que se ven en Turnos, Imagen, Fijos y Bloqueos. Si un horario tiene reservas, fijos
          o bloqueos, te avisamos antes de sacarlo.
        </p>
        {!cargado ? (
          <p className="py-6 text-center text-tinta">Cargando…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {horarios.map((h) => (
              <span key={h} className="inline-flex items-center gap-1.5 rounded-lg border border-linea bg-white py-1.5 pl-3 pr-2 font-tablero text-lg font-bold text-noche">
                {h}
                <button onClick={() => pedirEliminar(h)} disabled={ocupado} aria-label={`Eliminar horario ${h}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-tinta hover:bg-rojo/10 hover:text-rojo disabled:opacity-40">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
        <form onSubmit={agregar} className="flex gap-2 border-t border-linea pt-3">
          <input type="time" value={nuevo} onChange={(e) => setNuevo(e.target.value)} required
            className="flex-1 rounded-lg border border-linea bg-white px-3 py-2.5 text-base text-noche focus:border-escudo focus:outline-none" />
          <button type="submit" disabled={ocupado || !nuevo}
            className="rounded-xl bg-escudo px-4 font-tablero text-xl font-bold text-white disabled:opacity-60">
            Agregar
          </button>
        </form>
      </div>
      <button onClick={alCerrar} className="mt-4 w-full rounded-xl bg-noche py-3 font-tablero text-2xl font-bold text-white">Cerrar</button>
    </Dialogo>
  )
}
