'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sun, Moon, Check, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function AdminReportesPage() {
  const [darkMode, setDarkMode] = useState(false)
  const [reportes, setReportes] = useState<any[]>([])
  const [soluciones, setSoluciones] = useState<{ [key: number]: string }>({})
  const [cargando, setCargando] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    cargarReportes()
  }, [])

  const cargarReportes = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('reportes')
      .select('*')
      .order('created_at', { ascending: false })
    setReportes(data || [])
    setCargando(false)
  }

  const responderReporte = async (id: number) => {
    const solucionTexto = soluciones[id]
    if (!solucionTexto) return

    await supabase
      .from('reportes')
      .update({
        solucion: solucionTexto,
        estado: 'Resuelto',
        atendido: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    setSoluciones({ ...soluciones, [id]: '' })
    cargarReportes()
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 p-6 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-8 border-b pb-4 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800">
            <ArrowLeft size={18} />
          </Link>
          <h1 className={`text-2xl font-black ${darkMode ? 'text-purple-400' : 'text-purple-700'}`}>
            Atención de Reportes
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarReportes}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2.5 rounded-xl border transition-all text-xs font-semibold flex items-center gap-2 ${
              darkMode 
                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto space-y-4">
        {reportes.length === 0 ? (
          <p className="text-center text-slate-500 font-medium py-12">No hay reportes registrados por el momento.</p>
        ) : (
          reportes.map((rep) => (
            <div key={rep.id} className={`p-5 border rounded-2xl shadow-sm space-y-3 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-base block">{rep.nombre_cliente}</span>
                  <p className="text-xs text-slate-500 font-semibold">Cuenta: {rep.correo_cuenta} | Clave: {rep.contrasena_cuenta}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  rep.atendido 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' 
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                }`}>
                  {rep.estado || 'Pendiente'}
                </span>
              </div>

              <div className={`p-3 rounded-lg text-xs font-medium ${
                darkMode ? 'bg-slate-950 border border-slate-800 text-slate-300' : 'bg-slate-100 border border-slate-200 text-slate-800'
              }`}>
                <strong>Fallo reportado:</strong> {rep.descripcion_problema}
              </div>

              {rep.solucion && (
                <div className="p-3 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                  <strong>Solución enviada:</strong> {rep.solucion}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Escribe la solución para el cliente..."
                  value={soluciones[rep.id] || ''}
                  onChange={(e) => setSoluciones({ ...soluciones, [rep.id]: e.target.value })}
                  className={`flex-1 border rounded-xl px-3 py-2 text-xs font-medium ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  onClick={() => responderReporte(rep.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
                >
                  <Check size={16} /> Responder
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}