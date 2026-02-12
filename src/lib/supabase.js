import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storageKey: 'sb-operator-auth-token', // Nombre específico para evitar conflictos
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
})
