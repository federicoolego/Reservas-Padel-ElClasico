import { useRef } from 'react'
import { fechaLarga, hoyISO, sumarDias } from '../lib/fechas'
import { DIAS_HISTORIA, fechaMaxima } from '../config/limites'

export default function SelectorFecha({ fecha, onCambio }: { fecha: string; onCambio: (f: string) => void }) {
  const hoy = hoyISO()
  const min = sumarDias(hoy, -DIAS_HISTORIA)
  const max = fechaMaxima(hoy)
  const input = useRef<HTMLInputElement>(null)

  const etiqueta = fecha === hoy ? 'Hoy' : fecha === sumarDias(hoy, 1) ? 'Mañana' : fecha === sumarDias(hoy, -1) ? 'Ayer' : 'Tocá para elegir otro día'
  const boton = 'h-11 w-11 shrink-0 rounded-full bg-white border border-linea text-2xl leading-none text-noche active:bg-linea disabled:opacity-35'

  // Las fechas ISO (YYYY-MM-DD) se comparan bien como texto
  const elegir = (f: string) => onCambio(f < min ? min : f > max ? max : f)

  function abrirCalendario() {
    const el = input.current
    if (!el) return
    try {
      el.showPicker() // Chrome, Edge, Safari 16+, Firefox 101+
    } catch {
      el.focus()
      el.click()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button className={boton} onClick={() => elegir(sumarDias(fecha, -1))} disabled={fecha <= min} aria-label="Día anterior">‹</button>

      <div className="relative flex-1 min-w-0">
        <button type="button" onClick={abrirCalendario} className="w-full rounded-xl py-1 text-center active:bg-linea/60"
          aria-label={`Elegir fecha, seleccionada ${fechaLarga(fecha)}`}>
          <span className="flex items-center justify-center gap-2 font-tablero text-2xl font-bold capitalize leading-tight">
            <span className="truncate">{fechaLarga(fecha)}</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-escudo" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </span>
          <span className="block text-xs text-tinta">{etiqueta}</span>
        </button>
        {/* input nativo invisible, debajo del botón: solo aporta el calendario del sistema */}
        <input
          ref={input}
          type="date"
          value={fecha}
          min={min}
          max={max}
          onChange={(e) => e.target.value && elegir(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      </div>

      <button className={boton} onClick={() => elegir(sumarDias(fecha, 1))} disabled={fecha >= max} aria-label="Día siguiente">›</button>
      {fecha !== hoy && (
        <button onClick={() => onCambio(hoy)} className="h-11 shrink-0 rounded-full bg-noche px-4 text-sm font-semibold text-white">
          Hoy
        </button>
      )}
    </div>
  )
}