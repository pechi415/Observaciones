import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showReset, setShowReset] = useState(false)

    // Función rápida: Mapear datos de sesión sin esperar DB
    const mapSessionToUser = (sessionUser) => {
        if (!sessionUser) return null
        return {
            ...sessionUser,
            // Priorizar metadata que viene el token JWT (instantáneo)
            role: sessionUser.user_metadata?.role || 'observer', // Default a observer si no hay rol
            site: sessionUser.user_metadata?.site || '',
            group: sessionUser.user_metadata?.group || '',
            full_name: sessionUser.user_metadata?.full_name || sessionUser.email,
            must_change_password: sessionUser.user_metadata?.must_change_password ?? false
        }
    }

    // Fetch de fondo para actualizar datos frescos (no bloquea login)
    const fetchProfileInBackground = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (!error && data) {
                console.log('Background profile update:', data)

                // Check active status
                if (data.is_active === false) { // Explicitly check false
                    console.warn('User is inactive. Logging out.')
                    await supabase.auth.signOut()
                    setUser(null)
                    alert('Su cuenta ha sido desactivada. Contacte al administrador.')
                    return
                }

                setUser(prev => ({ ...prev, ...data }))
            }
        } catch (err) {
            console.warn('Background fetch error:', err)
        }
    }

    useEffect(() => {
        let mounted = true

        const initializeAuth = async () => {
            try {
                console.log('AuthContext: Initializing (Project ID: lmvgwmekjmbmrvhminjr)')
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) {
                    console.error('AuthContext: getSession error:', sessionError)
                }

                if (mounted) {
                    if (session?.user) {
                        console.log('Auth: Session found (Fast Path)')
                        // 1. Set user IMMEDIATELY from session
                        const fastUser = mapSessionToUser(session.user)
                        setUser(fastUser)

                        // 2. Refresh from DB in background
                        fetchProfileInBackground(session.user.id)
                    } else {
                        // Check explicit getUser as backup
                        const { data: userData } = await supabase.auth.getUser()
                        if (userData?.user) {
                            const fastUser = mapSessionToUser(userData.user)
                            setUser(fastUser)
                            fetchProfileInBackground(userData.user.id)
                        } else {
                            setUser(null)
                        }
                    }
                }
            } catch (error) {
                console.error('Auth init error:', error)
                if (mounted) setUser(null)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        initializeAuth()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log('Auth state change:', _event)
            if (!mounted) return

            if (session?.user) {
                // Instant update
                const fastUser = mapSessionToUser(session.user)
                setUser(fastUser)
                // Background update
                fetchProfileInBackground(session.user.id)
            } else {
                setUser(null)
            }
            setLoading(false)
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    const value = useMemo(() => ({
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        signOut: () => supabase.auth.signOut(),
        refreshProfile: () => user && fetchProfileInBackground(user.id),
        user,
        loading
    }), [user, loading])

    // Safety timeout: show reset option after 8 seconds if Supabase hangs
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                console.error('AuthContext: Safety timeout triggered (8s) - Showing Reset Option.')
                setShowReset(true)
            }
        }, 8000)
        return () => clearTimeout(timer)
    }, [loading])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="text-center w-full max-w-sm">
                    {!showReset ? (
                        <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-500 font-medium font-bold">Cargando sistema...</p>
                            <p className="text-gray-400 text-[10px] mt-2 uppercase tracking-widest font-black">Conectando con Supabase</p>
                        </>
                    ) : (
                        <div className="bg-white p-6 rounded-2xl shadow-2xl border border-red-50 animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-black text-gray-800 mb-2">Error de Conexión</h3>
                            <p className="text-sm text-gray-500 mb-6 leading-relaxed">El servidor está tardando demasiado en responder. Esto puede deberse a problemas de red o de la plataforma.</p>
                            <button
                                onClick={() => {
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    window.location.reload();
                                }}
                                className="w-full bg-[#E31937] text-white font-black py-4 rounded-xl hover:bg-[#CA0926] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                REINICIAR CONEXIÓN
                            </button>
                            <button
                                onClick={() => setLoading(false)}
                                className="w-full mt-4 text-xs text-gray-400 font-bold hover:text-gray-600 underline uppercase tracking-tighter"
                            >
                                Intentar continuar de todas formas
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
