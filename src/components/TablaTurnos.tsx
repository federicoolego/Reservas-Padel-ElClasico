import { useEffect, useRef, useState } from 'react'
import type { Complejo } from '../config/complejos'
import { cambiarEstado, claveTurno, SesionVencida, type Estado, type MapaTurnos, type Turno } from '../lib/turnos'
import { ahoraHHMM, horaDe, hoyISO, textoActualizado } from '../lib/fechas'
import { DialogoDetalle, DialogoReservar } from './DialogosTurno'
import { esPasado, MENSAJE_PASADO } from '../config/limites'

interface Props {
  complejo: Complejo
  fecha: string
  turnos: MapaTurnos
  token: string
  aplicarLocal: (t: Turno) => void
  alVencerSesion: () => void
  nombre?: string // quien usa la app: se muestra al instante como autor del cambio
}

interface Aviso {
  texto: string
  deshacer?: () => void
  error?: boolean
}

export default function TablaTurnos({ complejo, fecha, turnos, token, aplicarLocal, alVencerSesion, nombre }: Props) {
  const [pendientes, setPendientes] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<Aviso | null>(null)
  // turno con el popup abierto; el popup que se ve depende del estado en vivo del turno
  const [seleccion, setSeleccion] = useState<{ cancha: string; hora: string } | null>(null)
  const temporizador = useRef<number>()

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  function mostrar(a: Aviso) {
    window.clearTimeout(temporizador.current)
    setAviso(a)
    temporizador.current = window.setTimeout(() => setAviso(null), a.error ? 6000 : 5000)
  }

  async function guardar(cancha: string, hora: string, estado: Estado, para: string | null, conDeshacer: boolean) {
    if (esPasado(fecha)) return mostrar({ texto: MENSAJE_PASADO, error: true })
    const k = claveTurno(cancha, hora)
    const anterior = turnos[k]
    // cambio optimista: se ve al instante y se revierte si falla
    aplicarLocal({
      fecha, complejo: complejo.id, cancha, hora, estado,
      actualizado_por: nombre ?? anterior?.actualizado_por ?? null,
      actualizado: new Date().toISOString(),
      reservado_para: estado === 'reservada' ? para : null,
    })
    setPendientes((p) => new Set(p).add(k))
    try {
      const t = await cambiarEstado(token, fecha, complejo.id, cancha, hora, estado, para)
      aplicarLocal(t)
      if (conDeshacer) {
        const lugar = complejo.canchas.length > 1 ? ` · ${cancha}` : ''
        mostrar({
          texto: estado === 'reservada' ? `${hora}${lugar} reservado para ${para}` : `${hora}${lugar} liberado`,
          // deshacer una liberación vuelve a reservar para la misma persona
          deshacer: () => estado === 'reservada'
            ? guardar(cancha, hora, 'libre', null, false)
            : guardar(cancha, hora, 'reservada', anterior?.reservado_para ?? null, false),
        })
      }
    } catch (e) {
      if (anterior) aplicarLocal(anterior)
      else aplicarLocal({ fecha, complejo: complejo.id, cancha, hora, estado: 'libre', actualizado_por: null, actualizado: new Date().toISOString(), reservado_para: null })
      if (e instanceof SesionVencida) return alVencerSesion()
      mostrar({ texto: (e as Error).message, error: true })
    } finally {
      setPendientes((p) => {
        const n = new Set(p)
        n.delete(k)
        return n
      })
    }
  }

  const esHoy = fecha === hoyISO()
  const pasado = esPasado(fecha)

  // día pasado: lo libre avisa; lo reservado abre el detalle en solo lectura
  function tocar(cancha: string, hora: string) {
    if (pasado && turnos[claveTurno(cancha, hora)]?.estado !== 'reservada') return mostrar({ texto: MENSAJE_PASADO, error: true })
    setSeleccion({ cancha, hora })
  }
  // último cambio en la tabla para el día que se está viendo (reservas, liberaciones y fijos)
  const ultimo = Object.values(turnos).reduce<Turno | null>((m, t) => (!m || Date.parse(t.actualizado) > Date.parse(m.actualizado) ? t : m), null)

  const ahora = ahoraHHMM()
  const total = complejo.canchas.length * complejo.horarios.length
  const reservadas = complejo.canchas.reduce(
    (s, c) => s + complejo.horarios.filter((h) => turnos[claveTurno(c, h)]?.estado === 'reservada').length, 0)

  return (
    <div>
      {pasado ? (
        <p className="mb-3 rounded-xl bg-noche/5 px-3 py-2 text-sm text-tinta">
          <strong className="text-noche">Día pasado: solo consulta.</strong> Tocá un turno reservado para ver el detalle.
        </p>
      ) : (
        <p className="mb-3 text-sm text-tinta">
          <strong className="text-noche">{total - reservadas}</strong> libres de {total}. Tocá un turno libre para reservarlo, o uno reservado para ver el detalle.
        </p>
      )}
      <p className="-mt-1.5 mb-3 text-xs text-tinta">
        {ultimo ? <>Actualizado: <strong className="font-semibold text-noche">{textoActualizado(ultimo.actualizado, ultimo.actualizado_por)}</strong></> : 'Sin cambios cargados para este día.'}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-linea bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-noche text-white">
              <th className="w-[4.5rem] px-2 py-3 text-left font-tablero text-lg font-semibold">Hora</th>
              {complejo.canchas.map((c) => (
                <th key={c} className="px-2 py-3 font-tablero text-2xl font-bold tracking-wide">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {complejo.horarios.map((h, i) => {
              const paso = esHoy && i < complejo.horarios.length - 1 && complejo.horarios[i + 1] <= ahora
              return (
                <tr key={h} className="border-t border-linea">
                  <th scope="row" className={`px-2 py-1.5 text-left font-tablero text-[1.7rem] font-extrabold tabular-nums ${paso ? 'text-tinta/45' : ''}`}>{h}</th>
                  {complejo.canchas.map((c) => {
                    const k = claveTurno(c, h)
                    const t = turnos[k]
                    const reservada = t?.estado === 'reservada'
                    const pendiente = pendientes.has(k)
                    return (
                      <td key={c} className="p-1">
                        <button
                          onClick={() => tocar(c, h)}
                          disabled={pendiente}
                          aria-pressed={reservada}
                          aria-label={`${h} ${c}: ${reservada ? 'reservada' : 'libre'}`}
                          className={`flex h-14 w-full min-w-[64px] flex-col items-center justify-center rounded-xl border-2 transition-colors ${
                            reservada
                              ? 'border-rojo bg-rojo text-white'
                              : 'border-cesped/40 bg-cesped/5 text-cesped active:bg-cesped/15'
                          } ${pendiente ? 'animate-pulse' : ''} ${paso || pasado ? 'opacity-60' : ''}`}
                        >
                          <span className="font-tablero text-xl font-bold leading-none">{reservada ? 'Reservada' : 'Libre'}</span>
                          {reservada && t?.fijo_id ? (
                            <span className="mt-1 max-w-full truncate px-1 text-[11px] font-semibold leading-none text-pelota">
                              Fijo · {t.reservado_para}
                            </span>
                          ) : reservada && t?.actualizado_por && (
                            <span className="mt-1 max-w-full truncate px-1 text-[11px] leading-none text-white/85">
                              {t.actualizado_por} {horaDe(t.actualizado)}
                            </span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {seleccion && (() => {
        const { cancha, hora } = seleccion
        const t = turnos[claveTurno(cancha, hora)]
        const lugar = { hora, cancha: complejo.canchas.length > 1 ? cancha : null, fecha }
        const cerrar = () => setSeleccion(null)
        if (pasado && t?.estado !== 'reservada') return null
        return t?.estado === 'reservada' ? (
          <DialogoDetalle lugar={lugar} turno={t} alCerrar={cerrar} soloLectura={pasado}
            alLiberar={() => { cerrar(); guardar(cancha, hora, 'libre', null, true) }} />
        ) : (
          <DialogoReservar lugar={lugar} alCerrar={cerrar}
            alConfirmar={(para) => { cerrar(); guardar(cancha, hora, 'reservada', para, true) }} />
        )
      })()}

      {aviso && (
        <div role="status"
          className={`fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3 text-white shadow-2xl ${aviso.error ? 'bg-rojo' : 'bg-noche'}`}>
          <span className="font-medium">{aviso.texto}</span>
          {aviso.deshacer && (
            <button onClick={() => { aviso.deshacer!(); setAviso(null) }} className="shrink-0 font-bold text-pelota">
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}