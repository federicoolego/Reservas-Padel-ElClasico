import type { Complejo } from '../config/complejos'
import { claveTurno, type MapaTurnos } from './turnos'
import { etiquetaRelativa, fechaLarga } from './fechas'
import { logoUrl } from './marca'

export interface ContactoImagen {
  nombre: string
  telefono: string
}

// Imagen vertical pensada para WhatsApp (estado o chat)
const ANCHO = 1080
const ALTO = 1700

const C = {
  pelota: '#D2DA1F',
  blanco: '#FFFFFF',
}

const FUENTE = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif'

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = mal
    img.src = src
  })
}

async function prepararFuentes() {
  try {
    await Promise.all([
      document.fonts.load(`800 100px "Barlow Condensed"`),
      document.fonts.load(`700 60px "Barlow Condensed"`),
      document.fonts.load(`600 30px "Barlow Condensed"`),
      document.fonts.load(`600 44px "Barlow"`),
    ])
  } catch {
    /* si no cargan, se usa la fuente de respaldo */
  }
}

// Random con semilla: la textura sale igual en cada generación
function aleatorio(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function texto(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  tam: number,
  peso = 800,
  color = C.blanco,
  alinear: CanvasTextAlign = 'center',
  sombra = true,
) {
  ctx.save()
  ctx.font = `${peso} ${tam}px ${FUENTE}`
  ctx.textAlign = alinear
  ctx.textBaseline = 'middle'
  if (sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = tam * 0.12
    ctx.shadowOffsetY = tam * 0.04
  }
  ctx.fillStyle = color
  ctx.fillText(t, x, y)
  ctx.restore()
}

function anchoTexto(ctx: CanvasRenderingContext2D, t: string, tam: number, peso = 800) {
  ctx.save()
  ctx.font = `${peso} ${tam}px ${FUENTE}`
  const w = ctx.measureText(t).width
  ctx.restore()
  return w
}

/** Achica la fuente hasta que el texto entre en el ancho disponible */
function tamQueEntra(ctx: CanvasRenderingContext2D, t: string, tamMax: number, anchoMax: number, peso = 800) {
  let tam = tamMax
  while (tam > 12 && anchoTexto(ctx, t, tam, peso) > anchoMax) tam -= 2
  return tam
}

function pelota(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = r * 0.4
  ctx.shadowOffsetY = r * 0.12
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r)
  g.addColorStop(0, '#F4F87A')
  g.addColorStop(0.6, '#D2DA1F')
  g.addColorStop(1, '#9CA60F')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  // costuras
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = r * 0.12
  ctx.beginPath()
  ctx.arc(cx - r * 1.05, cy, r * 0.78, -Math.PI / 3.2, Math.PI / 3.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + r * 1.05, cy, r * 0.78, Math.PI - Math.PI / 3.2, Math.PI + Math.PI / 3.2)
  ctx.stroke()
  ctx.restore()
}

function marcaDeAgua(ctx: CanvasRenderingContext2D, y = ALTO - 34) {
  ctx.save()
  ctx.globalAlpha = 0.6
  texto(ctx, '🎾 Desarrollado por Federico Olego 🎾', ANCHO / 2, y, 24, 600, C.blanco , 'center', true)
  ctx.restore()
}

// ---------------------------------------------------------------------
// Estilo El Clásico: índigo y azul del escudo, minimalista, con pelotitas en los turnos reservados
// ---------------------------------------------------------------------
const P = {
  fondo: '#0D053E',
  claro: '#16307E',
  menta: '#A9C2F2',
  linea: 'rgba(255,255,255,0.18)',
  rojo: '#D7262E',
  azul: '#1F6FD1',
}
const SANS = '"Barlow", "Helvetica Neue", Arial, sans-serif'

/** Texto en Barlow con letras espaciadas */
function espaciado(ctx: CanvasRenderingContext2D, t: string, cx: number, y: number, tam: number, sep: number, color: string, peso = 600) {
  ctx.save()
  ctx.font = `${peso} ${tam}px ${SANS}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  const anchos = [...t].map((ch) => ctx.measureText(ch).width)
  const total = anchos.reduce((a, b) => a + b, 0) + sep * (anchos.length - 1)
  let x = cx - total / 2
  ;[...t].forEach((ch, i) => {
    ctx.fillText(ch, x, y)
    x += anchos[i] + sep
  })
  ctx.restore()
  return total
}

function fondoClasico(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(ANCHO / 2, 230, 60, ANCHO / 2, ALTO * 0.45, ALTO * 0.85)
  g.addColorStop(0, P.claro)
  g.addColorStop(0.55, '#0F1360')
  g.addColorStop(1, P.fondo)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // grano muy suave
  const r = aleatorio(20261004)
  for (let i = 0; i < 7000; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.025)'
    ctx.fillRect(r() * ANCHO, r() * ALTO, 1 + r() * 1.5, 1 + r() * 1.5)
  }

  // líneas de cancha de pádel, muy tenues, de fondo
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'
  ctx.lineWidth = 6
  const cx = ANCHO / 2
  const w = 760
  const h = 1520
  const y0 = (ALTO - h) / 2
  ctx.strokeRect(cx - w / 2, y0, w, h)
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, ALTO / 2)
  ctx.lineTo(cx + w / 2, ALTO / 2)
  ctx.moveTo(cx - w / 2, y0 + h * 0.15)
  ctx.lineTo(cx + w / 2, y0 + h * 0.15)
  ctx.moveTo(cx - w / 2, y0 + h * 0.85)
  ctx.lineTo(cx + w / 2, y0 + h * 0.85)
  ctx.moveTo(cx, y0 + h * 0.15)
  ctx.lineTo(cx, y0 + h * 0.85)
  ctx.stroke()
  ctx.restore()

  // marco fino + franja azul/roja arriba y abajo (colores del escudo)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2
  ctx.strokeRect(34, 34, ANCHO - 68, ALTO - 68)
  for (const y of [0, ALTO - 12]) {
    ctx.fillStyle = P.azul
    ctx.fillRect(0, y, ANCHO / 2, 12)
    ctx.fillStyle = P.rojo
    ctx.fillRect(ANCHO / 2, y, ANCHO / 2, 12)
  }
}

function tituloClasico(ctx: CanvasRenderingContext2D, fecha: string, logo: HTMLImageElement | null, nombre?: string) {
  const d = nombre ? 40 : 0 // cuánto baja el bloque de abajo cuando hay nombre
  if (logo) {
    const alto = nombre ? 280 : 300
    const ancho = (logo.width / logo.height) * alto
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 30
    ctx.drawImage(logo, (ANCHO - ancho) / 2, (nombre ? 192 : 205) - alto / 2, ancho, alto)
    ctx.restore()
  } else {
    espaciado(ctx, 'EL CLÁSICO', ANCHO / 2, 190, 96, 8, '#FFFFFF', 600)
  }

  // nombre del complejo debajo del logo, mismo tamaño que "TURNOS LIBRES"; el número en amarillo
  if (nombre) {
    const tam = 44
    const sep = 16
    ctx.save()
    ctx.font = `600 ${tam}px ${SANS}`
    const letras = [...nombre]
    const anchos = letras.map((ch) => ctx.measureText(ch).width)
    ctx.restore()
    const total = anchos.reduce((x, w) => x + w, 0) + sep * (letras.length - 1)
    let x = ANCHO / 2 - total / 2
    letras.forEach((ch, i) => {
      espaciado(ctx, ch, x + anchos[i] / 2, 368, tam, 0, /\d/.test(ch) ? C.pelota : '#FFFFFF', 600)
      x += anchos[i] + sep
    })
  }

  // ——  TURNOS LIBRES  ——
  const y = 405 + d
  const w = espaciado(ctx, 'TURNOS LIBRES', ANCHO / 2, y, 44, 16, '#FFFFFF', 600)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(ANCHO / 2 - w / 2 - 110, y - 1, 80, 2)
  ctx.fillRect(ANCHO / 2 + w / 2 + 30, y - 1, 80, 2)

  // fecha en una píldora con borde fino
  const etiqueta = etiquetaRelativa(fecha)
  const t = `${etiqueta ? `${etiqueta} · ` : ''}${fechaLarga(fecha).toUpperCase()}`
  ctx.save()
  ctx.font = `600 30px ${SANS}`
  const ancho = [...t].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + 5 * (t.length - 1) + 64
  ctx.restore()
  ctx.strokeStyle = 'rgba(210,218,31,0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(ANCHO / 2 - ancho / 2, 452 + d, ancho, 60, 30)
  ctx.stroke()
  espaciado(ctx, t, ANCHO / 2, 483 + d, 30, 5, C.pelota, 600)
}

function columnasClasico(ctx: CanvasRenderingContext2D, c: Complejo, turnos: MapaTurnos, top: number, alto: number) {
  const n = c.canchas.length
  const margen = 64
  const sep = 22
  const anchoCol = n === 1 ? 560 : (ANCHO - margen * 2 - sep * (n - 1)) / n
  const altoCab = 104
  const paso = Math.min(84, (alto - altoCab - 24) / c.horarios.length)
  const tamHora = Math.min(...c.horarios.map((h) => tamQueEntra(ctx, `${h} HS`, paso * 0.74, anchoCol - 40, 700)))
  const altoCol = altoCab + paso * c.horarios.length + 24

  c.canchas.forEach((cancha, i) => {
    const x = n === 1 ? (ANCHO - anchoCol) / 2 : margen + i * (anchoCol + sep)
    const cx = x + anchoCol / 2

    // tarjeta
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    ctx.beginPath()
    ctx.roundRect(x, top, anchoCol, altoCol, 26)
    ctx.fill()
    ctx.strokeStyle = P.linea
    ctx.lineWidth = 2
    ctx.stroke()

    // cabecera
    const nombre = cancha.toUpperCase()
    texto(ctx, nombre, cx, top + altoCab / 2 - 6, tamQueEntra(ctx, nombre, 72, anchoCol - 40), 800, '#FFFFFF', 'center', false)
    ctx.fillStyle = P.rojo
    ctx.fillRect(cx - 24, top + altoCab - 18, 48, 4)

    c.horarios.forEach((h, j) => {
      const y = top + altoCab + 12 + paso * j + paso / 2
      if (j > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)'
        ctx.fillRect(x + 24, y - paso / 2, anchoCol - 48, 1.5)
      }
      const reservada = turnos[claveTurno(cancha, h)]?.estado === 'reservada'
      texto(ctx, `${h} HS`, cx, y + 2, tamHora, 700, reservada ? 'rgba(255,255,255,0.38)' : '#FFFFFF', 'center', false)
      if (reservada) pelota(ctx, cx, y, paso * 0.36)
    })
  })
}

/** Contactos en grilla de 2 columnas (4 → 2×2, 3 → 2 + 1 centrado) */
function pieClasico(ctx: CanvasRenderingContext2D, lista: ContactoImagen[], top: number) {
  if (!lista.length) return
  const w = espaciado(ctx, 'RESERVAS', ANCHO / 2, top, 30, 12, P.menta, 600)
  ctx.fillStyle = 'rgba(169,207,195,0.45)'
  ctx.fillRect(ANCHO / 2 - w / 2 - 80, top - 1, 56, 2)
  ctx.fillRect(ANCHO / 2 + w / 2 + 24, top - 1, 56, 2)
  const filas: ContactoImagen[][] = []
  for (let i = 0; i < lista.length; i += 2) filas.push(lista.slice(i, i + 2))
  filas.forEach((fila, k) => {
    const y = top + 66 + 104 * k
    fila.forEach((ct, j) => {
      const x = fila.length === 1 ? ANCHO / 2 : j === 0 ? ANCHO * 0.29 : ANCHO * 0.71
      espaciado(ctx, ct.nombre.toUpperCase(), x, y, 24, 6, P.menta, 600)
      texto(ctx, ct.telefono, x, y + 42, tamQueEntra(ctx, ct.telefono, 50, 420, 700), 700, '#FFFFFF', 'center', false)
    })
  })
}

function dibujarClasico(ctx: CanvasRenderingContext2D, c: Complejo, fecha: string, turnos: MapaTurnos, logo: HTMLImageElement | null, contactos: ContactoImagen[]) {
  fondoClasico(ctx)
  tituloClasico(ctx, fecha, logo, c.nombreEnImagen)
  const filasPie = Math.ceil(contactos.length / 2)
  const altoPie = contactos.length ? 66 + 104 * filasPie + 30 : 0
  const top = c.nombreEnImagen ? 590 : 550
  const finColumnas = ALTO - 80 - altoPie
  columnasClasico(ctx, c, turnos, top, finColumnas - top - 20)
  pieClasico(ctx, contactos, finColumnas + 30)
  marcaDeAgua(ctx, ALTO - 58)
}

export async function generarImagen(c: Complejo, fecha: string, turnos: MapaTurnos, contactos: ContactoImagen[]): Promise<Blob> {
  await prepararFuentes()
  const logo = await cargarImagen(logoUrl()).catch(() => null)
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')!
  dibujarClasico(ctx, c, fecha, turnos, logo, contactos)
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen'))), 'image/png'))
}

export const nombreArchivo = (c: Complejo, fecha: string) => `turnos-${c.id}-${fecha}.png`