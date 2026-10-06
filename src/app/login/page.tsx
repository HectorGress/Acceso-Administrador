'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      if (isRegister) {
        // 1. Crear el usuario en Firebase Authentication (Evita el rate limit de SMTP)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        // 2. Mapear el perfil en la tabla 'profiles' de Supabase
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { id: user.uid, correo: user.email, rol: 'cliente' }
          ])

        if (profileError) {
          console.error("Error guardando el perfil en Supabase:", profileError)
        }

        // Redirección hacia la ruta exacta de cliente
        router.push('/cliente/dashboard')
      } else {
        // 1. Autenticar con Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        // 2. Obtener el rol del usuario desde la tabla 'profiles' de Supabase
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', user.uid)
          .single()

        if (fetchError) {
          console.error("Error consultando el rol:", fetchError)
        }

        // Redirección según la estructura de carpetas activa
        if (profile?.rol === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/cliente/dashboard')
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('El correo electrónico ya está registrado.')
      } else if (
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password'
      ) {
        setErrorMsg('Usuario o contraseña incorrectos.')
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setErrorMsg('Ocurrió un error. Intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center relative p-4 transition-colors duration-300 ${isDarkMode ? 'bg-[#0a0d14] text-white' : 'bg-slate-100 text-slate-900'}`}>
      
      {/* Botón de cambio de tema */}
      <button 
        type="button"
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute top-6 right-6 px-4 py-2 text-xs font-semibold rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center gap-2 transition-all shadow-md backdrop-blur-sm"
      >
        <span>☀️</span> {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
      </button>

      {/* Contenedor Principal / Tarjeta Neón */}
      <div className={`w-full max-w-md p-8 rounded-2xl border shadow-2xl backdrop-blur-md transition-all ${
        isDarkMode 
          ? 'bg-[#121622]/90 border-purple-500/20 shadow-purple-900/20' 
          : 'bg-white border-slate-200 shadow-slate-200'
      }`}>
        
        {/* Header con Icono de Escudo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-purple-600/10 border border-purple-500/30 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
            <svg className="w-9 h-9 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
            {isRegister ? 'Registro de Cliente' : 'Acceso al Sistema'}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            {isRegister ? 'Crea una cuenta para acceder a tus servicios' : 'Ingresa tus credenciales para continuar'}
          </p>
        </div>

        {/* Banner de Mensaje de Error */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-semibold animate-pulse">
            {errorMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 text-sm">
                ✉️
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu_correo@gmail.com"
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${
                  isDarkMode 
                    ? 'bg-[#161b28] border-slate-800 text-white placeholder-slate-600 focus:border-purple-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500 text-sm">
                🔒
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all ${
                  isDarkMode 
                    ? 'bg-[#161b28] border-slate-800 text-white placeholder-slate-600 focus:border-purple-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-6"
          >
            {loading ? (
              <span className="animate-pulse">Cargando...</span>
            ) : isRegister ? (
              <><span>👤+</span> Crear Cuenta de Cliente</>
            ) : (
              <><span>➔]</span> Iniciar Sesión</>
            )}
          </button>
        </form>

        {/* Toggle para intercambiar entre Login y Registro */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setErrorMsg('')
            }}
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
          >
            {isRegister 
              ? '¿Ya tienes una cuenta? Inicia sesión' 
              : '¿Eres cliente nuevo? Regístrate aquí'}
          </button>
        </div>

      </div>
    </div>
  )
}