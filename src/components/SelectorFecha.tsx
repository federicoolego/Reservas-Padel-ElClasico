import { fechaLarga, hoyISO, sumarDias } from '../lib/fechas'

export default function SelectorFecha({ fecha, onCambio }: { fecha: string; onCambio: (f: string) => void }) {
  const hoy = hoyISO()
  const etiqueta = fecha === hoy ? 'Hoy' : fecha === sumarDias(hoy, 1) ? 'Mañana' : fecha === sumarDias(hoy, -1) ? 'Ayer' : null
  const boton = 'h-11 w-11 shrink-0 rounded-full bg-white border border-linea text-2xl leading-none text-noche active:bg-linea'

  return (
    <div className="flex items-center gap-2">
      <button className={boton} onClick={() => onCambio(sumarDias(fecha, -1))} aria-label="Día anterior">‹</button>
      <label className="relative flex-1 min-w-0 text-center cursor-pointer">
        <span className="block font-tablero text-2xl font-bold capitalize leading-tight truncate">{fechaLarga(fecha)}</span>
        <span className="block text-xs text-tinta">{etiqueta ?? 'Tocá para elegir otro día'}</span>
        <input type="date" value={fecha} onChange={(e) => e.target.value && onCambio(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Elegir fecha" />
      </label>
      <button className={boton} onClick={() => onCambio(sumarDias(fecha, 1))} aria-label="Día siguiente">›</button>
      {fecha !== hoy && (
        <button onClick={() => onCambio(hoy)} className="h-11 shrink-0 rounded-full bg-noche px-4 text-sm font-semibold text-white">
          Hoy
        </button>
      )}
    </div>
  )
}
