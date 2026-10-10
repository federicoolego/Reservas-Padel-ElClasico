import { useState, type FormEvent } from 'react'
import type { Complejo } from '../config/complejos'
import { SesionVencida } from '../lib/turnos'
import { ddmm, hoyISO } from '../lib/fechas'
import { diaSemanaDe, losDias } from '../lib/fijos'
import {
  eliminarBloqueo, guardarBloqueo, MOTIVOS, previsualizarBloqueo,
  type Bloqueo, type Choque, type DatosBloqueo, type Motivo,
} from '../lib/bloqueos'
import { Dialogo } from './DialogosTurno'

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const corta = (iso: string) => `${DIAS_CORTOS[diaSemanaDe(iso)]} ${ddmm(iso)}`

/** "Lun 12/10 al Dom 18/10" o "Martes 13/10" */
export function textoFechas(b: { desde: string; hasta: string }) {
  return b.desde === b.hasta ? `${DIAS[diaSemanaDe(b.desde)]} ${ddmm(b.desde)}` : `${corta(b.desde)} al ${corta(b.hasta)}`
}

/** "todo el día" / "13:00 a 17:30 (4 turnos)" / "10:00, 16:00" */
export function textoTurnos(horas: string[] | null, horarios: string[]) {
  if (!horas) return 'todo el día'
  const orden = horarios.filter((h) => horas.includes(h))
  const seguidos = orden.length > 1 && horarios.indexOf(orden[orden.length - 1]) - horarios.indexOf(orden[0]) === orden.length - 1
  if (seguidos) return `${orden[0]} a ${orden[orden.length - 1]} (${orden.length} turnos)`
  return orden.length === 1 ? `${orden[0]} (1 turno)` : orden.join(', ')
}

const textoCanchas = (canchas: string[] | null, todas: string[]) =>
  !canchas || canchas.length === todas.length ? (todas.length > 1 ? 'Todas las canchas' : todas[0]) : canchas.join(', ')

interface Props {
  complejo: Complejo
  token: string
  bloqueos: Bloqueo[]
  cargado: boolean
  recargar: () => void
  alVencerSesion: () => void
}

interface Edicion extends DatosBloqueo { id: string | null }

export default function VistaBloqueos({ complejo, token, bloqueos, cargado, recargar, alVencerSesion }: Props) {
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const hoy = hoyISO()
  const vigentes = bloqueos.filter((b) => b.hasta >= hoy).sort((a, b) => a.desde.localeCompare(b.desde))

  function nuevo() {
    setEdicion({ id: null, canchas: [complejo.canchas[0]], desde: hoy, hasta: hoy, horas: null, motivo: 'reparacion', nota: '' })
  }

  async function eliminar(b: Bloqueo) {
    if (!window.confirm(`¿Eliminar el bloqueo de ${textoCanchas(b.canchas, complejo.canchas)} (${textoFechas(b)})?\n\nLos turnos vuelven a estar disponibles y los fijos se reservan solos.`)) return
    setOcupado(true)
    setError(null)
    try {
      await eliminarBloqueo(token, b.id)
      recargar()
      setAviso('Bloqueo eliminado. Los turnos vuelven a estar disponibles.')
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
        Marcá canchas u horarios que no se pueden reservar: reparaciones, eventos, cumpleaños. Si choca con reservas o fijos,
        la app te avisa a quién hay que llamar.
      </p>
      <button onClick={nuevo} disabled={ocupado}
        className="w-full rounded-xl bg-escudo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
        Agregar bloqueo
      </button>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-cesped/10 px-4 py-3 text-cesped">
          <span className="text-sm font-medium">{aviso}</span>
          <button onClick={() => setAviso(null)} className="shrink-0 text-sm font-bold">OK</button>
        </div>
      )}
      {error && <p className="rounded-xl bg-rojo/10 px-4 py-3 text-sm font-medium text-rojo">{error}</p>}

      {!cargado ? (
        <p className="py-10 text-center text-tinta">Cargando bloqueos…</p>
      ) : vigentes.length === 0 ? (
        <p className="rounded-2xl border border-linea bg-white px-4 py-10 text-center text-tinta">No hay bloqueos vigentes ni próximos.</p>
      ) : (
        <>
          <p className="px-1 font-tablero text-base font-bold text-tinta">Vigentes y próximos</p>
          {vigentes.map((b) => {
            const enCurso = b.desde <= hoy
            const m = MOTIVOS[b.motivo]
            return (
              <div key={b.id} className="flex gap-3 rounded-2xl border border-linea bg-white p-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${b.motivo === 'reparacion' ? 'bg-escudo/10' : b.motivo === 'otro' ? 'bg-tinta/10' : 'bg-pelota/35'}`}>{m.icono}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-tablero text-xl font-extrabold leading-tight text-noche">
                    {textoCanchas(b.canchas, complejo.canchas)} · {m.texto}
                    <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 align-middle font-sans text-[11px] font-semibold ${enCurso ? 'bg-rojo/10 text-rojo' : 'bg-niebla text-tinta'}`}>
                      {enCurso ? 'en curso' : 'próximo'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-tinta"><strong className="font-semibold text-noche">{textoFechas(b)}</strong> · {textoTurnos(b.horas, complejo.horarios)}</p>
                  <p className="text-sm text-tinta">{[b.nota, b.actualizado_por && `cargó ${b.actualizado_por}`].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button disabled={ocupado} onClick={() => setEdicion({ id: b.id, canchas: b.canchas, desde: b.desde, hasta: b.hasta, horas: b.horas, motivo: b.motivo, nota: b.nota ?? '' })}
                      className="rounded-lg border border-linea px-3 py-1 text-sm font-semibold text-noche disabled:opacity-30">Editar</button>
                    <button disabled={ocupado} onClick={() => eliminar(b)}
                      className="rounded-lg border border-linea px-3 py-1 text-sm font-semibold text-rojo disabled:opacity-30">Eliminar</button>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}

      {edicion && (
        <EditorBloqueo complejo={complejo} token={token} inicial={edicion}
          alCerrar={() => setEdicion(null)}
          alGuardar={(t) => { setEdicion(null); setAviso(t); recargar() }}
          alVencerSesion={alVencerSesion} />
      )}
    </div>
  )
}

function EditorBloqueo({ complejo, token, inicial, alCerrar, alGuardar, alVencerSesion }: {
  complejo: Complejo
  token: string
  inicial: Edicion
  alCerrar: () => void
  alGuardar: (aviso: string) => void
  alVencerSesion: () => void
}) {
  const [d, setD] = useState<Edicion>(inicial)
  const [choques, setChoques] = useState<Choque[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const todas = complejo.canchas
  const canchasSel = d.canchas ?? todas
  const multiples = todas.length > 1

  const alternar = (lista: string[], x: string) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x])
  const datos = (): DatosBloqueo => ({
    ...d,
    canchas: canchasSel.length === todas.length ? null : todas.filter((c) => canchasSel.includes(c)),
    horas: d.horas && complejo.horarios.filter((h) => d.horas!.includes(h)),
  })

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

  const reservas = (choques ?? []).filter((c) => !c.futuro_fijo)
  const guardar = () => ejecutar(async () => {
    await guardarBloqueo(token, complejo.id, d.id, datos())
    const libres = reservas.length
    alGuardar(`Bloqueo guardado${libres ? `. Se liberaron ${libres} turno${libres === 1 ? '' : 's'}.` : '.'}`)
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!canchasSel.length) return setError('Elegí al menos una cancha.')
    if (d.hasta < d.desde) return setError('La fecha "hasta" no puede ser anterior a "desde".')
    if (d.horas && !d.horas.length) return setError('Elegí al menos un turno, o marcá "Todo el día".')
    ejecutar(async () => {
      const c = await previsualizarBloqueo(complejo.id, datos())
      if (!c.length) {
        await guardarBloqueo(token, complejo.id, d.id, datos())
        alGuardar('Bloqueo guardado.')
      } else setChoques(c)
    })
  }

  async function copiar() {
    const m = MOTIVOS[d.motivo].texto.toLowerCase()
    const lineas = (choques ?? []).map((c) =>
      `• ${corta(c.fecha)} ${c.hora}${multiples ? ` · ${c.cancha}` : ''} — ${c.para ?? 'sin nombre'}${c.fijo ? ` (turno fijo ${losDias(diaSemanaDe(c.fecha))})` : ''}`)
    const t = `Turnos que se liberan por ${m}${d.nota ? ` (${d.nota})` : ''}:\n${lineas.join('\n')}`
    try {
      await navigator.clipboard.writeText(t)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar. Mantené apretado el texto para copiarlo a mano.')
    }
  }

  const campo = 'w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-base text-noche focus:border-escudo focus:outline-none'
  const chip = (on: boolean) => `rounded-lg border px-3 py-1.5 font-tablero text-base font-bold ${on ? 'border-escudo bg-escudo text-white' : 'border-linea bg-white text-tinta'}`
  const resumen = `${textoCanchas(datos().canchas, todas)} · ${textoFechas(d)} · ${textoTurnos(datos().horas, complejo.horarios)}`

  if (choques) {
    const n = reservas.length
    return (
      <Dialogo titulo={`Hay ${choques.length} turno${choques.length === 1 ? '' : 's'} reservado${choques.length === 1 ? '' : 's'}`} subtitulo={resumen} alCerrar={alCerrar}>
        <div className="space-y-2.5">
          <p className="text-sm text-tinta">Si confirmás, estos turnos se liberan. Avisales a estas personas que la cancha no va a estar disponible:</p>
          {choques.map((c, i) => (
            <div key={i} className="rounded-xl border border-rojo/30 bg-rojo/5 px-3 py-2">
              <p className="font-tablero text-lg font-bold leading-tight text-noche">
                {corta(c.fecha)} · {c.hora}{multiples && ` · ${c.cancha}`}
                {c.fijo && <span className="ml-1.5 rounded bg-pelota/40 px-1.5 py-0.5 align-middle font-sans text-[11px] font-bold text-noche">FIJO</span>}
              </p>
              <p className="text-sm text-tinta">
                Para <strong className="text-noche">{c.para ?? 'sin nombre'}</strong>
                {c.fijo
                  ? <> · {losDias(diaSemanaDe(c.fecha))}. {c.futuro_fijo ? 'Esa fecha no se va a reservar.' : 'Solo se libera este día.'}</>
                  : c.cargo && <> · cargó {c.cargo}</>}
              </p>
            </div>
          ))}
          {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
          <button onClick={copiar} className="w-full rounded-xl border border-linea py-2.5 font-semibold text-noche">
            {copiado ? '✓ Lista copiada' : '📋 Copiar lista para avisar'}
          </button>
          <button onClick={guardar} disabled={ocupado}
            className="w-full rounded-xl bg-rojo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
            {ocupado ? 'Guardando…' : n ? `Bloquear y liberar ${n} turno${n === 1 ? '' : 's'}` : 'Bloquear igual'}
          </button>
          <button onClick={() => { setChoques(null); setError(null) }} className="w-full py-1.5 font-semibold text-tinta">Cambiar el bloqueo</button>
        </div>
      </Dialogo>
    )
  }

  return (
    <Dialogo titulo={d.id ? 'Editar bloqueo' : 'Nuevo bloqueo'} subtitulo="Lo que bloquees no se puede reservar" alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-3.5">
        {multiples && (
          <div>
            <p className="mb-1.5 text-sm font-semibold">Canchas</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={chip(canchasSel.length === todas.length)} onClick={() => setD({ ...d, canchas: canchasSel.length === todas.length ? [] : null })}>Todas</button>
              {todas.map((c) => (
                <button type="button" key={c} className={chip(canchasSel.includes(c) && canchasSel.length !== todas.length)}
                  onClick={() => setD({ ...d, canchas: alternar(canchasSel.length === todas.length ? [] : canchasSel, c) })}>{c}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-sm font-semibold">Desde</span>
            <input type="date" className={campo} value={d.desde} min={inicial.id ? undefined : hoyISO()} required
              onChange={(e) => setD({ ...d, desde: e.target.value, hasta: e.target.value > d.hasta ? e.target.value : d.hasta })} /></label>
          <label className="block"><span className="mb-1 block text-sm font-semibold">Hasta</span>
            <input type="date" className={campo} value={d.hasta} min={d.desde} required onChange={(e) => setD({ ...d, hasta: e.target.value })} /></label>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Turnos</p>
          <div className="grid grid-cols-2 rounded-lg bg-niebla p-1">
            {(['todo', 'elegir'] as const).map((m) => {
              const on = m === 'todo' ? !d.horas : !!d.horas
              return <button type="button" key={m} onClick={() => setD({ ...d, horas: m === 'todo' ? null : (d.horas ?? []) })}
                className={`rounded-md py-1.5 text-sm font-semibold ${on ? 'bg-white text-noche shadow-sm' : 'text-tinta'}`}>{m === 'todo' ? 'Todo el día' : 'Elegir turnos'}</button>
            })}
          </div>
          {d.horas && (
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {complejo.horarios.map((h) => (
                <button type="button" key={h} className={`${chip(d.horas!.includes(h))} px-0 text-center text-[15px]`}
                  onClick={() => setD({ ...d, horas: alternar(d.horas!, h) })}>{h}</button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Motivo</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MOTIVOS) as Motivo[]).map((m) => (
              <button type="button" key={m} className={chip(d.motivo === m)} onClick={() => setD({ ...d, motivo: m })}>{MOTIVOS[m].icono} {MOTIVOS[m].texto}</button>
            ))}
          </div>
        </div>
        <label className="block"><span className="mb-1 block text-sm font-semibold">Nota <span className="font-normal text-tinta">(opcional)</span></span>
          <input className={campo} value={d.nota} maxLength={60} placeholder="Ej: Cumpleaños de Juli" onChange={(e) => setD({ ...d, nota: e.target.value })} /></label>
        {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={ocupado} className="flex-1 rounded-xl bg-escudo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
            {ocupado ? 'Revisando…' : 'Guardar'}
          </button>
          <button type="button" onClick={alCerrar} className="rounded-xl border border-linea px-5 font-semibold text-noche">Cancelar</button>
        </div>
      </form>
    </Dialogo>
  )
}