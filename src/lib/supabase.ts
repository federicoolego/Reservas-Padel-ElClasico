import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configFaltante = !url || !key

// La app no usa Supabase Auth (el login es propio), así que no persiste sesión de Auth.
// storageKey propio para no pisar la sesión de la app de torneos en el mismo dominio.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'falta-configurar', {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'clasico-reservas:auth' },
})
