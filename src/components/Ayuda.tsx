import { useEffect, useRef, type ReactNode } from 'react'
import { DIAS_ADELANTE, DIAS_HISTORIA } from '../config/limites'
import { hoyISO, sumarDias } from '../lib/fechas'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-linea pt-5">
      <h3 className="font-tablero text-2xl font-bold text-noche">{titulo}</h3>
      <div className="mt-2 space-y-2 leading-relaxed text-tinta">{children}</div>
    </section>
  )
}

export default function Ayuda({ alCerrar }: { alCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null)
  const hoy = hoyISO()
  const desde = ddmm(sumarDias(hoy, -DIAS_HISTORIA))
  const hasta = ddmm(sumarDias(hoy, DIAS_ADELANTE))

  // ref para no re-ejecutar el efecto en cada render (la tabla se actualiza en tiempo real)
  const alCerrarRef = useRef(alCerrar)
  alCerrarRef.current = alCerrar

  useEffect(() => {
    cerrar.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && alCerrarRef.current()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [])

  const b = (t: string) => <strong className="text-noche">{t}</strong>

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-ayuda"
      className="fixed inset-0 z-30 flex justify-center bg-noche/60 pt-[env(safe-area-inset-top,0px)]" onClick={alCerrar}>
      <div className="mt-6 flex w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:mb-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-noche px-5 py-4 text-white">
          <h2 id="titulo-ayuda" className="font-tablero text-3xl font-extrabold">Cómo se usa</h2>
          <button ref={cerrar} onClick={alCerrar} className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold">Cerrar</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-5">
          <p className="leading-relaxed text-tinta">
            Esta app reemplaza a la imagen que se iba editando a mano: todos los que toman reservas cargan en la
            misma tabla y la imagen para WhatsApp se arma sola.
          </p>

          <Seccion titulo="Ingresar">
            <p>Entrá con el usuario y la contraseña del complejo. En {b('Tu nombre')} poné cómo te llaman: aparece en cada turno que marques, así se sabe quién lo tomó.</p>
            <p>La sesión queda abierta en ese celu o compu durante 60 días. Si la usás en un equipo compartido, tocá {b('Salir')} al terminar.</p>
          </Seccion>

          <Seccion titulo="Elegir complejo y día">
            <p>Arriba elegís {b('El Clásico')} (BX1, BX2 y C1) o {b('El Clásico 2')}.</p>
            <p>Con las flechas ‹ › pasás al día anterior o al siguiente. Para ir a una fecha puntual, tocá la fecha y se abre el calendario. El botón {b('Hoy')} te vuelve al día actual.</p>
          </Seccion>

          <Seccion titulo="Cargar una reserva">
            <p>En la pestaña {b('Turnos')}, tocá el horario en la cancha que corresponde: pasa de {b('Libre')} a {b('Reservada')}. Para liberarlo, tocalo de nuevo.</p>
            <p>Abajo aparece un aviso con {b('Deshacer')} durante unos segundos, por si tocaste sin querer.</p>
            <p>Cada turno reservado muestra quién lo marcó y a qué hora. Los horarios que ya pasaron se ven más claros.</p>
            <p>Si otra persona reserva o libera un turno, lo ves al instante en tu pantalla, sin recargar.</p>
          </Seccion>

          <Seccion titulo="Compartir la imagen">
            <p>En la pestaña {b('Imagen')} está la imagen del día elegido, actualizada con la tabla. No hay que generarla: cambia sola con cada reserva.</p>
            <p>En el celu, tocá {b('Compartir por WhatsApp')} y elegí el chat o el estado. En la compu, tocá {b('Descargar imagen')} y arrastrala a WhatsApp Web.</p>
          </Seccion>

          <Seccion titulo="Contactos de la imagen">
            <p>Los teléfonos del pie de la imagen se editan en la pestaña {b('Imagen')}, tocando {b('Contactos de la imagen')}. Ahí podés agregar, editar, eliminar y cambiar el orden con las flechas ↑ ↓.</p>
            <p>Cada complejo tiene sus propios contactos, hasta 4. El orden de la lista es el de la imagen, y los cambios se ven al instante en todos los dispositivos.</p>
          </Seccion>

          <Seccion titulo="Qué fechas se pueden usar">
            <p>Se pueden ver y cargar turnos desde {DIAS_HISTORIA} días atrás hasta {DIAS_ADELANTE} días adelante. Hoy eso es del {b(desde)} al {b(hasta)}. El rango se corre solo cada día.</p>
            <p>Fuera de ese rango, las flechas se desactivan y el calendario no deja elegir la fecha.</p>
          </Seccion>

          <Seccion titulo="Borrado automático">
            <p>Los turnos de más de {DIAS_HISTORIA} días se borran solos de la base, y no se pueden recuperar. Así la base no crece sin límite.</p>
            <p>Si necesitás guardar cómo quedó un día, descargá su imagen antes de que se cumpla ese plazo.</p>
          </Seccion>

          <Seccion titulo="Si algo no anda">
            <p>{b('"La sesión se cerró"')}: cambió la contraseña o pasaron los 60 días. Volvé a ingresar.</p>
            <p>{b('"No se pudo guardar el cambio"')}: se cortó la conexión. El turno vuelve a como estaba; tocalo de nuevo cuando tengas señal.</p>
            <p>{b('No aparece el botón de compartir')}: ese navegador no lo permite. Usá {b('Descargar imagen')} y mandala desde WhatsApp.</p>
          </Seccion>
        </div>
      </div>
    </div>
  )
}