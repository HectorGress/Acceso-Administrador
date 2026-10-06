'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase'

export default function ClienteDashboard() {
  const [user, setUser] = useState<any>(null)
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [darkMode, setDarkMode] = useState(true)

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

    const { error } = await supabase.from('reportes').insert([
      {
        usuario_id: user?.uid,
        nombre_cliente: nombreCliente || user?.email?.split('@')[0],
        titulo,
        correo_cuenta: correoCuenta,
        contrasena_cuenta: contrasenaCuenta,
        perfil_asignado: perfil,
        pin_perfil: pin,
        descripcion,
        estatus: 'Pendiente'
      }
    ])

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

  const handleConsultarEstatus = async (correoBuscado?: string) => {
    const queryCorreo = correoBuscado || searchCorreo
    if (!queryCorreo.trim()) return

    setLoadingConsulta(true)
    setBusquedaRealizada(true)

    const { data } = await supabase
      .from('reportes')
      .select('*')
      .or(`correo_cuenta.ilike.%${queryCorreo.trim()}%,usuario_id.eq.${user?.uid || ''}`)
      .order('created_at', { ascending: false })

    if (data) setMisReportes(data)
    setLoadingConsulta(false)
  }

  if (loading) return <div className="min-h-screen bg-[#0a0d14] text-purple-400 flex items-center justify-center font-bold">Cargando Panel...</div>

  return (
    <div className={`min-h-screen transition-colors duration-200 p-3 sm:p-6 space-y-6 ${darkMode ? 'bg-[#0a0d14] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header Cliente + Switcher Tema */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
            Panel de Cliente
          </h1>
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{user?.email}</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              darkMode ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-white border-slate-300 text-slate-700 shadow-sm'
            }`}
          >
            {darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
          </button>
          <button onClick={() => signOut(auth)} className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-xs font-semibold hover:bg-red-500/20">
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Tarjeta de Pago Klar */}
      <div className={`p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border shadow-xl ${
        darkMode ? 'bg-gradient-to-r from-purple-900/40 to-slate-900 border-purple-500/30' : 'bg-white border-purple-200'
      }`}>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-md">Método de Pago Oficial</span>
          <h2 className="text-lg font-extrabold mt-1">Banca: Klar</h2>
          <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Titular: <strong>Hector Gress Angeles</strong></p>
        </div>
        
        <div className={`flex items-center gap-3 p-2.5 rounded-xl border w-full md:w-auto justify-between ${
          darkMode ? 'bg-[#121622] border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          <div>
            <p className="text-[9px] text-slate-400 uppercase font-bold">CLABE Interbancaria</p>
            <p className="font-mono text-sm text-amber-500 font-bold tracking-wider">{clabeKlar}</p>
          </div>
          <button
            onClick={copyToClipboard}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              copied ? 'bg-emerald-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {copied ? '¡Copiado!' : 'Copiar CLABE'}
          </button>
        </div>
      </div>

      {/* Combos Terroríficos */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-amber-500 flex items-center gap-2">
          🎃 COMBOS TERRORÍFICOS DE OCTUBRE
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalogo.filter(c => c.categoria === 'combo').map((item) => (
            <div key={item.id} className={`p-4 rounded-2xl border space-y-2 ${
              darkMode ? 'bg-gradient-to-br from-purple-950/40 to-slate-900 border-purple-500/40' : 'bg-white border-purple-200 shadow-sm'
            }`}>
              <span className="text-[9px] uppercase font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded">Combo Especial</span>
              <h3 className="text-base font-bold">{item.nombre}</h3>
              <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.descripcion}</p>
              <div className="text-xl font-black text-amber-500 pt-2">${item.precio} MXN</div>
            </div>
          ))}
        </div>
      </div>

      {/* Precios por Perfil y Cuentas Completas */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={`p-5 rounded-2xl border space-y-3 ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className="text-sm font-bold text-purple-500">🍿 Precios Por Perfil (1 Mes)</h3>
          <div className="divide-y divide-slate-700/30 max-h-72 overflow-y-auto pr-1">
            {catalogo.filter(c => c.categoria === 'perfil').map((p) => (
              <div key={p.id} className="py-2 flex justify-between items-center text-xs">
                <span className="font-medium">{p.nombre}</span>
                <span className="font-extrabold text-amber-500">${p.precio} MXN</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border space-y-3 ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className="text-sm font-bold text-indigo-500">👑 Cuentas Completas Exclusivas</h3>
          <div className="divide-y divide-slate-700/30 max-h-72 overflow-y-auto pr-1">
            {catalogo.filter(c => c.categoria === 'completa').map((cc) => (
              <div key={cc.id} className="py-2 flex justify-between items-center text-xs">
                <span className="font-medium">{cc.nombre}</span>
                <span className="font-extrabold text-emerald-500">${cc.precio} MXN</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formulario Completo de Reportes */}
      <div className={`p-4 sm:p-6 rounded-2xl border space-y-4 ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h2 className="text-base font-bold text-purple-500">Generar Reporte de Fallas / Soporte</h2>
        {msg && <div className="p-3 bg-purple-500/10 border border-purple-500/30 text-purple-500 text-xs rounded-xl">{msg}</div>}

        <form onSubmit={handleCrearReporte} className="space-y-3 text-xs">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Tu Nombre Completo</label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={nombreCliente}
                onChange={(e) => setNombreCliente(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                  darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Título del Problema *</label>
              <input
                type="text"
                required
                placeholder="Ej. Sin acceso / Perfil bloqueado"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                  darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Correo de la Cuenta *</label>
              <input
                type="email"
                required
                placeholder="cuenta@ejemplo.com"
                value={correoCuenta}
                onChange={(e) => setCorreoCuenta(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                  darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Contraseña de la Cuenta</label>
              <input
                type="text"
                placeholder="Contraseña actual"
                value={contrasenaCuenta}
                onChange={(e) => setContrasenaCuenta(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                  darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Perfil Asignado (si aplica)</label>
              <input
                type="text"
                placeholder="Ej. Perfil 1 / Nombre"
                value={perfil}
                onChange={(e) => setPerfil(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                  darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">PIN del Perfil (si aplica)</label>
              <input
                type="text"
                placeholder="Ej. 1234"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                  darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Descripción de la Cuenta / Falla *</label>
            <textarea
              required
              rows={3}
              placeholder="Explica qué mensaje muestra la pantalla o qué sucede al intentar acceder..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={`w-full p-3 rounded-xl border focus:outline-none focus:border-purple-500 ${
                darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-600/25"
          >
            {enviando ? 'Enviando...' : 'Enviar Reporte al Admin'}
          </button>
        </form>
      </div>

      {/* Consultar Estatus (CON BOTÓN INTERACTIVO Y BADGE) */}
      <div className={`p-4 sm:p-6 rounded-2xl border space-y-4 ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h2 className="text-base font-bold text-purple-500">Consultar Estatus de Reportes</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Ingresa tu correo de cuenta para consultar..."
            value={searchCorreo}
            onChange={(e) => setSearchCorreo(e.target.value)}
            className={`flex-1 p-3 rounded-xl text-xs border focus:outline-none focus:border-purple-500 ${
              darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
            }`}
          />
          <button
            type="button"
            onClick={() => handleConsultarEstatus()}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition duration-200"
          >
            {loadingConsulta ? 'Buscando...' : 'Consultar Estatus'}
          </button>
        </div>

        {busquedaRealizada && (
          misReportes.length > 0 ? (
            <div className="space-y-3 pt-2">
              {misReportes.map((rep) => {
                const estatusStr = (rep.estatus || rep.estado || 'Pendiente').toLowerCase()
                return (
                  <div key={rep.id} className={`p-4 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    darkMode ? 'bg-[#1a1f2e] border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-purple-400">{rep.titulo}</h4>
                      <p className="text-xs text-amber-500 font-mono">
                        Cuenta: {rep.correo_cuenta} {rep.perfil_asignado && `| Perfil: ${rep.perfil_asignado}`} {rep.pin_perfil && `(PIN: ${rep.pin_perfil})`}
                      </p>
                      <p className="text-xs text-slate-300 mt-1">{rep.descripcion}</p>

                      {rep.solucion && (
                        <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs text-purple-300 mt-2">
                          💡 <strong>Respuesta del Administrador:</strong> {rep.solucion}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                        estatusStr === 'resuelto' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                        estatusStr === 'en proceso' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                        {rep.estatus || rep.estado || 'Pendiente'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No hay reportes que coincidan con la búsqueda.</p>
          )
        )}
      </div>
    </div>
  )
}