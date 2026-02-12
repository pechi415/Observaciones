import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Key, Save, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ChangePasswordPage() {
    const { user } = useAuth()
    const [passwords, setPasswords] = useState({
        newPassword: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState(null)
    const [error, setError] = useState(null)

    const handleChange = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMsg(null)
        setError(null)

        if (passwords.newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }

        if (passwords.newPassword !== passwords.confirmPassword) {
            setError('Las contraseñas no coinciden')
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.newPassword
            })

            if (error) throw error

            // Update profile MUST_CHANGE_PASSWORD to false
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ must_change_password: false })
                .eq('id', user.id)

            if (profileError) console.error('Error clearing password change flag:', profileError)

            setMsg('Contraseña actualizada con éxito.')
            setPasswords({ newPassword: '', confirmPassword: '' })

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Layout>
            <div className="max-w-xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="bg-[#231F20] px-6 py-4 flex items-center justify-between border-b-4 border-[#E31937]">
                        <div className="flex items-center">
                            <Key className="text-white w-6 h-6 mr-3" />
                            <h1 className="text-xl font-bold text-white">Cambiar Mi Contraseña</h1>
                        </div>
                        <Link to="/" className="text-gray-300 hover:text-white flex items-center text-sm font-medium transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Volver
                        </Link>
                    </div>

                    <div className="p-8">
                        {msg && (
                            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center">
                                <CheckCircle className="w-5 h-5 mr-2" />
                                {msg}
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center">
                                <AlertCircle className="w-5 h-5 mr-2" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div>
                                <label className="block text-sm font-bold text-[#231F20] mb-1">Nueva Contraseña</label>
                                <input
                                    name="newPassword"
                                    type="password"
                                    value={passwords.newPassword}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-[#E31937]"
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-[#231F20] mb-1">Confirmar Nueva Contraseña</label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    value={passwords.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-[#E31937]"
                                    placeholder="Repite la contraseña"
                                />
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-[#E31937] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#CA0926] transition flex items-center shadow-lg transform active:scale-95"
                                >
                                    {loading ? 'Guardando...' : (
                                        <>
                                            <Save className="w-5 h-5 mr-2" />
                                            Actualizar Contraseña
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
