import { useState, type FormEvent } from 'react'
import { ingresar, type Sesion } from '../lib/sesion'
import { logoUrl } from '../lib/marca'

export default function Login({ alIngresar }: { alIngresar: (s: Sesion) => void }) {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      alIngresar(await ingresar(usuario, clave, nombre))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const campo =
    'w-full rounded-lg border border-linea bg-white px-4 py-3 text-base text-noche placeholder:text-tinta/60 focus:border-escudo focus:outline-none'

  return (
    <div className="min-h-[100dvh] bg-noche flex flex-col items-center justify-center px-5 py-10">
      <img src={logoUrl()} alt="El Clásico Pádel" className="w-40 drop-shadow-xl" />
      <h1 className="mt-4 font-tablero text-5xl font-extrabold text-white tracking-wide">Turnos</h1>
      <p className="mt-1 text-white/70">Reservas de canchas de El Clásico y El Clásico 2</p>

      <form onSubmit={enviar} className="mt-8 w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <label className="block">
          <span className="text-sm font-semibold">Usuario</span>
          <input className={`${campo} mt-1 uppercase`} value={usuario} onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username" autoCapitalize="characters" required />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Contraseña</span>
          <input className={`${campo} mt-1`} type="password" value={clave} onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password" required />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Tu nombre</span>
          <input className={`${campo} mt-1`} value={nombre} onChange={(e) => setNombre(e.target.value)}
            maxLength={30} placeholder="Ej: Uma" autoComplete="given-name" />
          <span className="mt-1 block text-xs text-tinta">Opcional. Queda registrado en cada turno que cambies.</span>
        </label>
        {error && <p className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{error}</p>}
        <button type="submit" disabled={enviando}
          className="w-full rounded-lg bg-escudo py-3 font-tablero text-2xl font-bold text-white disabled:opacity-60">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
