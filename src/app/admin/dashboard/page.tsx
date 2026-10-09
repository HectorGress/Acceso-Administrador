'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase'
import {
  Sun, Moon, LogOut, Users, Server, Tag, LifeBuoy, Search, Plus, Copy, Check,
  Pencil, Trash2, Clock, Inbox, X, RefreshCw, ExternalLink,
  SearchX, Loader2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ───────────────────────── Helpers (sin lógica de negocio) ───────────────────────── */

// Fecha local de hoy en formato YYYY-MM-DD
const hoyISO = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// El título del reporte se guarda como primera línea de descripcion_problema
// (la tabla "reportes" no tiene columna "titulo")
const getTituloReporte = (rep: any) => {
  if (rep.titulo) return rep.titulo
  const desc: string = rep.descripcion_problema || rep.descripcion || ''
  if (desc.includes('\n')) return desc.split('\n')[0]
  return 'Reporte de soporte'
}

const getDescripcionReporte = (rep: any) => {
  const desc: string = rep.descripcion_problema || rep.descripcion || ''
  if (rep.titulo) return desc
  if (desc.includes('\n')) return desc.split('\n').slice(1).join('\n')
  return desc
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneClasses = (dark: boolean, tone: Tone) => {
  const map: Record<Tone, string> = {
    success: dark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: dark ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200',
    danger: dark ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' : 'bg-rose-50 text-rose-700 border-rose-200',
    info: dark ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border-indigo-200',
    neutral: dark ? 'bg-slate-500/10 text-slate-300 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return map[tone]
}

// Semáforo de vencimiento. "rank" define el orden: vencidas → por vencer → estables → sin fecha
const getSemaforoStatus = (fechaVencimiento: string): { label: string; tone: Tone; rank: number } => {
  if (!fechaVencimiento) return { label: 'Sin Fecha', tone: 'neutral', rank: 3 }

  const hoy = new Date()
  const vencimiento = new Date(fechaVencimiento)
  const diffTime = vencimiento.getTime() - hoy.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: 'Vencida', tone: 'danger', rank: 0 }
  } else if (diffDays <= 5) {
    return { label: 'Por Vencer', tone: 'warning', rank: 1 }
  } else {
    return { label: 'Estable', tone: 'success', rank: 2 }
  }
}

// Vencidas primero, luego por vencer, luego estables (y al final las sin fecha).
// Dentro de cada grupo: la fecha más atrasada/próxima arriba.
const ordenarPorVencimiento = (items: any[]) =>
  [...items].sort((a, b) => {
    const ra = getSemaforoStatus(a.fecha_vencimiento).rank
    const rb = getSemaforoStatus(b.fecha_vencimiento).rank
    if (ra !== rb) return ra - rb
    return (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || '')
  })

/* ───────────────────────── Componentes de UI ───────────────────────── */

const Pill = ({ dark, tone, children }: { dark: boolean; tone: Tone; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${toneClasses(dark, tone)}`}>
    {children}
  </span>
)

const Skeleton = ({ dark, className = '' }: { dark: boolean; className?: string }) => (
  <div className={`animate-pulse rounded-xl ${dark ? 'bg-slate-800' : 'bg-slate-200'} ${className}`} />
)

const EmptyState = ({
  dark, icon: Icon, title, text, action
}: { dark: boolean; icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
      <Icon size={26} />
    </div>
    <h3 className="font-semibold text-sm">{title}</h3>
    <p className={`text-xs mt-1 max-w-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{text}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
)

const KpiCard = ({
  dark, icon: Icon, label, value, hint, tone
}: { dark: boolean; icon: LucideIcon; label: string; value: number | string; hint?: string; tone: Tone }) => (
  <div className={`p-4 rounded-2xl border flex items-center gap-4 ${dark ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
    <div className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center ${toneClasses(dark, tone)}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {hint && <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  </div>
)

const Field = ({ label, dark, children }: { label: string; dark: boolean; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className={`text-xs font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
    {children}
  </label>
)

/* ───────────────────────── Página ───────────────────────── */

export default function AdminDashboard() {
  const [tab, setTab] = useState<'clientes' | 'madres' | 'precios' | 'reportes'>('clientes')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedServicio, setSelectedServicio] = useState('Todos')
  const [darkMode, setDarkMode] = useState(false)
  const [copiedId, setCopiedId] = useState<string | number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null)
  
  // Datasets
  const [cuentasClientes, setCuentasClientes] = useState<any[]>([])
  const [cuentasMadre, setCuentasMadre] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [reportes, setReportes] = useState<any[]>([])

  // Estado para responder reportes
  const [solucionesInput, setSolucionesInput] = useState<{ [key: string]: string }>({})

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})

  const router = useRouter()
  const supabase = createClient()

  const serviciosFiltro = [
    'Todos', 'Netflix', 'Max / HBO Max', 'Disney+', 'Prime Video', 'ViX', 
    'Spotify', 'Paramount+', 'Apple TV+', 'Crunchyroll', 'Canva', 'Gemini', 'ChatGPT'
  ]

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      await loadAllData()
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  // Sincronización en vivo: cuando el otro admin (o un cliente) guarda algo,
  // se recarga solo. Además: respaldo cada 30 s y al volver a la pestaña.
  useEffect(() => {
    if (loading) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const refrescar = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { loadAllData() }, 300)
    }

    const channel = supabase
      .channel('admin-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_clientes' }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas_madre' }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios_catalogo' }, refrescar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, refrescar)
      .subscribe()

    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') loadAllData()
    }, 30000)

    const alVolver = () => {
      if (document.visibilityState === 'visible') loadAllData()
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      supabase.removeChannel(channel)
    }
  }, [loading])

  const loadAllData = async () => {
    const { data: cCli } = await supabase.from('cuentas_clientes').select('*').order('created_at', { ascending: false })
    const { data: cMad } = await supabase.from('cuentas_madre').select('*').order('created_at', { ascending: false })
    const { data: sCat } = await supabase.from('servicios_catalogo').select('*').order('created_at', { ascending: false })
    const { data: rep } = await supabase.from('reportes').select('*').order('created_at', { ascending: false })

    if (cCli) setCuentasClientes(cCli)
    if (cMad) setCuentasMadre(cMad)
    if (sCat) setServicios(sCat)
    if (rep) {
      setReportes(rep)
      // Se conserva lo que el admin esté escribiendo; solo se rellenan los reportes nuevos
      setSolucionesInput((prev) => {
        const next: { [key: string]: string } = {}
        rep.forEach(r => {
          next[r.id] = prev[r.id] !== undefined ? prev[r.id] : (r.solucion || '')
        })
        return next
      })
    }
    setUltimaSync(new Date())
  }

  const handleSincronizar = async () => {
    setSincronizando(true)
    await loadAllData()
    setSincronizando(false)
  }

  const handleCopiarDatosCliente = (item: any) => {
    const texto = `🍿 *TUS DATOS DE ACCESO* 🍿\n\n` +
      `📺 *Servicio:* ${item.servicio || 'N/A'}\n` +
      `📧 *Correo:* ${item.correo_cuenta || item.correo || 'N/A'}\n` +
      `🔑 *Contraseña:* ${item.contrasena_cuenta || item.contrasena || 'N/A'}\n` +
      `👤 *Perfil:* ${item.perfil_asignado || 'N/A'}\n` +
      `📌 *PIN:* ${item.pin_perfil || 'Sin PIN'}\n` +
      `📅 *Vencimiento:* ${item.fecha_vencimiento || 'N/A'}\n\n` +
      `¡Gracias por tu preferencia!`

    navigator.clipboard.writeText(texto)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)

    let error: any = null
    
    if (tab === 'clientes') {
      const payload: any = {}
      if (formData.nombre_completo) payload.nombre_completo = formData.nombre_completo
      if (formData.servicio) payload.servicio = formData.servicio
      if (formData.perfil_asignado) payload.perfil_asignado = formData.perfil_asignado
      if (formData.pin_perfil) payload.pin_perfil = formData.pin_perfil
      if (formData.correo_cuenta) payload.correo_cuenta = formData.correo_cuenta
      if (formData.contrasena_cuenta) payload.contrasena_cuenta = formData.contrasena_cuenta
      // fecha_adquisicion es NOT NULL en la tabla: si no hay, se usa la fecha de hoy
      payload.fecha_adquisicion = formData.fecha_adquisicion || hoyISO()
      if (formData.fecha_vencimiento) payload.fecha_vencimiento = formData.fecha_vencimiento
      if (formData.precio_suscripcion !== '' && formData.precio_suscripcion != null && !isNaN(Number(formData.precio_suscripcion))) {
        payload.precio_suscripcion = Number(formData.precio_suscripcion)
      }
      if (formData.correo) payload.correo = formData.correo
      if (formData.contrasena) payload.contrasena = formData.contrasena

      if (editingItem?.id) {
        const res = await supabase.from('cuentas_clientes').update(payload).eq('id', editingItem.id)
        error = res.error
      } else {
        const res = await supabase.from('cuentas_clientes').insert([payload])
        error = res.error
      }
    } else if (tab === 'madres') {
      const payload: any = {}
      if (formData.proveedor) payload.proveedor = formData.proveedor
      if (formData.codigo_panel) payload.codigo_panel = formData.codigo_panel
      if (formData.servicio) payload.servicio = formData.servicio
      if (formData.correo) payload.correo = formData.correo
      if (formData.contrasena) payload.contrasena = formData.contrasena
      payload.fecha_adquisicion = formData.fecha_adquisicion || hoyISO()
      if (formData.fecha_vencimiento) payload.fecha_vencimiento = formData.fecha_vencimiento

      if (editingItem?.id) {
        const res = await supabase.from('cuentas_madre').update(payload).eq('id', editingItem.id)
        error = res.error
      } else {
        const res = await supabase.from('cuentas_madre').insert([payload])
        error = res.error
      }
    } else if (tab === 'precios') {
      const payload: any = {
        nombre: formData.nombre || formData.servicio || 'Servicio',
        categoria: formData.categoria || 'perfil',
        precio: formData.precio ? Number(formData.precio) : 0,
        descripcion: formData.descripcion || ''
      }

      if (editingItem?.id) {
        const res = await supabase.from('servicios_catalogo').update(payload).eq('id', editingItem.id)
        error = res.error
      } else {
        // El panel de cliente filtra por activo = true
        payload.activo = true
        const res = await supabase.from('servicios_catalogo').insert([payload])
        error = res.error
      }
    }

    if (error) {
      console.error('Error al guardar:', error)
      alert(`❌ Error al guardar: ${error.message}`)
      setGuardando(false)
      return
    }

    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({})
    await loadAllData()
    setGuardando(false)
  }

  const handleDelete = async (table: string, id: any) => {
    if (confirm('¿Deseas eliminar este registro?')) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) alert(`❌ Error al eliminar: ${error.message}`)
      await loadAllData()
    }
  }

  const handleUpdateReporteStatus = async (id: any, nuevoEstatus: string) => {
    const mensajeSolucion = solucionesInput[id] || ''
    
    const { error } = await supabase.from('reportes').update({ 
      estatus: nuevoEstatus,
      estado: nuevoEstatus.toLowerCase(),
      atendido: nuevoEstatus === 'Resuelto',
      solucion: mensajeSolucion 
    }).eq('id', id)

    if (error) alert(`❌ Error al actualizar reporte: ${error.message}`)

    await loadAllData()
  }

  const applyFilters = (items: any[]) => {
    return items.filter((item) => {
      const itemText = JSON.stringify(item).toLowerCase()
      const matchSearch = itemText.includes(filter.toLowerCase())

      if (selectedServicio === 'Todos') return matchSearch

      const servLower = (item.servicio || item.nombre || '').toLowerCase()

      let matchServicio = false
      if (selectedServicio === 'Max / HBO Max') {
        matchServicio = servLower.includes('max') || servLower.includes('hbo') || servLower.includes('máximo')
      } else if (selectedServicio === 'Disney+') {
        matchServicio = servLower.includes('disney')
      } else if (selectedServicio === 'Prime Video') {
        matchServicio = servLower.includes('prime') || servLower.includes('amazon')
      } else {
        matchServicio = servLower.includes(selectedServicio.toLowerCase())
      }

      return matchSearch && matchServicio
    })
  }

  /* ───────── Tokens visuales ───────── */
  const ui = {
    page: darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900',
    card: darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200 shadow-sm',
    cardInner: darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200',
    muted: darkMode ? 'text-slate-400' : 'text-slate-500',
    border: darkMode ? 'border-slate-700' : 'border-slate-200',
    thead: darkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-200',
    divide: darkMode ? 'divide-slate-700/60' : 'divide-slate-100',
    rowHover: darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50',
    input: `w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 ${
      darkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500 [color-scheme:dark]' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
    }`,
    btnPrimary: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-sm transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed',
    btnGhost: `inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
      darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
    }`,
    iconBtn: `p-2 rounded-lg transition ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`,
  }

  /* ───────── Datos derivados ───────── */
  const reportesPendientes = reportes.filter(r => (r.estatus || r.estado)?.toLowerCase() !== 'resuelto').length
  const clientesPorVencer = cuentasClientes.filter(c => getSemaforoStatus(c.fecha_vencimiento).label === 'Por Vencer').length
  const clientesVencidas = cuentasClientes.filter(c => getSemaforoStatus(c.fecha_vencimiento).label === 'Vencida').length

  const clientesVisibles = ordenarPorVencimiento(applyFilters(cuentasClientes))
  const madresVisibles = ordenarPorVencimiento(applyFilters(cuentasMadre))
  const preciosVisibles = applyFilters(servicios)
  const reportesVisibles = applyFilters(reportes)

  const hayFiltros = filter.trim() !== '' || selectedServicio !== 'Todos'
  const limpiarFiltros = () => { setFilter(''); setSelectedServicio('Todos') }
  const abrirCrear = () => { setEditingItem(null); setFormData({ fecha_adquisicion: hoyISO() }); setIsModalOpen(true) }

  const tabs = [
    { id: 'clientes', name: 'Cuentas clientes', icon: Users, count: cuentasClientes.length },
    { id: 'madres', name: 'Cuentas madre', icon: Server, count: cuentasMadre.length },
    { id: 'precios', name: 'Precios y combo del mes', icon: Tag, count: servicios.length },
    { id: 'reportes', name: 'Reportes', icon: LifeBuoy, count: reportesPendientes },
  ] as const

  const emptyAction = hayFiltros ? (
    <button onClick={limpiarFiltros} className={ui.btnGhost}>Limpiar filtros</button>
  ) : tab !== 'reportes' ? (
    <button onClick={abrirCrear} className={ui.btnPrimary}><Plus size={16} /> Crear registro</button>
  ) : undefined

  /* ───────── Carga inicial (skeleton) ───────── */
  if (loading) {
    return (
      <div className={`min-h-screen p-4 md:p-8 ${ui.page}`}>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center gap-4">
            <div className="space-y-2">
              <Skeleton dark={darkMode} className="h-7 w-64" />
              <Skeleton dark={darkMode} className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton dark={darkMode} className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} dark={darkMode} className="h-24" />)}
          </div>
          <Skeleton dark={darkMode} className="h-11 w-full" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} dark={darkMode} className="h-16 w-full" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 p-4 md:p-8 ${ui.page}`}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Admin */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
            <p className={`text-sm mt-0.5 ${ui.muted}`}>
              Gestiona cuentas, precios, combos y reportes de soporte.
              {ultimaSync && (
                <span className="ml-1.5 text-xs">
                  · Actualizado {ultimaSync.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleSincronizar} className={ui.btnGhost} title="Actualizar datos ahora">
              <RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <Link href="/admin/reportes" className={ui.btnGhost}>
              <ExternalLink size={16} /> <span>Vista de reportes</span>
            </Link>
            <button onClick={() => setDarkMode(!darkMode)} className={ui.btnGhost}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span className="hidden sm:inline">{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
            </button>
            <button
              onClick={() => signOut(auth)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
                darkMode ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard dark={darkMode} icon={Users} tone="info" label="Clientes" value={cuentasClientes.length} hint="Perfiles asignados" />
          <KpiCard dark={darkMode} icon={Server} tone="neutral" label="Cuentas madre" value={cuentasMadre.length} hint="Cuentas base" />
          <KpiCard
            dark={darkMode}
            icon={Clock}
            tone={clientesVencidas > 0 ? 'danger' : 'warning'}
            label="Por vencer (5 días)"
            value={clientesPorVencer}
            hint={`${clientesVencidas} vencidas`}
          />
          <KpiCard
            dark={darkMode}
            icon={LifeBuoy}
            tone={reportesPendientes > 0 ? 'warning' : 'success'}
            label="Reportes abiertos"
            value={reportesPendientes}
            hint={reportesPendientes > 0 ? 'Requieren atención' : 'Todo al día'}
          />
        </section>

        {/* Navegación por pestañas */}
        <nav className={`flex overflow-x-auto gap-1 border-b ${ui.border}`}>
          {tabs.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setFilter(''); setSelectedServicio('Todos'); }}
                className={`whitespace-nowrap inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                  active
                    ? (darkMode ? 'border-indigo-400 text-indigo-300' : 'border-indigo-600 text-indigo-700')
                    : `border-transparent ${ui.muted} ${darkMode ? 'hover:text-slate-200' : 'hover:text-slate-800'}`
                }`}
              >
                <t.icon size={16} />
                {t.name}
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  t.id === 'reportes' && t.count > 0 ? toneClasses(darkMode, 'warning') : toneClasses(darkMode, 'neutral')
                }`}>
                  {t.count}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Buscador & Filtro por Servicio */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.muted}`} />
              <input
                type="text"
                placeholder="Buscar por correo, cliente o detalles"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={`${ui.input} pl-10`}
              />
            </div>

            <select
              value={selectedServicio}
              onChange={(e) => setSelectedServicio(e.target.value)}
              className={`${ui.input} sm:w-auto`}
            >
              {serviciosFiltro.map((s) => (
                <option key={s} value={s}>{s === 'Todos' ? 'Todos los servicios' : s}</option>
              ))}
            </select>
          </div>

          {tab !== 'reportes' && (
            <button onClick={abrirCrear} className={ui.btnPrimary}>
              <Plus size={16} /> Crear registro
            </button>
          )}
        </div>

        {/* TABLA: Cuentas Clientes */}
        {tab === 'clientes' && (
          <div className={`border rounded-2xl overflow-hidden ${ui.card}`}>
            {clientesVisibles.length === 0 ? (
              <EmptyState
                dark={darkMode}
                icon={hayFiltros ? SearchX : Users}
                title={hayFiltros ? 'No encontramos clientes con ese filtro' : 'Aún no hay clientes registrados'}
                text={hayFiltros ? 'Prueba con otro correo o servicio, o limpia los filtros.' : 'Crea el primer registro para empezar a controlar vencimientos.'}
                action={emptyAction}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[900px]">
                  <thead className={`${ui.thead} border-b text-xs font-semibold`}>
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Correo y contraseña de la cuenta</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3">Perfil / PIN</th>
                      <th className="px-4 py-3">Precio</th>
                      <th className="px-4 py-3">Vencimiento</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${ui.divide}`}>
                    {clientesVisibles.map((item) => {
                      const semaforo = getSemaforoStatus(item.fecha_vencimiento)
                      return (
                        <tr key={item.id} className={`transition-colors ${ui.rowHover}`}>
                          <td className="px-4 py-3.5 font-semibold">
                            {item.nombre_completo || '-'}
                            {item.correo && <div className={`text-[11px] font-normal ${ui.muted}`}>{item.correo}</div>}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            <span className={`font-semibold ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{item.correo_cuenta || item.correo || '-'}</span>
                            <br />
                            <span className={ui.muted}>Pass: {item.contrasena_cuenta || item.contrasena || 'S/N'}</span>
                          </td>
                          <td className="px-4 py-3.5 font-semibold">{item.servicio || '-'}</td>
                          <td className="px-4 py-3.5 font-mono text-xs">{item.perfil_asignado || '-'} <span className={ui.muted}>(PIN: {item.pin_perfil || 'S/N'})</span></td>
                          <td className={`px-4 py-3.5 font-semibold whitespace-nowrap ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>${item.precio_suscripcion || 0} MXN</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{item.fecha_vencimiento || 'Sin fecha'}</td>
                          <td className="px-4 py-3.5">
                            <Pill dark={darkMode} tone={semaforo.tone}>{semaforo.label}</Pill>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <button
                                onClick={() => handleCopiarDatosCliente(item)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  copiedId === item.id
                                    ? toneClasses(darkMode, 'success')
                                    : (darkMode ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100')
                                }`}
                              >
                                {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                                {copiedId === item.id ? '¡Copiado!' : 'Copiar datos'}
                              </button>
                              <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className={ui.iconBtn} title="Editar" aria-label="Editar">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleDelete('cuentas_clientes', item.id)} className={`p-2 rounded-lg transition ${darkMode ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`} title="Eliminar" aria-label="Eliminar">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TABLA: Cuentas Madre */}
        {tab === 'madres' && (
          <div className={`border rounded-2xl overflow-hidden ${ui.card}`}>
            {madresVisibles.length === 0 ? (
              <EmptyState
                dark={darkMode}
                icon={hayFiltros ? SearchX : Server}
                title={hayFiltros ? 'No encontramos cuentas madre con ese filtro' : 'Aún no hay cuentas madre'}
                text={hayFiltros ? 'Prueba con otro proveedor o servicio, o limpia los filtros.' : 'Registra tus cuentas base para saber cuándo renovarlas.'}
                action={emptyAction}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[900px]">
                  <thead className={`${ui.thead} border-b text-xs font-semibold`}>
                    <tr>
                      <th className="px-4 py-3">Proveedor</th>
                      <th className="px-4 py-3">Código panel</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3">Correo y contraseña</th>
                      <th className="px-4 py-3">Fecha adquisición</th>
                      <th className="px-4 py-3">Fecha vencimiento</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${ui.divide}`}>
                    {madresVisibles.map((item) => {
                      const semaforo = getSemaforoStatus(item.fecha_vencimiento)
                      return (
                        <tr key={item.id} className={`transition-colors ${ui.rowHover}`}>
                          <td className="px-4 py-3.5 font-semibold">{item.proveedor || '-'}</td>
                          <td className={`px-4 py-3.5 font-mono text-xs ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{item.codigo_panel || '-'}</td>
                          <td className="px-4 py-3.5 font-semibold">{item.servicio || '-'}</td>
                          <td className="px-4 py-3.5 font-mono text-xs">
                            <span className={`font-semibold ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{item.correo || '-'}</span>
                            <br />
                            <span className={ui.muted}>Pass: {item.contrasena || 'S/N'}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{item.fecha_adquisicion || '-'}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{item.fecha_vencimiento || '-'}</td>
                          <td className="px-4 py-3.5">
                            <Pill dark={darkMode} tone={semaforo.tone}>{semaforo.label}</Pill>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className={ui.iconBtn} title="Editar" aria-label="Editar">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleDelete('cuentas_madre', item.id)} className={`p-2 rounded-lg transition ${darkMode ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`} title="Eliminar" aria-label="Eliminar">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TABLA: Precios y Combo del Mes */}
        {tab === 'precios' && (
          <div className={`border rounded-2xl p-5 space-y-4 ${ui.card}`}>
            <div>
              <h2 className="font-semibold">Catálogo de precios y oferta del mes</h2>
              <p className={`text-xs mt-0.5 ${ui.muted}`}>Lo que guardes aquí lo ven los clientes en su panel.</p>
            </div>
            {preciosVisibles.length === 0 ? (
              <EmptyState
                dark={darkMode}
                icon={hayFiltros ? SearchX : Tag}
                title={hayFiltros ? 'No encontramos precios con ese filtro' : 'Tu catálogo está vacío'}
                text={hayFiltros ? 'Prueba con otro nombre o limpia los filtros.' : 'Agrega perfiles, cuentas completas o el combo del mes.'}
                action={emptyAction}
              />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {preciosVisibles.map((s) => (
                  <div key={s.id} className={`p-4 border rounded-xl flex justify-between items-start gap-3 ${ui.cardInner}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{s.nombre || s.servicio}</span>
                        <Pill dark={darkMode} tone="info">{s.categoria || 'General'}</Pill>
                      </div>
                      <p className={`text-xs mt-1 ${ui.muted}`}>{s.descripcion}</p>
                      <p className={`text-lg font-bold mt-2 ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>${s.precio} MXN</p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => { setEditingItem(s); setFormData(s); setIsModalOpen(true); }} className={ui.iconBtn} title="Editar" aria-label="Editar">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete('servicios_catalogo', s.id)} className={`p-2 rounded-lg transition ${darkMode ? 'text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`} title="Eliminar" aria-label="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MÓDULO: Reportes */}
        {tab === 'reportes' && (
          <div className={`border rounded-2xl p-5 space-y-4 ${ui.card}`}>
            <div>
              <h2 className="font-semibold">Atención de soporte</h2>
              <p className={`text-xs mt-0.5 ${ui.muted}`}>Responde al cliente y cambia el estado del reporte.</p>
            </div>

            {reportesVisibles.length === 0 ? (
              <EmptyState
                dark={darkMode}
                icon={hayFiltros ? SearchX : Inbox}
                title={hayFiltros ? 'No hay reportes que coincidan' : 'Sin reportes por ahora'}
                text={hayFiltros ? 'Prueba con otra búsqueda o limpia los filtros.' : 'Cuando un cliente envíe un reporte aparecerá aquí al instante.'}
                action={emptyAction}
              />
            ) : (
              <div className="space-y-4">
                {reportesVisibles.map((rep) => {
                  const estatusActual = (rep.estatus || rep.estado || 'Pendiente').toLowerCase()
                  const tone: Tone = estatusActual === 'resuelto' ? 'success' : estatusActual === 'en proceso' ? 'info' : 'warning'
                  return (
                    <div key={rep.id} className={`p-4 sm:p-5 border rounded-2xl space-y-3 ${ui.cardInner}`}>
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base">{getTituloReporte(rep)}</span>
                            <Pill dark={darkMode} tone={tone}>{rep.estatus || rep.estado || 'Pendiente'}</Pill>
                          </div>
                          <p className={`text-xs ${ui.muted}`}>
                            <strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>Cliente:</strong> {rep.nombre_cliente || 'No especificado'}
                          </p>
                          <p className={`text-xs font-mono ${ui.muted}`}>
                            <strong className={darkMode ? 'text-slate-200' : 'text-slate-700'}>Cuenta afectada:</strong>{' '}
                            <span className={`font-semibold ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{rep.correo_cuenta || 'N/A'}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => handleUpdateReporteStatus(rep.id, 'En Proceso')} className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${toneClasses(darkMode, 'info')} hover:opacity-80`}>
                            En proceso
                          </button>
                          <button onClick={() => handleUpdateReporteStatus(rep.id, 'Resuelto')} className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${toneClasses(darkMode, 'success')} hover:opacity-80`}>
                            Resolver
                          </button>
                        </div>
                      </div>

                      <div className={`p-3.5 rounded-xl border text-sm space-y-2 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className={`grid sm:grid-cols-3 gap-2 font-mono text-xs pb-2 border-b ${ui.border}`}>
                          <p><strong>Contraseña:</strong> {rep.contrasena_cuenta || 'N/A'}</p>
                          <p><strong>Perfil:</strong> {rep.perfil || rep.perfil_asignado || 'N/A'}</p>
                          <p><strong>PIN:</strong> {rep.pin || rep.pin_perfil || 'N/A'}</p>
                        </div>
                        <p className="whitespace-pre-line"><strong>Falla reportada:</strong> {getDescripcionReporte(rep)}</p>

                        <div className={`pt-2 border-t space-y-1 ${ui.border}`}>
                          <label className={`block text-xs font-medium ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Mensaje o indicaciones para el cliente</label>
                          <input
                            type="text"
                            placeholder="Ej. Contraseña actualizada a 'X123' / Reinicia tu sesión"
                            value={solucionesInput[rep.id] || ''}
                            onChange={(e) => setSolucionesInput({ ...solucionesInput, [rep.id]: e.target.value })}
                            className={ui.input}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal CRUD Dinámico */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 z-50 overflow-y-auto">
            <div className={`border w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4 my-8 ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{editingItem ? 'Editar registro' : 'Nuevo registro'}</h3>
                  <p className={`text-xs ${ui.muted}`}>Los campos con * son obligatorios.</p>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className={ui.iconBtn} aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-3">
                {tab === 'clientes' && (
                  <>
                    <Field dark={darkMode} label="Nombre completo *">
                      <input type="text" required placeholder="Nombre completo" value={formData.nombre_completo || ''} onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Correo de la cuenta *">
                      <input type="email" required placeholder="Correo de la cuenta" value={formData.correo_cuenta || ''} onChange={(e) => setFormData({...formData, correo_cuenta: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Contraseña de la cuenta *">
                      <input type="text" required placeholder="Contraseña de la cuenta" value={formData.contrasena_cuenta || ''} onChange={(e) => setFormData({...formData, contrasena_cuenta: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Servicio *">
                      <input type="text" required placeholder="Servicio (ej. Disney+)" value={formData.servicio || ''} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className={ui.input} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field dark={darkMode} label="Perfil asignado">
                        <input type="text" placeholder="Perfil asignado" value={formData.perfil_asignado || ''} onChange={(e) => setFormData({...formData, perfil_asignado: e.target.value})} className={ui.input} />
                      </Field>
                      <Field dark={darkMode} label="PIN de perfil">
                        <input type="text" placeholder="PIN de perfil" value={formData.pin_perfil || ''} onChange={(e) => setFormData({...formData, pin_perfil: e.target.value})} className={ui.input} />
                      </Field>
                    </div>
                    <Field dark={darkMode} label="Precio de suscripción (MXN)">
                      <input type="number" placeholder="Precio suscripción MXN" value={formData.precio_suscripcion ?? ''} onChange={(e) => setFormData({...formData, precio_suscripcion: e.target.value})} className={ui.input} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field dark={darkMode} label="Fecha de adquisición *">
                        <input type="date" required value={formData.fecha_adquisicion || ''} onChange={(e) => setFormData({...formData, fecha_adquisicion: e.target.value})} className={ui.input} />
                      </Field>
                      <Field dark={darkMode} label="Fecha de vencimiento *">
                        <input type="date" required value={formData.fecha_vencimiento || ''} onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})} className={ui.input} />
                      </Field>
                    </div>
                  </>
                )}

                {tab === 'madres' && (
                  <>
                    <Field dark={darkMode} label="Proveedor *">
                      <input type="text" required placeholder="Proveedor" value={formData.proveedor || ''} onChange={(e) => setFormData({...formData, proveedor: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Código panel">
                      <input type="text" placeholder="Código Panel" value={formData.codigo_panel || ''} onChange={(e) => setFormData({...formData, codigo_panel: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Servicio *">
                      <input type="text" required placeholder="Servicio" value={formData.servicio || ''} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Correo *">
                      <input type="email" required placeholder="Correo" value={formData.correo || ''} onChange={(e) => setFormData({...formData, correo: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Contraseña *">
                      <input type="text" required placeholder="Contraseña" value={formData.contrasena || ''} onChange={(e) => setFormData({...formData, contrasena: e.target.value})} className={ui.input} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field dark={darkMode} label="Fecha de adquisición *">
                        <input type="date" required value={formData.fecha_adquisicion || ''} onChange={(e) => setFormData({...formData, fecha_adquisicion: e.target.value})} className={ui.input} />
                      </Field>
                      <Field dark={darkMode} label="Fecha de vencimiento *">
                        <input type="date" required value={formData.fecha_vencimiento || ''} onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})} className={ui.input} />
                      </Field>
                    </div>
                  </>
                )}

                {tab === 'precios' && (
                  <>
                    <Field dark={darkMode} label="Nombre del servicio o producto">
                      <input type="text" placeholder="Nombre Servicio / Producto" value={formData.nombre || ''} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Categoría">
                      <select value={formData.categoria || 'perfil'} onChange={(e) => setFormData({...formData, categoria: e.target.value})} className={ui.input}>
                        <option value="perfil">Perfil</option>
                        <option value="completa">Cuenta Completa</option>
                        <option value="combo">Combo del Mes</option>
                      </select>
                    </Field>
                    <Field dark={darkMode} label="Precio público (MXN)">
                      <input type="number" step="0.01" placeholder="Precio Público MXN" value={formData.precio || ''} onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value)})} className={ui.input} />
                    </Field>
                    <Field dark={darkMode} label="Descripción">
                      <textarea rows={3} placeholder="Descripción" value={formData.descripcion || ''} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className={ui.input} />
                    </Field>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className={ui.btnGhost}>Cancelar</button>
                  <button type="submit" disabled={guardando} className={ui.btnPrimary}>
                    {guardando && <Loader2 size={16} className="animate-spin" />}
                    {editingItem ? 'Guardar cambios' : 'Crear registro'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
