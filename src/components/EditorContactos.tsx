import { useState, type FormEvent } from 'react'
import type { Complejo } from '../config/complejos'
import { eliminarContacto, guardarContacto, MAX_CONTACTOS, moverContacto, type Contacto } from '../lib/contactos'
import { SesionVencida } from '../lib/turnos'

interface Props {
  complejo: Complejo
  contactos: Contacto[]
  token: string
  recargar: () => void
  alVencerSesion: () => void
}

interface Edicion {
  id: string | null
  nombre: string
  telefono: string
}

export default function EditorContactos({ complejo, contactos, token, recargar, alVencerSesion }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [edicion, setEdicion] = useState<Edicion | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
      recargar()
      return true
    } catch (e) {
      if (e instanceof SesionVencida) alVencerSesion()
      else setError((e as Error).message)
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!edicion) return
    const ok = await ejecutar(() => guardarContacto(token, complejo.id, edicion.id, edicion.nombre, edicion.telefono))
    if (ok) setEdicion(null)
  }

  function eliminar(c: Contacto) {
    if (!window.confirm(`¿Eliminar a ${c.nombre} de los contactos de ${complejo.nombre}?`)) return
    ejecutar(() => eliminarContacto(token, c.id))
  }

  const resumen = contactos.length ? contactos.map((c) => c.nombre).join(', ') : 'Sin contactos'
  const campo = 'w-full rounded-lg border border-linea bg-white px-3 py-2.5 text-base focus:border-escudo focus:outline-none'
  const chico = 'h-9 min-w-9 rounded-lg border border-linea px-2 text-sm font-semibold text-noche disabled:opacity-30'

  return (
    <div className="w-full max-w-md rounded-2xl border border-linea bg-white">
      <button onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block font-tablero text-xl font-bold">Contactos de la imagen</span>
          <span className="block truncate text-sm text-tinta">{resumen}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-escudo">{abierto ? 'Cerrar' : 'Editar'}</span>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-linea px-4 pb-4 pt-3">
          {contactos.length === 0 && !edicion && (
            <p className="text-sm text-tinta">La imagen sale sin teléfonos. Agregá al menos uno para que puedan reservar.</p>
          )}

          <ul className="space-y-2">
            {contactos.map((c, i) =>
              edicion?.id === c.id ? null : (
                <li key={c.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.nombre}</span>
                    <span className="block text-sm tabular-nums text-tinta">{c.telefono}</span>
                  </div>
                  <button className={chico} disabled={ocupado || i === 0} onClick={() => ejecutar(() => moverContacto(token, c.id, -1))} aria-label={`Subir a ${c.nombre}`}>↑</button>
                  <button className={chico} disabled={ocupado || i === contactos.length - 1} onClick={() => ejecutar(() => moverContacto(token, c.id, 1))} aria-label={`Bajar a ${c.nombre}`}>↓</button>
                  <button className={chico} disabled={ocupado} onClick={() => setEdicion({ id: c.id, nombre: c.nombre, telefono: c.telefono })}>Editar</button>
                  <button className={`${chico} text-rojo`} disabled={ocupado} onClick={() => eliminar(c)}>Eliminar</button>
                </li>
              ),
            )}
          </ul>

          {edicion ? (
            <form onSubmit={enviar} className="space-y-2 rounded-xl bg-niebla p-3">
              <p className="text-sm font-semibold">{edicion.id ? 'Editar contacto' : 'Nuevo contacto'}</p>
              <input className={campo} placeholder="Nombre" value={edicion.nombre} maxLength={20} required autoFocus
                onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} />
              <input className={campo} placeholder="Teléfono (ej: 3407430502)" value={edicion.telefono} inputMode="tel" maxLength={20} required
                pattern="[0-9 +()\-]{6,20}" title="Entre 6 y 20 números"
                onChange={(e) => setEdicion({ ...edicion, telefono: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" disabled={ocupado} className="flex-1 rounded-lg bg-escudo py-2.5 font-semibold text-white disabled:opacity-60">
                  {ocupado ? 'Guardando…' : 'Guardar'}
                </button>
                <button type="button" onClick={() => { setEdicion(null); setError(null) }} className="rounded-lg border border-linea px-4 font-semibold">
                  Cancelar
                </button>
              </div>
            </form>
          ) : contactos.length < MAX_CONTACTOS ? (
            <button onClick={() => setEdicion({ id: null, nombre: '', telefono: '' })}
              className="w-full rounded-lg border-2 border-dashed border-escudo/50 py-2.5 font-semibold text-escudo">
              Agregar contacto
            </button>
          ) : (
            <p className="text-sm text-tinta">Llegaste al máximo de {MAX_CONTACTOS} contactos, que es lo que entra en la imagen.</p>
          )}

          {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
          <p className="text-xs text-tinta">El orden es el de la imagen. Los cambios se ven al instante en todos los dispositivos.</p>
        </div>
      )}
    </div>
  )
}