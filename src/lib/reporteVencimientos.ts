// Genera el reporte de cuentas vencidas / por vencer como PDF o imagen PNG.
// No necesita librerías externas: dibuja en un <canvas> y arma el PDF a mano.
// Solo usar desde componentes de cliente ('use client').

import { hoyISO } from '@/lib/cuentas'

export type FilaReporte = {
  correo: string
  adquisicion: string
  vencimiento: string
}

export type SeccionReporte = {
  titulo: string
  tono: 'danger' | 'warning'
  filas: FilaReporte[]
}

/* ───────────────────────── Medidas y colores ───────────────────────── */

const W = 1240 // ancho (A4 a 150 dpi)
const H = 1754 // alto de página A4
const M = 70 // margen
const TITLE_H = 170
const SECTION_H = 64
const HEADER_H = 52
const ROW_H = 48
const GAP = 36
const FOOTER_H = 90

const X_CORREO = M + 24
const X_ADQ = 760
const X_VEN = 990
const ANCHO_CORREO = X_ADQ - X_CORREO - 24

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'

const COLORES = {
  texto: '#0f172a',
  muted: '#64748b',
  borde: '#e2e8f0',
  fila: '#f8fafc',
  indigo: '#4f46e5',
  danger: { bg: '#fff1f2', fg: '#be123c', borde: '#fecdd3' },
  warning: { bg: '#fffbeb', fg: '#b45309', borde: '#fde68a' },
}

/* ───────────────────────── Paginación ───────────────────────── */

type Item =
  | { kind: 'section'; sec: SeccionReporte; continua: boolean }
  | { kind: 'header' }
  | { kind: 'row'; fila: FilaReporte; idx: number }

const altoItem = (it: Item): number =>
  it.kind === 'section' ? SECTION_H : it.kind === 'header' ? HEADER_H : ROW_H

const construirPaginas = (secciones: SeccionReporte[], altoPagina: number) => {
  const limite = altoPagina - FOOTER_H
  const paginas: Item[][] = [[]]
  let y = M + TITLE_H

  const poner = (it: Item) => {
    paginas[paginas.length - 1].push(it)
    y += altoItem(it)
  }
  const nuevaPagina = () => {
    paginas.push([])
    y = M
  }

  secciones.forEach((sec) => {
    if (sec.filas.length === 0) return
    if (y + SECTION_H + HEADER_H + ROW_H > limite) nuevaPagina()
    poner({ kind: 'section', sec, continua: false })
    poner({ kind: 'header' })
    sec.filas.forEach((fila, idx) => {
      if (y + ROW_H > limite) {
        nuevaPagina()
        poner({ kind: 'section', sec, continua: true })
        poner({ kind: 'header' })
      }
      poner({ kind: 'row', fila, idx })
    })
    y += GAP
  })

  return { paginas, yFinal: y }
}

/* ───────────────────────── Dibujo ───────────────────────── */

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const ajustar = (ctx: CanvasRenderingContext2D, texto: string, ancho: number): string => {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

const dibujarTitulo = (ctx: CanvasRenderingContext2D, generado: string) => {
  const grad = ctx.createLinearGradient(M, M, W - M, M + 120)
  grad.addColorStop(0, '#4f46e5')
  grad.addColorStop(1, '#2563eb')
  ctx.fillStyle = grad
  rr(ctx, M, M, W - M * 2, 120, 22)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.font = `700 44px ${FONT}`
  ctx.fillText('Reporte de vencimientos', M + 36, M + 56)
  ctx.font = `400 24px ${FONT}`
  ctx.fillStyle = '#e0e7ff'
  ctx.fillText('Cuentas vencidas y por vencer', M + 36, M + 94)

  ctx.textAlign = 'right'
  ctx.font = `400 22px ${FONT}`
  ctx.fillText(`Generado: ${generado}`, W - M - 36, M + 94)
  ctx.textAlign = 'left'
}

const dibujarSeccion = (ctx: CanvasRenderingContext2D, y: number, it: Extract<Item, { kind: 'section' }>) => {
  const c = COLORES[it.sec.tono]
  ctx.fillStyle = c.bg
  rr(ctx, M, y, W - M * 2, SECTION_H - 8, 14)
  ctx.fill()
  ctx.strokeStyle = c.borde
  ctx.lineWidth = 2
  rr(ctx, M, y, W - M * 2, SECTION_H - 8, 14)
  ctx.stroke()

  ctx.fillStyle = c.fg
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `700 28px ${FONT}`
  const sufijo = it.continua ? ' · continuación' : ''
  ctx.fillText(`${it.sec.titulo} (${it.sec.filas.length})${sufijo}`, M + 24, y + (SECTION_H - 8) / 2 + 1)
}

const dibujarEncabezado = (ctx: CanvasRenderingContext2D, y: number) => {
  ctx.fillStyle = COLORES.muted
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `600 21px ${FONT}`
  const cy = y + HEADER_H / 2
  ctx.fillText('Correo', X_CORREO, cy)
  ctx.fillText('Fecha de adquisición', X_ADQ, cy)
  ctx.fillText('Fecha de vencimiento', X_VEN, cy)
  ctx.strokeStyle = COLORES.borde
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(M, y + HEADER_H - 2)
  ctx.lineTo(W - M, y + HEADER_H - 2)
  ctx.stroke()
}

const dibujarFila = (ctx: CanvasRenderingContext2D, y: number, fila: FilaReporte, idx: number) => {
  if (idx % 2 === 0) {
    ctx.fillStyle = COLORES.fila
    ctx.fillRect(M, y, W - M * 2, ROW_H)
  }
  ctx.fillStyle = COLORES.texto
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `500 25px ${FONT}`
  const cy = y + ROW_H / 2 + 1
  ctx.fillText(ajustar(ctx, fila.correo, ANCHO_CORREO), X_CORREO, cy)
  ctx.fillText(fila.adquisicion, X_ADQ, cy)
  ctx.fillText(fila.vencimiento, X_VEN, cy)
}

const dibujarPagina = (
  items: Item[],
  numero: number,
  total: number,
  alto: number,
  primera: boolean,
  generado: string
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Tu navegador no permite generar la imagen.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, alto)

  let y = M
  if (primera) {
    dibujarTitulo(ctx, generado)
    y = M + TITLE_H
  }

  items.forEach((it, i) => {
    // Espacio entre secciones (igual que en la paginación)
    if (it.kind === 'section' && i > 0 && items[i - 1].kind === 'row') y += GAP

    if (it.kind === 'section') dibujarSeccion(ctx, y, it)
    else if (it.kind === 'header') dibujarEncabezado(ctx, y)
    else dibujarFila(ctx, y, it.fila, it.idx)

    y += altoItem(it)
  })

  ctx.fillStyle = COLORES.muted
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `400 20px ${FONT}`
  ctx.fillText(`Página ${numero} de ${total}`, W / 2, alto - 36)
  ctx.textAlign = 'left'

  return canvas
}

/* ───────────────────────── PDF (sin librerías) ───────────────────────── */

const dataUrlABytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1]
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

type PaginaJpeg = { bytes: Uint8Array; width: number; height: number }

const construirPdf = (paginas: PaginaJpeg[]): Blob => {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let largo = 0

  const poner = (data: Uint8Array | string) => {
    const u = typeof data === 'string' ? enc.encode(data) : data
    chunks.push(u)
    largo += u.length
  }
  const iniciarObjeto = (n: number) => {
    offsets[n] = largo
    poner(`${n} 0 obj\n`)
  }

  const n = paginas.length
  poner('%PDF-1.4\n')

  // Objetos: 1 = catálogo, 2 = páginas, luego por cada página: página, contenido, imagen
  iniciarObjeto(1)
  poner('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  iniciarObjeto(2)
  const kids = paginas.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')
  poner(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`)

  paginas.forEach((p, i) => {
    const objPagina = 3 + 3 * i
    const objContenido = 4 + 3 * i
    const objImagen = 5 + 3 * i

    iniciarObjeto(objPagina)
    poner(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /XObject << /Im${i} ${objImagen} 0 R >> >> /Contents ${objContenido} 0 R >>\nendobj\n`
    )

    const contenido = `q 595 0 0 842 0 0 cm /Im${i} Do Q`
    iniciarObjeto(objContenido)
    poner(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\n`)

    iniciarObjeto(objImagen)
    poner(
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`
    )
    poner(p.bytes)
    poner('\nendstream\nendobj\n')
  })

  const inicioXref = largo
  const totalObjetos = 3 * n + 3
  poner(`xref\n0 ${totalObjetos}\n`)
  poner('0000000000 65535 f \n')
  for (let i = 1; i < totalObjetos; i++) {
    poner(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  }
  poner(`trailer\n<< /Size ${totalObjetos} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`)

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' })
}

/* ───────────────────────── API pública ───────────────────────── */

const descargar = (blob: Blob, nombre: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const descargarReporte = async (secciones: SeccionReporte[], formato: 'pdf' | 'png'): Promise<void> => {
  const generado = new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const nombre = `reporte-vencimientos-${hoyISO()}`

  if (formato === 'png') {
    // Una sola imagen larga con todas las cuentas
    const { paginas, yFinal } = construirPaginas(secciones, Infinity)
    const alto = Math.ceil(yFinal + FOOTER_H)
    if (alto > 30000) {
      throw new Error('Hay demasiadas cuentas para una sola imagen. Genera el PDF.')
    }
    const canvas = dibujarPagina(paginas[0], 1, 1, alto, true, generado)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/png')
    })
    descargar(blob, `${nombre}.png`)
    return
  }

  // PDF: páginas A4
  const { paginas } = construirPaginas(secciones, H)
  const total = paginas.length
  const imagenes: PaginaJpeg[] = paginas.map((items, i) => {
    const canvas = dibujarPagina(items, i + 1, total, H, i === 0, generado)
    return { bytes: dataUrlABytes(canvas.toDataURL('image/jpeg', 0.92)), width: W, height: H }
  })
  descargar(construirPdf(imagenes), `${nombre}.pdf`)
}
