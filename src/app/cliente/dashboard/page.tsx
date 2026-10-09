'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase'
import {
  Sun, Moon, LogOut, Copy, Check, Landmark, Sparkles, UserRound, Crown,
  LifeBuoy, Send, Search, Inbox, SearchX, Lightbulb, Loader2
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ───────────────────────── Helpers (sin lógica de negocio) ───────────────────────── */

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
  dark, icon: Icon, title, text
}: { dark: boolean; icon: LucideIcon; title: string; text: string }) => (
  <div className="flex flex-col items-center justify-center text-center py-10 px-6">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${dark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
      <Icon size={22} />
    </div>
    <h3 className="font-semibold text-sm">{title}</h3>
    <p className={`text-xs mt-1 max-w-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{text}</p>
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

export default function ClienteDashboard() {
  const [user, setUser] = useState<any>(null)
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  // Consulta de Estatus de Reportes
  const [searchCorreo, setSearchCorreo] = useState('')
  const [misReportes, setMisReportes] = useState<any[]>([])
  const [loadingConsulta, setLoadingConsulta] = useState(false)
  const [busquedaRealizada, setBusquedaRealizada] = useState(false)

  // Formulario Reporte
  const [nombreCliente, setNombreCliente] = useState('')
  const [titulo, setTitulo] = useState('')
  const [correoCuenta, setCorreoCuenta] = useState('')
  const [contrasenaCuenta, setContrasenaCuenta] = useState('')
  const [perfil, setPerfil] = useState('')
  const [pin, setPin] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')

  // Referencias para la actualización en vivo (evitan datos "viejos" dentro de los listeners)
  const ultimaConsultaRef = useRef('')
  const consultarRef = useRef<((correo?: string, silencioso?: boolean) => Promise<void>) | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const clabeKlar = '661180005957342832'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setUser(u)
      await loadCatalogo()
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  // Actualización en vivo: precios nuevos y respuestas del admin aparecen sin recargar.
  // Respaldo: cada 30 s y al volver a la pestaña.
  useEffect(() => {
    if (loading) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const refrescarCatalogo = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { loadCatalogo() }, 300)
    }
    const refrescarReportes = () => {
      if (ultimaConsultaRef.current) consultarRef.current?.(ultimaConsultaRef.current, true)
    }

    const channel = supabase
      .channel('cliente-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicios_catalogo' }, refrescarCatalogo)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes' }, refrescarReportes)
      .subscribe()

    const refrescarTodo = () => {
      if (document.visibilityState !== 'visible') return
      loadCatalogo()
      refrescarReportes()
    }
    const intervalo = setInterval(refrescarTodo, 30000)
    document.addEventListener('visibilitychange', refrescarTodo)

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', refrescarTodo)
      supabase.removeChannel(channel)
    }
  }, [loading])

  const loadCatalogo = async () => {
    const { data: cat } = await supabase.from('servicios_catalogo').select('*').eq('activo', true)
    if (cat) setCatalogo(cat)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(clabeKlar)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleCrearReporte = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo || !correoCuenta || !descripcion) return

    setEnviando(true)
    setMsg('')

    // Solo columnas que existen en la tabla "reportes":
    // nombre_cliente, correo_cuenta, contrasena_cuenta, descripcion_problema,
    // perfil, pin, estatus, estado, usuario_id
    // El título se guarda como primera línea de descripcion_problema.
    const payloadReporte: any = {
      nombre_cliente: nombreCliente || user?.email?.split('@')[0] || 'Cliente',
      correo_cuenta: correoCuenta,
      contrasena_cuenta: contrasenaCuenta || null,
      perfil: perfil || null,
      pin: pin || null,
      descripcion_problema: `${titulo}\n${descripcion}`,
      estatus: 'Pendiente',
      estado: 'pendiente'
    }

    if (user?.uid) {
      payloadReporte.usuario_id = user.uid
    }

    const { error } = await supabase.from('reportes').insert([payloadReporte])

    if (!error) {
      setMsg('✅ Reporte enviado con éxito. Puedes consultar su avance abajo.')
      setNombreCliente('')
      setTitulo('')
      setCorreoCuenta('')
      setContrasenaCuenta('')
      setPerfil('')
      setPin('')
      setDescripcion('')
      handleConsultarEstatus(correoCuenta)
    } else {
      setMsg(`❌ Error al enviar reporte: ${error.message}`)
    }
    setEnviando(false)
  }

  const handleConsultarEstatus = async (correoBuscado?: string, silencioso: boolean = false) => {
    const queryCorreo = correoBuscado || searchCorreo
    if (!queryCorreo.trim()) return

    ultimaConsultaRef.current = queryCorreo
    if (!silencioso) setLoadingConsulta(true)
    setBusquedaRealizada(true)

    const { data } = await supabase
      .from('reportes')
      .select('*')
      .or(`correo_cuenta.ilike.%${queryCorreo.trim()}%,usuario_id.eq.${user?.uid || ''}`)
      .order('created_at', { ascending: false })

    if (data) setMisReportes(data)
    setLoadingConsulta(false)
  }
  // Siempre apunta a la versión más reciente de la función (la usan los listeners en vivo)
  consultarRef.current = handleConsultarEstatus

  /* ───────── Tokens visuales ───────── */
  const ui = {
    page: darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900',
    card: darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-white border-slate-200 shadow-sm',
    cardInner: darkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200',
    muted: darkMode ? 'text-slate-400' : 'text-slate-500',
    divide: darkMode ? 'divide-slate-700/60' : 'divide-slate-100',
    input: `w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 ${
      darkMode ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
    }`,
    btnPrimary: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-sm transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed',
    btnGhost: `inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
      darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
    }`,
  }

  /* ───────── Datos derivados ───────── */
  const combos = catalogo.filter(c => c.categoria === 'combo')
  const porPerfil = catalogo.filter(c => c.categoria === 'perfil')
  const completas = catalogo.filter(c => c.categoria === 'completa')
  const reportesAbiertos = misReportes.filter(r => (r.estatus || r.estado || 'pendiente').toLowerCase() !== 'resuelto').length

  /* ───────── Carga inicial (skeleton) ───────── */
  if (loading) {
    return (
      <div className={`min-h-screen p-4 sm:p-8 ${ui.page}`}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex justify-between items-center gap-4">
            <div className="space-y-2">
              <Skeleton dark={darkMode} className="h-7 w-52" />
              <Skeleton dark={darkMode} className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton dark={darkMode} className="h-10 w-40" />
          </div>
          <Skeleton dark={darkMode} className="h-32 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} dark={darkMode} className="h-24" />)}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton dark={darkMode} className="h-64" />
            <Skeleton dark={darkMode} className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 p-4 sm:p-8 ${ui.page}`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header Cliente + Switcher Tema */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Panel de cliente</h1>
            <p className={`text-sm mt-0.5 ${ui.muted}`}>
              {user?.email ? <>Sesión iniciada como <span className="font-medium">{user.email}</span></> : 'Consulta precios, paga y reporta fallas.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Tarjeta de Pago Klar */}
        <section className="rounded-2xl p-5 sm:p-6 text-white bg-gradient-to-r from-indigo-600 to-blue-600 shadow-lg shadow-indigo-600/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Landmark size={22} />
            </div>
            <div>
              <p className="text-xs text-indigo-100">Método de pago oficial</p>
              <h2 className="text-lg font-bold">Banca: Klar</h2>
              <p className="text-sm text-indigo-100">Titular: <strong className="text-white">Hector Gress Angeles</strong></p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/20 w-full md:w-auto justify-between">
            <div>
              <p className="text-[11px] text-indigo-100">CLABE interbancaria</p>
              <p className="font-mono text-base font-semibold tracking-wider">{clabeKlar}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                copied ? 'bg-emerald-400 text-emerald-950' : 'bg-white text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '¡Copiada!' : 'Copiar CLABE'}
            </button>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard dark={darkMode} icon={Sparkles} tone="warning" label="Combos del mes" value={combos.length} hint="Ofertas activas" />
          <KpiCard dark={darkMode} icon={UserRound} tone="info" label="Planes por perfil" value={porPerfil.length} hint="1 mes de servicio" />
          <KpiCard dark={darkMode} icon={Crown} tone="success" label="Cuentas completas" value={completas.length} hint="Uso exclusivo" />
          <KpiCard
            dark={darkMode}
            icon={LifeBuoy}
            tone={busquedaRealizada && reportesAbiertos > 0 ? 'warning' : 'neutral'}
            label="Mis reportes"
            value={busquedaRealizada ? misReportes.length : '—'}
            hint={busquedaRealizada ? `${reportesAbiertos} abiertos` : 'Consulta con tu correo'}
          />
        </section>

        {/* Combos Terroríficos */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🎃 Combos terroríficos de octubre
          </h2>
          {combos.length === 0 ? (
            <div className={`border rounded-2xl ${ui.card}`}>
              <EmptyState dark={darkMode} icon={Sparkles} title="Aún no hay combos activos" text="Pronto publicaremos las ofertas del mes. Vuelve a revisar en unos días." />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {combos.map((item) => (
                <div key={item.id} className={`p-5 rounded-2xl border space-y-2 ${ui.card}`}>
                  <Pill dark={darkMode} tone="info">Combo especial</Pill>
                  <h3 className="text-base font-semibold">{item.nombre}</h3>
                  <p className={`text-sm ${ui.muted}`}>{item.descripcion}</p>
                  <div className={`text-2xl font-bold pt-1 ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>${item.precio} MXN</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Precios por Perfil y Cuentas Completas */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className={`p-5 rounded-2xl border space-y-3 ${ui.card}`}>
            <h3 className="font-semibold">🍿 Precios por perfil (1 mes)</h3>
            {porPerfil.length === 0 ? (
              <EmptyState dark={darkMode} icon={UserRound} title="Sin precios por perfil" text="Cuando el administrador los publique, los verás aquí." />
            ) : (
              <div className={`divide-y max-h-72 overflow-y-auto pr-1 ${ui.divide}`}>
                {porPerfil.map((p) => (
                  <div key={p.id} className="py-2.5 flex justify-between items-center text-sm">
                    <span className="font-medium">{p.nombre}</span>
                    <span className={`font-bold ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>${p.precio} MXN</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`p-5 rounded-2xl border space-y-3 ${ui.card}`}>
            <h3 className="font-semibold">👑 Cuentas completas exclusivas</h3>
            {completas.length === 0 ? (
              <EmptyState dark={darkMode} icon={Crown} title="Sin cuentas completas" text="Cuando el administrador las publique, las verás aquí." />
            ) : (
              <div className={`divide-y max-h-72 overflow-y-auto pr-1 ${ui.divide}`}>
                {completas.map((cc) => (
                  <div key={cc.id} className="py-2.5 flex justify-between items-center text-sm">
                    <span className="font-medium">{cc.nombre}</span>
                    <span className={`font-bold ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>${cc.precio} MXN</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Formulario Completo de Reportes */}
        <section className={`p-5 sm:p-6 rounded-2xl border space-y-4 ${ui.card}`}>
          <div>
            <h2 className="text-lg font-semibold">Generar reporte de fallas</h2>
            <p className={`text-sm ${ui.muted}`}>Cuéntanos qué pasa con tu cuenta y te responderemos aquí mismo.</p>
          </div>

          {msg && (
            <div className={`p-3 rounded-xl border text-sm ${toneClasses(darkMode, msg.startsWith('✅') ? 'success' : 'danger')}`}>
              {msg}
            </div>
          )}

          <form onSubmit={handleCrearReporte} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field dark={darkMode} label="Tu nombre completo">
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  className={ui.input}
                />
              </Field>

              <Field dark={darkMode} label="Título del problema *">
                <input
                  type="text"
                  required
                  placeholder="Ej. Sin acceso / Perfil bloqueado"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className={ui.input}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field dark={darkMode} label="Correo de la cuenta *">
                <input
                  type="email"
                  required
                  placeholder="cuenta@ejemplo.com"
                  value={correoCuenta}
                  onChange={(e) => setCorreoCuenta(e.target.value)}
                  className={ui.input}
                />
              </Field>
              <Field dark={darkMode} label="Contraseña de la cuenta">
                <input
                  type="text"
                  placeholder="Contraseña actual"
                  value={contrasenaCuenta}
                  onChange={(e) => setContrasenaCuenta(e.target.value)}
                  className={ui.input}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field dark={darkMode} label="Perfil asignado (si aplica)">
                <input
                  type="text"
                  placeholder="Ej. Perfil 1 / Nombre"
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                  className={ui.input}
                />
              </Field>
              <Field dark={darkMode} label="PIN del perfil (si aplica)">
                <input
                  type="text"
                  placeholder="Ej. 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className={ui.input}
                />
              </Field>
            </div>

            <Field dark={darkMode} label="Descripción de la falla *">
              <textarea
                required
                rows={3}
                placeholder="Explica qué mensaje muestra la pantalla o qué sucede al intentar acceder..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className={ui.input}
              />
            </Field>

            <button type="submit" disabled={enviando} className={ui.btnPrimary}>
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {enviando ? 'Enviando...' : 'Enviar reporte al administrador'}
            </button>
          </form>
        </section>

        {/* Consultar Estatus */}
        <section className={`p-5 sm:p-6 rounded-2xl border space-y-4 ${ui.card}`}>
          <div>
            <h2 className="text-lg font-semibold">Consultar estatus de reportes</h2>
            <p className={`text-sm ${ui.muted}`}>Escribe el correo de tu cuenta. Las respuestas del administrador se actualizan solas.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.muted}`} />
              <input
                type="email"
                placeholder="Ingresa tu correo de cuenta para consultar"
                value={searchCorreo}
                onChange={(e) => setSearchCorreo(e.target.value)}
                className={`${ui.input} pl-10`}
              />
            </div>
            <button
              type="button"
              onClick={() => handleConsultarEstatus()}
              className={ui.btnPrimary}
            >
              {loadingConsulta ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loadingConsulta ? 'Buscando...' : 'Consultar estatus'}
            </button>
          </div>

          {loadingConsulta && (
            <div className="space-y-3 pt-1">
              {[0, 1].map((i) => <Skeleton key={i} dark={darkMode} className="h-24 w-full" />)}
            </div>
          )}

          {!loadingConsulta && busquedaRealizada && (
            misReportes.length > 0 ? (
              <div className="space-y-3 pt-1">
                {misReportes.map((rep) => {
                  const estatusStr = (rep.estatus || rep.estado || 'Pendiente').toLowerCase()
                  const tone: Tone = estatusStr === 'resuelto' ? 'success' : estatusStr === 'en proceso' ? 'info' : 'warning'
                  return (
                    <div key={rep.id} className={`p-4 border rounded-xl flex flex-col sm:flex-row justify-between items-start gap-3 ${ui.cardInner}`}>
                      <div className="space-y-1 min-w-0">
                        <h4 className="font-semibold text-sm">{getTituloReporte(rep)}</h4>
                        <p className={`text-xs font-mono ${darkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                          Cuenta: {rep.correo_cuenta} {(rep.perfil || rep.perfil_asignado) && `| Perfil: ${rep.perfil || rep.perfil_asignado}`} {(rep.pin || rep.pin_perfil) && `(PIN: ${rep.pin || rep.pin_perfil})`}
                        </p>
                        <p className={`text-sm mt-1 whitespace-pre-line ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{getDescripcionReporte(rep)}</p>

                        {rep.solucion && (
                          <div className={`p-3 rounded-lg border text-sm mt-2 flex gap-2 ${toneClasses(darkMode, 'info')}`}>
                            <Lightbulb size={16} className="shrink-0 mt-0.5" />
                            <span><strong>Respuesta del administrador:</strong> {rep.solucion}</span>
                          </div>
                        )}
                      </div>
                      <Pill dark={darkMode} tone={tone}>{rep.estatus || rep.estado || 'Pendiente'}</Pill>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                dark={darkMode}
                icon={SearchX}
                title="No encontramos reportes con ese correo"
                text="Revisa que esté escrito igual que en tu cuenta, o envía un reporte nuevo arriba."
              />
            )
          )}

          {!loadingConsulta && !busquedaRealizada && (
            <EmptyState
              dark={darkMode}
              icon={Inbox}
              title="Aquí verás tus reportes"
              text="Consulta con el correo de tu cuenta para ver su estado y la respuesta del administrador."
            />
          )}
        </section>
      </div>
    </div>
  )
}
