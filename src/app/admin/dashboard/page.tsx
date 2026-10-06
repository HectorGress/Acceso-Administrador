'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase'

export default function AdminDashboard() {
  const [tab, setTab] = useState<'clientes' | 'madres' | 'precios' | 'reportes'>('clientes')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedServicio, setSelectedServicio] = useState('Todos')
  const [darkMode, setDarkMode] = useState(true)
  const [copiedId, setCopiedId] = useState<string | number | null>(null)
  
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
      const solIniciales: { [key: string]: string } = {}
      rep.forEach(r => {
        solIniciales[r.id] = r.solucion || ''
      })
      setSolucionesInput(solIniciales)
    }
  }

  const getSemaforoStatus = (fechaVencimiento: string) => {
    if (!fechaVencimiento) return { label: 'Sin Fecha', class: darkMode ? 'bg-slate-500/20 text-slate-300 border-slate-500/30' : 'bg-slate-200 text-slate-700 border-slate-300' }
    
    const hoy = new Date()
    const vencimiento = new Date(fechaVencimiento)
    const diffTime = vencimiento.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { label: 'Vencida', class: darkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300' }
    } else if (diffDays <= 5) {
      return { label: 'Por Vencer', class: darkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-800 border-amber-300' }
    } else {
      return { label: 'Estable', class: darkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    }
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
    
    if (tab === 'clientes') {
      const payload: any = {
        nombre_completo: formData.nombre_completo || null,
        correo_cuenta: formData.correo_cuenta || null,
        contrasena_cuenta: formData.contrasena_cuenta || null,
        servicio: formData.servicio || null,
        perfil_asignado: formData.perfil_asignado || null,
        pin_perfil: formData.pin_perfil || null,
        precio_suscripcion: formData.precio_suscripcion ? Number(formData.precio_suscripcion) : null,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        fecha_adquisicion: formData.fecha_adquisicion || null,
        correo: formData.correo || null,
        contrasena: formData.contrasena || null
      }

      if (editingItem) {
        await supabase.from('cuentas_clientes').update(payload).eq('id', editingItem.id)
      } else {
        await supabase.from('cuentas_clientes').insert([payload])
      }
    } else if (tab === 'madres') {
      const payload: any = {
        proveedor: formData.proveedor || null,
        codigo_panel: formData.codigo_panel || null,
        servicio: formData.servicio || null,
        correo: formData.correo || null,
        contrasena: formData.contrasena || null,
        fecha_adquisicion: formData.fecha_adquisicion || null,
        fecha_vencimiento: formData.fecha_vencimiento || null
      }

      if (editingItem) {
        await supabase.from('cuentas_madre').update(payload).eq('id', editingItem.id)
      } else {
        await supabase.from('cuentas_madre').insert([payload])
      }
    } else if (tab === 'precios') {
      const payload: any = {
        nombre: formData.nombre || formData.servicio || null,
        servicio: formData.servicio || formData.nombre || null,
        categoria: formData.categoria || 'perfil',
        precio: formData.precio ? Number(formData.precio) : 0,
        descripcion: formData.descripcion || null
      }

      if (editingItem) {
        await supabase.from('servicios_catalogo').update(payload).eq('id', editingItem.id)
      } else {
        await supabase.from('servicios_catalogo').insert([payload])
      }
    }

    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({})
    await loadAllData()
  }

  const handleDelete = async (table: string, id: any) => {
    if (confirm('¿Deseas eliminar este registro?')) {
      await supabase.from(table).delete().eq('id', id)
      await loadAllData()
    }
  }

  const handleUpdateReporteStatus = async (id: any, nuevoEstatus: string) => {
    const mensajeSolucion = solucionesInput[id] || ''
    
    await supabase.from('reportes').update({ 
      estatus: nuevoEstatus,
      solucion: mensajeSolucion 
    }).eq('id', id)

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
        matchServicio = servLower.includes('max') || servLower.includes('hbo')
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

  if (loading) return <div className="min-h-screen bg-[#0a0d14] text-purple-400 flex items-center justify-center font-bold">Cargando Panel Admin...</div>

  return (
    <div className={`min-h-screen transition-colors duration-200 p-3 md:p-6 space-y-6 ${darkMode ? 'bg-[#0a0d14] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Header Admin */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
            Panel de Administración
          </h1>
          <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gestión de Cuentas, Precios, Combos y Atención a Reportes</p>
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

      {/* Navegación por pestañas */}
      <div className={`flex overflow-x-auto gap-2 border-b pb-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        {[
          { id: 'clientes', name: 'Cuentas Clientes' },
          { id: 'madres', name: 'Cuentas Madre' },
          { id: 'precios', name: 'Precios y Combo del Mes' },
          { id: 'reportes', name: `Reportes (${reportes.filter(r => (r.estatus || r.estado)?.toLowerCase() !== 'resuelto').length})` }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id as any); setFilter(''); setSelectedServicio('Todos'); }}
            className={`whitespace-nowrap px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              tab === t.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : darkMode ? 'bg-slate-800/60 text-slate-400 hover:bg-slate-800' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Buscador & Filtro por Servicio */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="🔍 Buscar por correo, cliente o detalles..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`px-4 py-2 rounded-xl text-xs border focus:outline-none focus:border-purple-500 w-full sm:w-64 ${
              darkMode ? 'bg-[#121622] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
            }`}
          />

          <select
            value={selectedServicio}
            onChange={(e) => setSelectedServicio(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs border focus:outline-none focus:border-purple-500 w-full sm:w-auto ${
              darkMode ? 'bg-[#121622] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-800 shadow-sm'
            }`}
          >
            {serviciosFiltro.map((s) => (
              <option key={s} value={s}>{s === 'Todos' ? '📺 Todos los Servicios' : s}</option>
            ))}
          </select>
        </div>

        {tab !== 'reportes' && (
          <button
            onClick={() => { setEditingItem(null); setFormData({}); setIsModalOpen(true); }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20"
          >
            + Crear Registro
          </button>
        )}
      </div>

      {/* TABLA: Cuentas Clientes */}
      {tab === 'clientes' && (
        <div className={`border rounded-2xl overflow-x-auto ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className={`${darkMode ? 'bg-[#1a1f2e] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase font-bold border-b`}>
              <tr>
                <th className="p-3">Cliente</th>
                <th className="p-3">Correo / Contraseña Cuenta</th>
                <th className="p-3">Servicio</th>
                <th className="p-3">Perfil / PIN</th>
                <th className="p-3">Precio</th>
                <th className="p-3">Vencimiento</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-slate-800/50' : 'divide-slate-200'}`}>
              {applyFilters(cuentasClientes).map((item) => {
                const semaforo = getSemaforoStatus(item.fecha_vencimiento)
                return (
                  <tr key={item.id} className={darkMode ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50'}>
                    <td className="p-3 font-semibold">
                      {item.nombre_completo || '-'}
                      {item.correo && <div className="text-[10px] text-slate-400">{item.correo}</div>}
                    </td>
                    <td className="p-3 font-mono">
                      <span className="text-amber-400 font-bold">{item.correo_cuenta || item.correo || '-'}</span>
                      <br />
                      <span className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pass: {item.contrasena_cuenta || item.contrasena || 'S/N'}</span>
                    </td>
                    <td className="p-3 text-purple-500 font-bold">{item.servicio || '-'}</td>
                    <td className="p-3 font-mono">{item.perfil_asignado || '-'} (PIN: {item.pin_perfil || 'S/N'})</td>
                    <td className="p-3 font-bold text-emerald-400">${item.precio_suscripcion || 0} MXN</td>
                    <td className="p-3">{item.fecha_vencimiento || 'Sin fecha'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${semaforo.class}`}>
                        {semaforo.label}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleCopiarDatosCliente(item)}
                        className={`px-2 py-1 rounded text-[10px] font-bold ${
                          copiedId === item.id ? 'bg-emerald-500 text-white' : 'bg-purple-600/30 text-purple-300 hover:bg-purple-600/50'
                        }`}
                      >
                        {copiedId === item.id ? '¡Copiado!' : '📋 Copiar Datos'}
                      </button>
                      <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="text-indigo-500 hover:underline">Editar</button>
                      <button onClick={() => handleDelete('cuentas_clientes', item.id)} className="text-red-500 hover:underline">Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA: Cuentas Madre */}
      {tab === 'madres' && (
        <div className={`border rounded-2xl overflow-x-auto ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className={`${darkMode ? 'bg-[#1a1f2e] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'} uppercase font-bold border-b`}>
              <tr>
                <th className="p-3">Proveedor</th>
                <th className="p-3">Código Panel</th>
                <th className="p-3">Servicio</th>
                <th className="p-3">Correo / Contraseña</th>
                <th className="p-3">Fecha Adquisición</th>
                <th className="p-3">Fecha Vencimiento</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-slate-800/50' : 'divide-slate-200'}`}>
              {applyFilters(cuentasMadre).map((item) => {
                const semaforo = getSemaforoStatus(item.fecha_vencimiento)
                return (
                  <tr key={item.id} className={darkMode ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50'}>
                    <td className="p-3 font-semibold">{item.proveedor || '-'}</td>
                    <td className="p-3 font-mono text-purple-400">{item.codigo_panel || '-'}</td>
                    <td className="p-3 font-bold text-pink-400">{item.servicio || '-'}</td>
                    <td className="p-3 font-mono">
                      <span className="text-amber-400 font-bold">{item.correo || '-'}</span>
                      <br />
                      <span className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Pass: {item.contrasena || 'S/N'}</span>
                    </td>
                    <td className="p-3">{item.fecha_adquisicion || '-'}</td>
                    <td className="p-3">{item.fecha_vencimiento || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${semaforo.class}`}>
                        {semaforo.label}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="text-indigo-500 hover:underline">Editar</button>
                      <button onClick={() => handleDelete('cuentas_madre', item.id)} className="text-red-500 hover:underline">Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA: Precios y Combo del Mes */}
      {tab === 'precios' && (
        <div className={`border rounded-2xl p-4 space-y-4 ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h2 className="font-bold text-sm text-purple-500">Catálogo de Precios y Oferta del Mes</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {applyFilters(servicios).map((s) => (
              <div key={s.id} className={`p-4 border rounded-xl flex justify-between items-center ${darkMode ? 'bg-[#1a1f2e] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{s.nombre || s.servicio}</span>
                    <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-purple-600/20 text-purple-500 font-bold">{s.categoria || s.tipo || 'General'}</span>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{s.descripcion}</p>
                  <p className="text-lg font-extrabold text-amber-500 mt-2">${s.precio} MXN</p>
                </div>
                <div className="space-y-2">
                  <button onClick={() => { setEditingItem(s); setFormData(s); setIsModalOpen(true); }} className="block w-full text-xs bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-indigo-500 hover:bg-indigo-600/30 font-bold">
                    Editar
                  </button>
                  <button onClick={() => handleDelete('servicios_catalogo', s.id)} className="block w-full text-xs bg-red-600/20 border border-red-500/30 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-600/30 font-bold">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MÓDULO: Reportes con Nombre del Cliente y Mensaje de Solución */}
      {tab === 'reportes' && (
        <div className={`border rounded-2xl p-4 sm:p-5 space-y-4 ${darkMode ? 'bg-[#121622] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h2 className="font-bold text-sm text-purple-500">Módulo de Atención de Soporte</h2>
          <div className="space-y-4">
            {applyFilters(reportes).map((rep) => {
              const estatusActual = (rep.estatus || rep.estado || 'Pendiente').toLowerCase()
              return (
                <div key={rep.id} className={`p-4 sm:p-5 border rounded-2xl space-y-3 ${darkMode ? 'bg-[#1a1f2e] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-purple-500">{rep.titulo}</span>
                        <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                          estatusActual === 'resuelto' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                          estatusActual === 'en proceso' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                          'bg-red-500/20 text-red-500 border-red-500/30'
                        }`}>
                          {rep.estatus || rep.estado || 'Pendiente'}
                        </span>
                      </div>
                      <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        👤 <strong>Cliente:</strong> {rep.nombre_cliente || 'No especificado'}
                      </p>
                      <p className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        📧 <strong>Cuenta Afectada:</strong> <span className="text-amber-500 font-bold">{rep.correo_cuenta || 'N/A'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => handleUpdateReporteStatus(rep.id, 'En Proceso')} className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-500 text-xs font-bold rounded-xl hover:bg-amber-500/30">
                        En Proceso
                      </button>
                      <button onClick={() => handleUpdateReporteStatus(rep.id, 'Resuelto')} className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 text-xs font-bold rounded-xl hover:bg-emerald-500/30">
                        Resolver
                      </button>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border text-xs space-y-2 ${darkMode ? 'bg-[#121622] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <div className="grid sm:grid-cols-3 gap-2 font-mono text-[11px] pb-2 border-b border-slate-700/40">
                      <p><strong>Contraseña:</strong> {rep.contrasena_cuenta || 'N/A'}</p>
                      <p><strong>Perfil:</strong> {rep.perfil_asignado || rep.perfil || 'N/A'}</p>
                      <p><strong>PIN:</strong> {rep.pin_perfil || rep.pin || 'N/A'}</p>
                    </div>
                    <p><strong>Falla Reportada:</strong> {rep.descripcion}</p>

                    <div className="pt-2 border-t border-slate-700/40 space-y-1">
                      <label className="block text-[11px] font-bold text-purple-400">💬 Mensaje / Indicaciones para el Cliente:</label>
                      <input
                        type="text"
                        placeholder="Ej. Contraseña actualizada a 'X123' / Reinicia tu sesión"
                        value={solucionesInput[rep.id] || ''}
                        onChange={(e) => setSolucionesInput({ ...solucionesInput, [rep.id]: e.target.value })}
                        className={`w-full p-2 rounded-lg text-xs border focus:outline-none focus:border-purple-500 ${
                          darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal CRUD Dinámico */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`border w-full max-w-md p-6 rounded-2xl space-y-4 my-8 ${darkMode ? 'bg-[#121622] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <h3 className="font-bold text-base text-purple-500">
              {editingItem ? 'Editar Registro' : 'Nuevo Registro'}
            </h3>
            
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              {tab === 'clientes' && (
                <>
                  <input type="text" placeholder="Nombre Completo" value={formData.nombre_completo || ''} onChange={(e) => setFormData({...formData, nombre_completo: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="email" placeholder="Correo de la Cuenta" value={formData.correo_cuenta || ''} onChange={(e) => setFormData({...formData, correo_cuenta: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="Contraseña de la Cuenta" value={formData.contrasena_cuenta || ''} onChange={(e) => setFormData({...formData, contrasena_cuenta: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="Servicio (ej. Disney+)" value={formData.servicio || ''} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="Perfil Asignado" value={formData.perfil_asignado || ''} onChange={(e) => setFormData({...formData, perfil_asignado: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="PIN de Perfil" value={formData.pin_perfil || ''} onChange={(e) => setFormData({...formData, pin_perfil: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="number" placeholder="Precio Suscripción MXN" value={formData.precio_suscripcion || ''} onChange={(e) => setFormData({...formData, precio_suscripcion: parseFloat(e.target.value)})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <label className="block text-slate-400">Fecha Vencimiento:</label>
                  <input type="date" value={formData.fecha_vencimiento || ''} onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                </>
              )}

              {tab === 'madres' && (
                <>
                  <input type="text" placeholder="Proveedor" value={formData.proveedor || ''} onChange={(e) => setFormData({...formData, proveedor: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="Código Panel" value={formData.codigo_panel || ''} onChange={(e) => setFormData({...formData, codigo_panel: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="Servicio" value={formData.servicio || ''} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="email" placeholder="Correo" value={formData.correo || ''} onChange={(e) => setFormData({...formData, correo: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <input type="text" placeholder="Contraseña" value={formData.contrasena || ''} onChange={(e) => setFormData({...formData, contrasena: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <label className="block text-slate-400">Fecha Adquisición:</label>
                  <input type="date" value={formData.fecha_adquisicion || ''} onChange={(e) => setFormData({...formData, fecha_adquisicion: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <label className="block text-slate-400">Fecha Vencimiento:</label>
                  <input type="date" value={formData.fecha_vencimiento || ''} onChange={(e) => setFormData({...formData, fecha_vencimiento: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                </>
              )}

              {tab === 'precios' && (
                <>
                  <input type="text" placeholder="Nombre Servicio / Producto" value={formData.nombre || ''} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <select value={formData.categoria || 'perfil'} onChange={(e) => setFormData({...formData, categoria: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`}>
                    <option value="perfil">Perfil</option>
                    <option value="completa">Cuenta Completa</option>
                    <option value="combo">Combo del Mes</option>
                  </select>
                  <input type="number" step="0.01" placeholder="Precio Público MXN" value={formData.precio || ''} onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value)})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                  <textarea placeholder="Descripción" value={formData.descripcion || ''} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className={`w-full p-2.5 rounded-xl border ${darkMode ? 'bg-[#1a1f2e] border-slate-800 text-white' : 'bg-slate-50 border-slate-300'}`} />
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-500/20 rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}