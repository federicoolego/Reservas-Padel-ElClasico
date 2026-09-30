import { supabase } from './supabase'

// Clave propia: otras apps del mismo dominio (federicoolego.github.io) comparten localStorage.
const CLAVE = 'clasico-reservas:sesion:v1'

export interface Sesion {
  token: string
  usuario: string
  nombre: string
}

export function leerSesion(): Sesion | null {
  try {
    const s = localStorage.getItem(CLAVE)
    return s ? (JSON.parse(s) as Sesion) : null
  } catch {
    return null
  }
}

function guardar(s: Sesion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* modo privado sin storage: la sesión dura lo que dure la pestaña */
  }
}

export async function ingresar(usuario: string, clave: string, nombre: string): Promise<Sesion> {
  const { data, error } = await supabase.rpc('reservas_login', {
    p_usuario: usuario,
    p_clave: clave,
    p_nombre: nombre || null,
  })
  if (error) {
    if (error.code === '28P01') throw new Error('Usuario o contraseña incorrectos.')
    if (error.code === '22023') throw new Error(error.message)
    throw new Error('No se pudo conectar con el servidor. Probá de nuevo en unos segundos.')
  }
  const s: Sesion = { token: data as string, usuario: usuario.trim().toUpperCase(), nombre: nombre.trim() }
  guardar(s)
  return s
}

/** true si el token sigue vigente (por ejemplo, si no cambiaron la contraseña) */
export async function sesionVigente(s: Sesion): Promise<boolean> {
  const { data, error } = await supabase.rpc('reservas_validar', { p_token: s.token })
  if (error) return true // sin conexión: no la cerramos, la escritura avisará si venció
  return data === true
}

export async function salir(s: Sesion | null) {
  guardar(null)
  if (s) await supabase.rpc('reservas_logout', { p_token: s.token })
}

export const olvidarSesion = () => guardar(null)