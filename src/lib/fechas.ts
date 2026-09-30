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
