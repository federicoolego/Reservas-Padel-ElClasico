import { useEffect, useState } from 'react'
import type { Complejo } from '../config/complejos'
import type { MapaTurnos } from '../lib/turnos'
import { generarImagen, nombreArchivo } from '../lib/imagen'
import { useContactos } from '../lib/contactos'
import EditorContactos from './EditorContactos'

interface Props {
  complejo: Complejo
  fecha: string
  turnos: MapaTurnos
  token: string
  alVencerSesion: () => void
}

export default function VistaImagen({ complejo, fecha, turnos, token, alVencerSesion }: Props) {
  const { contactos, cargado, recargar } = useContactos(complejo.id)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Se regenera sola cada vez que cambia un turno o un contacto (también si lo cambia otra persona)
  useEffect(() => {
    if (!cargado) return
    let vigente = true
    const t = window.setTimeout(async () => {
      try {
        const b = await generarImagen(complejo, fecha, turnos, contactos)
        if (!vigente) return
        setBlob(b)
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(b)
        })
        setError(null)
      } catch {
        if (vigente) setError('No se pudo generar la imagen.')
      }
    }, 150)
    return () => {
      vigente = false
      window.clearTimeout(t)
    }
  }, [complejo, fecha, turnos, contactos, cargado])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const archivo = blob ? new File([blob], nombreArchivo(complejo, fecha), { type: 'image/png' }) : null
  const puedeCompartir = !!archivo && typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] })

  async function compartir() {
    if (!archivo) return
    try {
      await navigator.share({ files: [archivo] })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('No se pudo abrir el menú para compartir. Descargala y mandala a mano.')
    }
  }

  function descargar() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo(complejo, fecha)
    a.click()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {puedeCompartir && (
          <button onClick={compartir} className="col-span-2 rounded-xl bg-[#1FA855] py-3.5 font-tablero text-2xl font-bold text-white">
            Compartir por WhatsApp
          </button>
        )}
        <button onClick={descargar} disabled={!url}
          className={`col-span-2 rounded-xl border-2 border-noche py-3 font-tablero text-xl font-bold text-noche disabled:opacity-50`}>
          Descargar imagen
        </button>
      </div>
      {error && <p className="text-sm font-medium text-rojo">{error}</p>}
      <EditorContactos complejo={complejo} contactos={contactos} token={token} recargar={recargar} alVencerSesion={alVencerSesion} />
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-noche/5 shadow-xl">
        {url ? (
          <img src={url} alt={`Turnos de ${complejo.nombre}`} className="block w-full" />
        ) : (
          <div className="flex aspect-[1080/1700] items-center justify-center text-tinta">Armando la imagen…</div>
        )}
      </div>
      <p className="text-center text-xs text-tinta">La imagen se actualiza sola con cada cambio de la tabla.</p>
    </div>
  )
}