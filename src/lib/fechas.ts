const ZONA = 'America/Argentina/Buenos_Aires'

/** Fecha de hoy en Argentina, formato YYYY-MM-DD */
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Hora actual en Argentina, formato HH:MM */
export function ahoraHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + dias))
  return f.toISOString().slice(0, 10)
}

/** "miércoles 30/09" */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d))
  const dia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' }).format(f)
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}

/** Hora local HH:MM de un timestamp */
export function horaDe(ts: string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts))
}

/** "30/09 a las 19:42" (hora Argentina) de un timestamp */
export function fechaHoraDe(ts: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  )
  return `${p.day}/${p.month} a las ${p.hour}:${p.minute}`
}

/** "30/09" */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** HOY / AYER / MAÑANA según la fecha de hoy en Argentina, o null para cualquier otro día */
export function etiquetaRelativa(iso: string): 'HOY' | 'AYER' | 'MAÑANA' | null {
  const hoy = hoyISO()
  if (iso === hoy) return 'HOY'
  if (iso === sumarDias(hoy, -1)) return 'AYER'
  if (iso === sumarDias(hoy, 1)) return 'MAÑANA'
  return null
}