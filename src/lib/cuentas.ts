// Utilidades compartidas entre los paneles (admin / cliente).
// Aquí vive la lógica de fechas y validaciones para que todos los paneles
// calculen exactamente lo mismo.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/* ───────────────────────── Fechas ───────────────────────── */

// Fecha local de hoy en formato YYYY-MM-DD
export const hoyISO = (): string => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Convierte "YYYY-MM-DD" a una fecha LOCAL (sin el desfase de zona horaria de new Date('YYYY-MM-DD'))
export const fechaLocal = (fecha?: string | null): Date | null => {
  if (!fecha) return null
  const [y, m, d] = String(fecha).split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// Días que faltan para el vencimiento (negativo = ya venció, 0 = vence hoy)
export const diasParaVencer = (fecha?: string | null): number | null => {
  const venc = fechaLocal(fecha)
  if (!venc) return null
  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000)
}

export const textoDias = (dias: number | null): string => {
  if (dias === null) return ''
  if (dias === 0) return 'Vence hoy'
  if (dias > 0) return `Vence en ${dias} día${dias === 1 ? '' : 's'}`
  const n = Math.abs(dias)
  return `Venció hace ${n} día${n === 1 ? '' : 's'}`
}

// dd/mm/yyyy
export const formatearFecha = (fecha?: string | null): string => {
  if (!fecha) return '-'
  const [y, m, d] = String(fecha).split('T')[0].split('-')
  if (!y || !m || !d) return String(fecha)
  return `${d}/${m}/${y}`
}

// Semáforo de vencimiento. "rank" define el orden: vencidas → por vencer → estables → sin fecha
export const getSemaforoStatus = (
  fechaVencimiento?: string | null
): { label: string; tone: Tone; rank: number; dias: number | null } => {
  const dias = diasParaVencer(fechaVencimiento)
  if (dias === null) return { label: 'Sin Fecha', tone: 'neutral', rank: 3, dias }
  if (dias < 0) return { label: 'Vencida', tone: 'danger', rank: 0, dias }
  if (dias <= 5) return { label: 'Por Vencer', tone: 'warning', rank: 1, dias }
  return { label: 'Estable', tone: 'success', rank: 2, dias }
}

// Vencidas primero, luego por vencer, luego estables (y al final las sin fecha).
// Dentro de cada grupo: la fecha más atrasada/próxima arriba.
export const ordenarPorVencimiento = <T extends Record<string, any>>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const ra = getSemaforoStatus(a.fecha_vencimiento).rank
    const rb = getSemaforoStatus(b.fecha_vencimiento).rank
    if (ra !== rb) return ra - rb
    return String(a.fecha_vencimiento || '').localeCompare(String(b.fecha_vencimiento || ''))
  })

/* ───────────────────────── Validaciones ───────────────────────── */

export const validarCorreo = (valor: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())

// Acepta "https://panel.com/x" o "panel.com/x" (le agrega https://). Devuelve null si no es válida.
// Solo permite http/https (evita enlaces tipo "javascript:").
export const normalizarUrl = (valor?: string | null): string | null => {
  const v = (valor || '').trim()
  if (!v) return null
  const conProtocolo = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(conProtocolo)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.toString()
  } catch {
    return null
  }
}

// ID de cliente: 4 a 20 caracteres, solo minúsculas, números y guion bajo
export const validarClienteId = (valor: string): boolean => /^[a-z0-9_]{4,20}$/.test(valor)