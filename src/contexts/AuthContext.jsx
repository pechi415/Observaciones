import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        // Función rápida: Mapear datos de sesión sin esperar DB
        const mapSessionToUser = (sessionUser) => {
            if (!sessionUser) return null
            return {
                ...sessionUser,
                // Priorizar metadata que viene e el token JWT (instantáneo)
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

                if (!error && data && mounted) {
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

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

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
        user,
        loading
    }), [user, loading])

    // Safety timeout: stop loading after 3 seconds if Supabase hangs
    useEffect(() => {
        const timer = setTimeout(() => {
            console.log('AuthContext: Safety timeout triggered (8s)')
            setLoading(false)
        }, 8000)
        return () => clearTimeout(timer)
    }, [])

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
                <div className="text-center w-full max-w-md">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium mb-4">Cargando sistema...</p>


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
