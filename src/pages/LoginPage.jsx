import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

import { useNavigate } from 'react-router-dom'
import { Lock, User } from 'lucide-react'
import logo from '../assets/logo.png'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const { signIn, user } = useAuth()
    const navigate = useNavigate()
    const [statusMsg, setStatusMsg] = useState('')

    // Verificar si ya está logueado y redirigir
    useEffect(() => {
        if (user) {
            console.log('User already logged in, redirecting...')
            navigate('/', { replace: true })
        }
    }, [user, navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()

        // AUTO-FIX: Limpiar cualquier sesión corrupta previa antes de intentar login nuevo
        localStorage.clear()
        sessionStorage.clear()

        setLoading(true)
        setError(null)
        setStatusMsg('Conectando con el servidor...')

        try {
            // Convertir ID a Email falso
            const syntheticEmail = `${email}@sistema.com`

            // Timeout desactivado para conexiones lentas
            // const timeoutPromise = new Promise((_, reject) =>
            //     setTimeout(() => reject(new Error('Tiempo de espera agotado. Revisa tu conexión.')), 5000)
            // )

            setStatusMsg('Verificando credenciales...')
            // const { error: signInError } = await Promise.race([
            //     signIn({ email: syntheticEmail, password }),
            //     timeoutPromise
            // ])
            const { error: signInError } = await signIn({ email: syntheticEmail, password })

            if (signInError) {
                setStatusMsg('')
                if (signInError.message.includes('Invalid login')) {
                    setError('ID o contraseña incorrectos')
                } else {
                    setError(signInError.message)
                }
            } else {
                setStatusMsg('✅ Acceso correcto. Redirigiendo...')
                // Force delay to show success message
                setTimeout(() => {
                    navigate('/')
                }, 500)
            }
        } catch (err) {
            setStatusMsg('')
            setError(`Error: ${err.message || 'Desconocido'}`)
            console.error(err)
        } finally {
            if (!statusMsg.includes('Redirigiendo')) {
                setLoading(false)
            }
        }
    }



    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
                <div className="flex justify-center mb-6">
                    <img src={logo} alt="Drummond Ltd." className="h-20 w-auto" />
                </div>
                <h2 className="text-2xl font-bold text-center text-[#231F20] mb-2">Bienvenido</h2>
                <p className="text-center text-gray-500 mb-8">Ingresa tus credenciales de Usuario</p>

                {statusMsg && (
                    <div className="p-3 mb-4 text-sm text-blue-700 bg-blue-100 rounded-lg font-bold text-center">
                        {statusMsg}
                    </div>
                )}

                {error && (
                    <div className="p-3 mb-4 text-sm text-white bg-[#E31937] rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-[#231F20] mb-2 uppercase">ID de Observador</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                required
                                value={email} // Reutilizamos state 'email' para el ID
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#E31937] focus:border-[#E31937] transition-colors"
                                placeholder="Ej. 12345678"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#231F20] mb-2">Contraseña</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#E31937] focus:border-[#E31937]"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#E31937] hover:bg-[#CA0926] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E31937] disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Ingresando...' : 'Acceder'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400">¿Eres nuevo? Pide a un administrador que te registre.</p>
                </div>
            </div>
        </div>
    )
}

