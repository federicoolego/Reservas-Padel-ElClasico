import { useEffect, useState } from 'react'
import { COMPLEJOS, complejoPorId, type ComplejoId } from './config/complejos'
import { configFaltante } from './lib/supabase'
import { leerSesion, olvidarSesion, salir, sesionVigente, type Sesion } from './lib/sesion'
import { hoyISO } from './lib/fechas'
import { useTurnos } from './lib/useTurnos'
import { logoUrl } from './lib/marca'
import Login from './pages/Login'
import SelectorFecha from './components/SelectorFecha'
import TablaTurnos from './components/TablaTurnos'
import VistaImagen from './components/VistaImagen'
import VistaFijos from './components/VistaFijos'
import { sincronizarFijos } from './lib/fijos'
import { SesionVencida } from './lib/turnos'
import Ayuda from './components/Ayuda'

type Pestana = 'turnos' | 'fijos' | 'imagen'
// Siempre arranca en El Clásico, pestaña Turnos, día de hoy
const VISTA_INICIAL: { complejo: ComplejoId; pestana: Pestana } = { complejo: COMPLEJOS[0].id, pestana: 'turnos' }

export default function App() {
  // Las sesiones sin nombre (anteriores a que fuera obligatorio) vuelven a pedir login
  const [sesion, setSesion] = useState<Sesion | null>(() => {
    const s = leerSesion()
    if (s && !s.nombre) {
      olvidarSesion()
      return null
    }
    return s
  })
  const [vencida, setVencida] = useState(false)

  useEffect(() => {
    if (sesion) sesionVigente(sesion).then((ok) => !ok && vencer())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function vencer() {
    olvidarSesion()
    setSesion(null)
    setVencida(true)
  }

  if (configFaltante) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="font-tablero text-3xl font-bold">Falta configurar Supabase</h1>
        <p className="mt-2 text-tinta">
          Cargá <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> como variables del environment
          <code> github-pages</code> (o en un archivo <code>.env</code> para correrla local) y volvé a publicar.
        </p>
      </div>
    )
  }

  if (!sesion) {
    return (
      <>
        {vencida && (
          <p className="fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-10 bg-pelota py-2 text-center text-sm font-semibold text-noche">
            La sesión se cerró (cambió la contraseña o venció). Volvé a ingresar.
          </p>
        )}
        <Login alIngresar={(s) => { setVencida(false); setSesion(s) }} />
      </>
    )
  }

  return <Principal sesion={sesion} alSalir={() => { salir(sesion); setSesion(null) }} alVencer={vencer} />
}

function Principal({ sesion, alSalir, alVencer }: { sesion: Sesion; alSalir: () => void; alVencer: () => void }) {
  const [vista, setVista] = useState(VISTA_INICIAL)
  const [fecha, setFecha] = useState(hoyISO)
  const [ayuda, setAyuda] = useState(false)
  const complejo = complejoPorId(vista.complejo)
  const { turnos, cargando, error, recargar, aplicarLocal } = useTurnos(fecha, complejo.id)

  // Al abrir la app se reservan los fijos que entraron en la ventana de días (idempotente)
  useEffect(() => {
    sincronizarFijos(sesion.token).catch((e) => e instanceof SesionVencida && alVencer())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-[100dvh] pb-24">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 bg-noche text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-3">
          <img src={logoUrl()} alt="" className="h-11 w-auto" />
          <h1 className="flex-1 font-tablero text-3xl font-extrabold tracking-wide">Turnos</h1>
          <span className="hidden text-sm text-white/70 sm:inline">{sesion.nombre || sesion.usuario}</span>
          <button onClick={() => setAyuda(true)} className="rounded-full border border-white/30 px-3 py-1.5 text-sm font-semibold">Ayuda</button>
          <button onClick={alSalir} className="rounded-full border border-white/30 px-3 py-1.5 text-sm font-semibold">Salir</button>
        </div>
        {/* módulos */}
        <nav className="mx-auto mt-3 flex max-w-3xl px-2" aria-label="Complejo">
          {COMPLEJOS.map((c) => {
            const activo = c.id === complejo.id
            return (
              <button key={c.id} onClick={() => setVista((v) => ({ ...v, complejo: c.id }))} aria-current={activo}
                className={`flex-1 border-b-4 px-2 pb-2.5 pt-1 font-tablero text-2xl font-bold transition-colors ${
                  activo ? 'border-pelota text-white' : 'border-transparent text-white/55'}`}>
                {c.nombre}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        {vista.pestana !== 'fijos' && <SelectorFecha fecha={fecha} onCambio={setFecha} />}

        {/* pestañas del módulo */}
        <div className="grid grid-cols-3 rounded-xl bg-white p-1 border border-linea" role="tablist">
          {(['fijos', 'turnos', 'imagen'] as const).map((p) => (
            <button key={p} role="tab" aria-selected={vista.pestana === p}
              onClick={() => setVista((v) => ({ ...v, pestana: p }))}
              className={`rounded-lg py-2.5 font-tablero text-xl font-bold ${
                vista.pestana === p ? 'bg-escudo text-white' : 'text-tinta'}`}>
              {p === 'turnos' ? 'Turnos' : p === 'fijos' ? 'Fijos' : 'Imagen'}
            </button>
          ))}
        </div>

        {error && vista.pestana !== 'fijos' && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-rojo/10 px-4 py-3 text-rojo">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={recargar} className="shrink-0 text-sm font-bold underline">Reintentar</button>
          </div>
        )}

        {vista.pestana === 'fijos' ? (
          <VistaFijos complejo={complejo} token={sesion.token} alVencerSesion={alVencer} />
        ) : cargando ? (
          <p className="py-16 text-center text-tinta">Cargando turnos…</p>
        ) : vista.pestana === 'turnos' ? (
          <TablaTurnos complejo={complejo} fecha={fecha} turnos={turnos} token={sesion.token}
            aplicarLocal={aplicarLocal} alVencerSesion={alVencer} />
        ) : (
          <VistaImagen complejo={complejo} fecha={fecha} turnos={turnos} token={sesion.token} alVencerSesion={alVencer} />
        )}
      </main>
      {ayuda && <Ayuda alCerrar={() => setAyuda(false)} />}
    </div>
  )
}