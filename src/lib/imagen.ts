import type { Complejo } from '../config/complejos'
import { claveTurno, type MapaTurnos } from './turnos'
import { ddmm, etiquetaRelativa } from './fechas'

export interface ContactoImagen {
  nombre: string
  telefono: string
}

// Imagen vertical pensada para WhatsApp (estado o chat)
const ANCHO = 1080
const ALTO = 1700

const C = {
  noche: '#0D053E',
  escudo: '#0E599C',
  pelota: '#D2DA1F',
  rojo: '#D7262E',
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

function cruz(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 8
  for (const [color, grosor] of [
    ['rgba(255,255,255,0.85)', r * 0.34],
    [C.rojo, r * 0.22],
  ] as const) {
    ctx.strokeStyle = color
    ctx.lineWidth = grosor
    ctx.beginPath()
    ctx.moveTo(cx - r, cy - r * 0.85)
    ctx.lineTo(cx + r, cy + r * 0.85)
    ctx.moveTo(cx + r, cy - r * 0.85)
    ctx.lineTo(cx - r, cy + r * 0.85)
    ctx.stroke()
    ctx.shadowColor = 'transparent'
  }
  ctx.restore()
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

function logoEn(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, cx: number, cy: number, alto: number) {
  if (!logo) return
  const ancho = (logo.width / logo.height) * alto
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 24
  ctx.drawImage(logo, cx - ancho / 2, cy - alto / 2, ancho, alto)
  ctx.restore()
}

/**
 * Hoy, ayer y mañana: "HOY" grande y la fecha chica abajo.
 * Cualquier otro día: solo la fecha. y es el centro del bloque.
 */
function lineaFecha(ctx: CanvasRenderingContext2D, fecha: string, y: number) {
  const etiqueta = etiquetaRelativa(fecha)
  if (etiqueta) {
    texto(ctx, etiqueta, ANCHO / 2, y - 20, 70, 800, C.pelota)
    texto(ctx, ddmm(fecha), ANCHO / 2, y + 30, 36, 700, C.blanco)
  } else {
    texto(ctx, ddmm(fecha), ANCHO / 2, y, 54, 800, C.pelota)
  }
}

// ---------------------------------------------------------------------
// Estilo "noche": cancha azul iluminada, lista única con cruces (El Clásico 2)
// ---------------------------------------------------------------------
function fondoNoche(ctx: CanvasRenderingContext2D) {
  const cielo = ctx.createLinearGradient(0, 0, 0, ALTO)
  cielo.addColorStop(0, '#050B2A')
  cielo.addColorStop(0.45, '#0A2366')
  cielo.addColorStop(1, '#0D3A94')
  ctx.fillStyle = cielo
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // piso de la cancha en perspectiva
  const hz = ALTO * 0.52
  const piso = ctx.createLinearGradient(0, hz, 0, ALTO)
  piso.addColorStop(0, '#123E9C')
  piso.addColorStop(1, '#1E5BD0')
  ctx.fillStyle = piso
  ctx.beginPath()
  ctx.moveTo(ANCHO * 0.22, hz)
  ctx.lineTo(ANCHO * 0.78, hz)
  ctx.lineTo(ANCHO * 1.15, ALTO)
  ctx.lineTo(-ANCHO * 0.15, ALTO)
  ctx.closePath()
  ctx.fill()

  // alambrado lateral
  ctx.strokeStyle = 'rgba(120,160,255,0.16)'
  ctx.lineWidth = 3
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    ctx.beginPath()
    ctx.moveTo(ANCHO * 0.22 * t, hz - 380 * (1 - t) - 120)
    ctx.lineTo(ANCHO * 0.22 * t - ANCHO * 0.15 * (1 - t), ALTO)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ANCHO - ANCHO * 0.22 * t, hz - 380 * (1 - t) - 120)
    ctx.lineTo(ANCHO - ANCHO * 0.22 * t + ANCHO * 0.15 * (1 - t), ALTO)
    ctx.stroke()
  }

  // línea central
  const lc = ctx.createLinearGradient(0, hz, 0, ALTO)
  lc.addColorStop(0, 'rgba(255,255,255,0.15)')
  lc.addColorStop(1, 'rgba(255,255,255,0.75)')
  ctx.fillStyle = lc
  ctx.beginPath()
  ctx.moveTo(ANCHO / 2 - 3, hz)
  ctx.lineTo(ANCHO / 2 + 3, hz)
  ctx.lineTo(ANCHO / 2 + 26, ALTO)
  ctx.lineTo(ANCHO / 2 - 26, ALTO)
  ctx.closePath()
  ctx.fill()

  // reflectores
  for (const [x, y] of [
    [60, 330],
    [ANCHO - 60, 330],
    [230, 690],
    [ANCHO - 230, 690],
  ]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 180)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.08, 'rgba(200,225,255,0.55)')
    g.addColorStop(1, 'rgba(120,170,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 180, y - 180, 360, 360)
  }

  // oscurecer el centro para que se lea la lista
  const v = ctx.createRadialGradient(ANCHO / 2, ALTO * 0.55, 100, ANCHO / 2, ALTO * 0.55, ANCHO * 0.75)
  v.addColorStop(0, 'rgba(5,11,42,0.55)')
  v.addColorStop(1, 'rgba(5,11,42,0)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // marco rojo
  ctx.strokeStyle = C.rojo
  ctx.lineWidth = 7
  ctx.strokeRect(38, 38, ANCHO - 76, ALTO - 76)
}

function dibujarNoche(ctx: CanvasRenderingContext2D, c: Complejo, fecha: string, turnos: MapaTurnos, logo: HTMLImageElement | null, contactos: ContactoImagen[]) {
  fondoNoche(ctx)
  texto(ctx, 'TURNOS PÁDEL', ANCHO / 2, 125, 92)
  texto(ctx, c.tituloImagen, ANCHO / 2, 218, 92)
  ctx.fillStyle = C.rojo
  ctx.fillRect(ANCHO / 2 - 160, 274, 320, 5)
  lineaFecha(ctx, fecha, 328)
  logoEn(ctx, logo, ANCHO / 2, 480, 200)

  const top = 600
  const disponible = ALTO - 235 - top
  const n = c.horarios.length
  const cancha = c.canchas[0]

  // Si el complejo tuviera más de una cancha con este estilo, se agrupa por columnas.
  if (c.canchas.length > 1) {
    dibujarColumnas(ctx, c, turnos, logo, top, disponible, 'cruz')
  } else {
    const paso = Math.min(84, disponible / n)
    const tam = paso * 1.08
    for (let i = 0; i < n; i++) {
      const h = c.horarios[i]
      const y = top + paso * i + paso / 2
      if (i > 0) {
        const g = ctx.createLinearGradient(260, 0, ANCHO - 260, 0)
        g.addColorStop(0, 'rgba(215,38,46,0)')
        g.addColorStop(0.5, 'rgba(215,38,46,0.75)')
        g.addColorStop(1, 'rgba(215,38,46,0)')
        ctx.fillStyle = g
        ctx.fillRect(220, y - paso / 2 - 1, ANCHO - 440, 2)
      }
      texto(ctx, `${h}HS`, ANCHO / 2, y + 2, tam)
      if (turnos[claveTurno(cancha, h)]?.estado === 'reservada') cruz(ctx, ANCHO / 2, y, paso * 0.5)
    }
  }
  pieContactos(ctx, contactos, 'lados')
  marcaDeAgua(ctx, ALTO - 60)
}

// ---------------------------------------------------------------------
// Estilo "césped": pasto con columnas por cancha y pelotitas (El Clásico)
// ---------------------------------------------------------------------
function fondoCesped(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1B5227'
  ctx.fillRect(0, 0, ANCHO, ALTO)
  const r = aleatorio(20260930)
  const tonos = ['#236B31', '#174A22', '#2A7A39', '#123D1B', '#2F8540']
  for (let i = 0; i < 26000; i++) {
    const x = r() * ANCHO
    const y = r() * ALTO
    ctx.strokeStyle = tonos[Math.floor(r() * tonos.length)]
    ctx.globalAlpha = 0.35 + r() * 0.5
    ctx.lineWidth = 1 + r() * 1.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 6)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // franja blanca en diagonal (como la línea de cancha)
  ctx.save()
  ctx.translate(ANCHO / 2, ALTO * 0.78)
  ctx.rotate(-0.42)
  ctx.fillStyle = 'rgba(235,240,235,0.5)'
  ctx.fillRect(-ANCHO, -38, ANCHO * 2, 76)
  ctx.restore()

  const v = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ANCHO * 0.3, ANCHO / 2, ALTO / 2, ANCHO)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, ANCHO, ALTO)
}

function iconoCancha(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const w = 180
  const h = 86
  ctx.save()
  ctx.strokeStyle = C.blanco
  ctx.lineWidth = 4
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
  ctx.beginPath()
  ctx.moveTo(cx, cy - h / 2 - 8)
  ctx.lineTo(cx, cy + h / 2 + 8)
  ctx.moveTo(cx - w * 0.32, cy - h / 2)
  ctx.lineTo(cx - w * 0.32, cy + h / 2)
  ctx.moveTo(cx + w * 0.32, cy - h / 2)
  ctx.lineTo(cx + w * 0.32, cy + h / 2)
  ctx.moveTo(cx - w * 0.32, cy)
  ctx.lineTo(cx + w * 0.32, cy)
  ctx.stroke()
  ctx.restore()
}

function dibujarColumnas(
  ctx: CanvasRenderingContext2D,
  c: Complejo,
  turnos: MapaTurnos,
  logo: HTMLImageElement | null,
  top: number,
  altoDisponible: number,
  marca: 'pelota' | 'cruz',
) {
  const n = c.canchas.length
  const margen = 56
  const sep = n > 1 ? 26 : 0
  const anchoCol = Math.min(420, (ANCHO - margen * 2 - sep * (n - 1)) / n)
  const total = anchoCol * n + sep * (n - 1)
  const x0 = (ANCHO - total) / 2
  const altoCab = 118
  const paso = Math.min(84, (altoDisponible - altoCab - 30) / c.horarios.length)

  c.canchas.forEach((cancha, i) => {
    const x = x0 + i * (anchoCol + sep)
    const altoCol = altoCab + paso * c.horarios.length + 30

    // columna
    ctx.fillStyle = 'rgba(8,40,16,0.55)'
    ctx.fillRect(x, top, anchoCol, altoCol)
    ctx.strokeStyle = C.blanco
    ctx.lineWidth = 5
    ctx.strokeRect(x, top, anchoCol, altoCol)

    // cabecera: logo + nombre de cancha
    const pad = 12
    ctx.fillStyle = C.blanco
    ctx.fillRect(x + pad, top + pad, anchoCol - pad * 2, altoCab - pad * 2)
    ctx.strokeStyle = C.rojo
    ctx.lineWidth = 4
    ctx.strokeRect(x + pad + 5, top + pad + 5, anchoCol - pad * 2 - 10, altoCab - pad * 2 - 10)
    const altoLogo = altoCab - pad * 2 - 22
    const anchoLogo = logo ? (logo.width / logo.height) * altoLogo : 0
    const espacioNombre = anchoCol - pad * 2 - 30 - anchoLogo
    const tamNombre = tamQueEntra(ctx, cancha, 84, espacioNombre)
    const anchoNombre = anchoTexto(ctx, cancha, tamNombre)
    const bloque = anchoLogo + 12 + anchoNombre
    const bx = x + (anchoCol - bloque) / 2
    if (logo) ctx.drawImage(logo, bx, top + altoCab / 2 - altoLogo / 2, anchoLogo, altoLogo)
    texto(ctx, cancha, bx + anchoLogo + 12, top + altoCab / 2 + 3, tamNombre, 800, C.noche, 'left', false)

    // horarios
    const tamHora = tamQueEntra(ctx, '00:00HS', paso * 0.8, anchoCol - 36)
    c.horarios.forEach((h, j) => {
      const y = top + altoCab + 15 + paso * j + paso / 2
      texto(ctx, `${h}HS`, x + anchoCol / 2, y + 2, tamHora)
      if (turnos[claveTurno(cancha, h)]?.estado === 'reservada') {
        if (marca === 'pelota') pelota(ctx, x + anchoCol / 2, y, paso * 0.44)
        else cruz(ctx, x + anchoCol / 2, y, paso * 0.4)
      }
    })
  })
}

function dibujarCesped(ctx: CanvasRenderingContext2D, c: Complejo, fecha: string, turnos: MapaTurnos, logo: HTMLImageElement | null, contactos: ContactoImagen[]) {
  fondoCesped(ctx)
  texto(ctx, 'TURNOS DE PÁDEL', ANCHO / 2, 115, 104)
  texto(ctx, c.tituloImagen, ANCHO / 2, 208, 80)
  lineaFecha(ctx, fecha, 312)
  iconoCancha(ctx, ANCHO / 2, 412)
  const top = 470
  // el pie crece con la cantidad de contactos y las columnas se ajustan al espacio que queda
  const altoPie = contactos.length ? 70 + PASO_PIE_CENTRO * contactos.length : 60
  dibujarColumnas(ctx, c, turnos, logo, top, ALTO - altoPie - 30 - top, 'pelota')
  pieContactos(ctx, contactos, 'centro')
  marcaDeAgua(ctx)
}

// ---------------------------------------------------------------------
const PASO_PIE_CENTRO = 60

function pieContactos(ctx: CanvasRenderingContext2D, lista: ContactoImagen[], modo: 'lados' | 'centro') {
  const lineas = lista.map((c) => ({ nombre: c.nombre.toUpperCase(), telefono: c.telefono }))
  if (!lineas.length) return
  if (modo === 'centro' || lineas.length === 1) {
    const paso = PASO_PIE_CENTRO
    const tam = lineas.length > 2 ? 52 : 60
    const y0 = ALTO - 95 - paso * (lineas.length - 1)
    lineas.forEach((ct, i) => {
      const t = `${ct.nombre}: ${ct.telefono}`
      texto(ctx, t, ANCHO / 2, y0 + paso * i, tamQueEntra(ctx, t, tam, ANCHO - 160))
    })
    return
  }
  // Como la imagen original: con 3 contactos, 1 a la izquierda y 2 apilados a la derecha.
  // En general, la mitad (redondeando para abajo) a la izquierda y el resto a la derecha.
  const corte = Math.floor(lineas.length / 2)
  const bloques = [lineas.slice(0, corte), lineas.slice(corte)]
  const tam = 40
  const salto = 44
  const yc = ALTO - 150
  bloques.forEach((bloque, lado) => {
    const x = lado === 0 ? 260 : ANCHO - 260
    const filas = bloque.flatMap((ct) => [bloque.length === 1 && lado === 0 ? `${ct.nombre}:` : ct.nombre, ct.telefono])
    const y0 = yc - (salto * (filas.length - 1)) / 2
    filas.forEach((f, k) => texto(ctx, f, x, y0 + salto * k, tamQueEntra(ctx, f, tam, 380)))
  })
}

export async function generarImagen(c: Complejo, fecha: string, turnos: MapaTurnos, contactos: ContactoImagen[]): Promise<Blob> {
  await prepararFuentes()
  const logo = await cargarImagen(`${import.meta.env.BASE_URL}logo-el-clasico.webp`).catch(() => null)
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')!
  if (c.estilo === 'cesped') dibujarCesped(ctx, c, fecha, turnos, logo, contactos)
  else dibujarNoche(ctx, c, fecha, turnos, logo, contactos)
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen'))), 'image/png'))
}

export const nombreArchivo = (c: Complejo, fecha: string) => `turnos-${c.id}-${fecha}.png`