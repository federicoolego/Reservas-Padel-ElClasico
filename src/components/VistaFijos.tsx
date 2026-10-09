import { useState, type FormEvent } from 'react'
import type { Complejo } from '../config/complejos'
import { fechaMaxima } from '../config/limites'
import { SesionVencida } from '../lib/turnos'
import { ddmm, fechaLarga, hoyISO } from '../lib/fechas'
import {
  DIAS_SEMANA, diaSemanaDe, eliminarFijo, guardarFijo, losDias, nombreDia, previsualizarFijo, useFijos,
  type DatosFijo, type FechaPrevia, type Fijo,
} from '../lib/fijos'
import { Dialogo } from './DialogosTurno'

interface Props {
  complejo: Complejo
  token: string
  alVencerSesion: () => void
}

interface Edicion extends DatosFijo {
  id: string | null
}

export default function VistaFijos({ complejo, token, alVencerSesion }: Props) {
  const { fijos, cargado, recargar } = useFijos(complejo.id)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const variasCanchas = complejo.canchas.length > 1

  function nuevo() {
    const hoy = hoyISO()
    setEdicion({ id: null, cancha: complejo.canchas[0], dia_semana: diaSemanaDe(hoy), hora: complejo.horarios[0], para: '', desde: hoy, hasta: null })
  }

  async function eliminar(f: Fijo) {
    const lugar = variasCanchas ? ` en ${f.cancha}` : ''
    if (!window.confirm(`¿Eliminar el turno fijo de ${f.para} (${losDias(f.dia_semana)} ${f.hora}${lugar})?\n\nSe liberan sus reservas de hoy en adelante. Las pasadas quedan.`)) return
    setOcupado(true)
    setError(null)
    try {
      await eliminarFijo(token, f.id)
      recargar()
      setAviso(`Turno fijo de ${f.para} eliminado. Se liberaron sus próximas reservas.`)
    } catch (e) {
      if (e instanceof SesionVencida) alVencerSesion()
      else setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-tinta">
        Los turnos fijos se reservan solos hasta fin del mes próximo (hoy, hasta el {ddmm(fechaMaxima())}) y la ventana se
        corre sola cada mes. Si editás o eliminás uno, sus reservas se actualizan de hoy en adelante. Nunca pisan un turno
        que ya esté reservado.
      </p>

      <button onClick={nuevo} disabled={ocupado}
        className="w-full rounded-xl bg-escudo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
        Agregar turno fijo
      </button>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-cesped/10 px-4 py-3 text-cesped">
          <span className="text-sm font-medium">{aviso}</span>
          <button onClick={() => setAviso(null)} className="shrink-0 text-sm font-bold">OK</button>
        </div>
      )}
      {error && <p className="rounded-xl bg-rojo/10 px-4 py-3 text-sm font-medium text-rojo">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-linea bg-white">
        {!cargado ? (
          <p className="py-10 text-center text-tinta">Cargando turnos fijos…</p>
        ) : fijos.length === 0 ? (
          <p className="px-4 py-10 text-center text-tinta">Todavía no hay turnos fijos en {complejo.nombre}.</p>
        ) : (
          <ul>
            {fijos.map((f) => {
              const terminado = f.hasta !== null && f.hasta < hoyISO()
              return (
                <li key={f.id} className={`flex items-center gap-3 border-t border-linea px-4 py-3 first:border-0 ${terminado ? 'opacity-50' : ''}`}>
                  <div className="w-24 shrink-0">
                    <span className="block font-tablero text-xl font-bold leading-none text-noche">{nombreDia(f.dia_semana)}</span>
                    <span className="mt-1 block font-tablero text-2xl font-extrabold tabular-nums leading-none text-rojo">{f.hora}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-noche">{f.para}</span>
                    <span className="block text-sm text-tinta">
                      {variasCanchas && <>{f.cancha} · </>}
                      {terminado ? `terminó el ${ddmm(f.hasta!)}` : `desde ${ddmm(f.desde)}${f.hasta ? ` hasta ${ddmm(f.hasta)}` : ''}`}
                    </span>
                  </div>
                  <button disabled={ocupado} onClick={() => setEdicion({ ...f })}
                    className="h-9 rounded-lg border border-linea px-3 text-sm font-semibold text-noche disabled:opacity-30">Editar</button>
                  <button disabled={ocupado} onClick={() => eliminar(f)}
                    className="h-9 rounded-lg border border-linea px-3 text-sm font-semibold text-rojo disabled:opacity-30">Eliminar</button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {edicion && (
        <EditorFijo complejo={complejo} token={token} inicial={edicion}
          alCerrar={() => setEdicion(null)}
          alGuardar={(texto) => { setEdicion(null); setAviso(texto); recargar() }}
          alVencerSesion={alVencerSesion} />
      )}
    </div>
  )
}

function EditorFijo({ complejo, token, inicial, alCerrar, alGuardar, alVencerSesion }: {
  complejo: Complejo
  token: string
  inicial: Edicion
  alCerrar: () => void
  alGuardar: (aviso: string) => void
  alVencerSesion: () => void
}) {
  const [datos, setDatos] = useState<Edicion>(inicial)
  const [previas, setPrevias] = useState<FechaPrevia[] | null>(null) // != null: mostrando conflictos
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const variasCanchas = complejo.canchas.length > 1
  const conflictos = (previas ?? []).filter((p) => !p.libres.includes(datos.cancha))

  // canchas que están libres en TODAS las fechas que tocaría el fijo
  const alternativas = previas
    ? complejo.canchas.filter((c) => c !== datos.cancha && previas.every((p) => p.libres.includes(c)))
    : []

  async function guardar(d: Edicion, cantidad: number, salteadas: number) {
    await guardarFijo(token, complejo.id, d.id, d)
    const donde = variasCanchas ? ` en ${d.cancha}` : ''
    const extra = salteadas ? ` ${salteadas === 1 ? 'Una fecha quedó' : `${salteadas} fechas quedaron`} sin reservar porque estaba ocupada.` : ''
    alGuardar(`Turno fijo de ${d.para.trim()} guardado: ${losDias(d.dia_semana)} ${d.hora}${donde}. ` +
      `${cantidad - salteadas} reserva${cantidad - salteadas === 1 ? '' : 's'} hasta el ${ddmm(fechaMaxima())}.${extra}`)
  }

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

  /** Revisa disponibilidad: si no hay choques guarda directo; si hay, muestra el aviso */
  function revisar(d: Edicion) {
    ejecutar(async () => {
      const p = await previsualizarFijo(complejo.id, complejo.canchas, d, d.id)
      const choques = p.filter((x) => !x.libres.includes(d.cancha)).length
      if (choques === 0) return guardar(d, p.length, 0)
      setDatos(d)
      setPrevias(p)
    })
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!datos.para.trim()) return setError('Indicá para quién es el turno fijo.')
    if (datos.hasta && datos.hasta < datos.desde) return setError('La fecha "hasta" no puede ser anterior a "desde".')
    revisar(datos)
  }

  const campo = 'w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-base text-noche focus:border-escudo focus:outline-none'
  const etiqueta = 'mb-1 block text-sm font-semibold'
  const subtitulo = previas
    ? `${losDias(datos.dia_semana)} ${datos.hora}${variasCanchas ? ` · ${datos.cancha}` : ''}`
    : datos.id ? 'Los cambios se aplican de hoy en adelante' : 'Se reserva solo todas las semanas'

  return (
    <Dialogo titulo={previas ? 'Hay fechas ocupadas' : datos.id ? 'Editar turno fijo' : 'Nuevo turno fijo'}
      subtitulo={subtitulo} alCerrar={alCerrar}>
      {!previas ? (
        <form onSubmit={enviar} className="space-y-3">
          <label className="block">
            <span className={etiqueta}>Para quién</span>
            <input className={campo} value={datos.para} maxLength={40} required autoFocus placeholder="Nombre de quien juega"
              onChange={(e) => setDatos({ ...datos, para: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={etiqueta}>Día</span>
              <select className={campo} value={datos.dia_semana} onChange={(e) => setDatos({ ...datos, dia_semana: Number(e.target.value) })}>
                {DIAS_SEMANA.map((d) => <option key={d.n} value={d.n}>{d.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={etiqueta}>Hora</span>
              <select className={campo} value={datos.hora} onChange={(e) => setDatos({ ...datos, hora: e.target.value })}>
                {complejo.horarios.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          </div>
          {variasCanchas && (
            <label className="block">
              <span className={etiqueta}>Cancha</span>
              <select className={campo} value={datos.cancha} onChange={(e) => setDatos({ ...datos, cancha: e.target.value })}>
                {complejo.canchas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={etiqueta}>Desde</span>
              <input type="date" className={campo} value={datos.desde} required
                onChange={(e) => setDatos({ ...datos, desde: e.target.value })} />
            </label>
            <label className="block">
              <span className={etiqueta}>Hasta <span className="font-normal text-tinta">(opcional)</span></span>
              <input type="date" className={campo} value={datos.hasta ?? ''} min={datos.desde}
                onChange={(e) => setDatos({ ...datos, hasta: e.target.value || null })} />
            </label>
          </div>
          {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={ocupado}
              className="flex-1 rounded-xl bg-escudo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
              {ocupado ? 'Revisando…' : 'Guardar'}
            </button>
            <button type="button" onClick={alCerrar} className="rounded-xl border border-linea px-5 font-semibold text-noche">Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-tinta">
            {conflictos.length === 1 ? 'Esta fecha ya está reservada' : `Estas ${conflictos.length} fechas ya están reservadas`}
            {variasCanchas ? ` en ${datos.cancha}` : ''} a las {datos.hora}:
          </p>
          <ul className="space-y-2">
            {conflictos.map((c) => {
              const otras = c.libres.filter((x) => x !== datos.cancha)
              return (
                <li key={c.dia} className="rounded-xl border border-rojo/30 bg-rojo/5 px-3 py-2.5">
                  <span className="block font-semibold capitalize text-noche">{fechaLarga(c.dia)}</span>
                  <span className="block text-sm text-tinta">
                    {c.ocupado_por === 'Bloqueo' ? <>No disponible · <strong className="text-noche">{c.ocupado_para}</strong> (bloqueo)</> : (
                      <>
                        {c.ocupado_fijo ? 'Turno fijo' : 'Reservada'}
                        {c.ocupado_para && <> para <strong className="text-noche">{c.ocupado_para}</strong></>}
                        {c.ocupado_por && !c.ocupado_fijo && <> (cargó {c.ocupado_por})</>}
                      </>
                    )}
                  </span>
                  {variasCanchas && (
                    <span className={`mt-1 block text-sm font-semibold ${otras.length ? 'text-cesped' : 'text-rojo'}`}>
                      {otras.length ? `Libre ese día: ${otras.join(', ')}` : 'No hay canchas libres en ese horario'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          {variasCanchas && (
            alternativas.length ? (
              <div className="rounded-xl bg-cesped/10 p-3">
                <p className="text-sm font-semibold text-cesped">
                  {alternativas.length === 1 ? 'Esta cancha está libre' : 'Estas canchas están libres'} todas las semanas a las {datos.hora}:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {alternativas.map((c) => (
                    <button key={c} disabled={ocupado} onClick={() => revisar({ ...datos, cancha: c })}
                      className="rounded-lg bg-cesped px-4 py-2 font-semibold text-white disabled:opacity-60">
                      Usar {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-niebla p-3 text-sm text-tinta">
                Ninguna otra cancha está libre todas esas semanas a las {datos.hora}.
              </p>
            )
          )}

          {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}

          <div className="space-y-2">
            <button disabled={ocupado} onClick={() => ejecutar(() => guardar(datos, previas.length, conflictos.length))}
              className="w-full rounded-xl bg-noche py-3 font-semibold text-white disabled:opacity-60">
              Guardar igual en {variasCanchas ? datos.cancha : complejo.nombre}
              <span className="block text-xs font-normal text-white/70">
                {conflictos.length === 1 ? 'Esa fecha queda' : 'Esas fechas quedan'} sin reservar; si se liberan, el fijo las toma solo
              </span>
            </button>
            <button disabled={ocupado} onClick={() => { setPrevias(null); setError(null) }}
              className="w-full rounded-xl border border-linea py-3 font-semibold text-noche">
              Cambiar día, hora o cancha
            </button>
          </div>
        </div>
      )}
    </Dialogo>
  )
}