import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Link } from 'react-router-dom'
import {
    Users,
    UserPlus,
    Pencil,
    Trash2,
    Search,
    Shield,
    Eye,
    User,
    LayoutDashboard,
    ArrowLeft,
    Power,
    Check,
    Star
} from 'lucide-react'

export default function AdminUsersListPage() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name')

            if (error) throw error
            setUsers(data || [])
        } catch (error) {
            console.error('Error fetching users:', error)
            alert('Error al cargar usuarios')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE al usuario "${name}"? \n\n⚠️ Esta acción eliminará todos sus datos y NO se puede deshacer.`)) {
            return
        }

        try {
            // Usar RPC para eliminar usuario de Auth y Profiles
            const { error } = await supabase.rpc('delete_user_by_id', { user_id: id })

            if (error) throw error

            setUsers(users.filter(user => user.id !== id))
            alert('Usuario eliminado correctamente.')
        } catch (error) {
            console.error('Error deleting user:', error)
            alert('Error al eliminar usuario: ' + (error.message || 'Error desconocido'))
        }
    }

    const handleToggleStatus = async (id, name, currentStatus) => {
        const action = currentStatus === false ? 'activar' : 'desactivar' // Default to deactivate if undefined (true)
        const confirmMsg = currentStatus === false
            ? `¿Estás seguro de reactivar el acceso para "${name}"?`
            : `¿Estás seguro de desactivar a "${name}"? \n\n⚠️ El usuario no podrá iniciar sesión, pero sus datos se conservarán.`

        if (!window.confirm(confirmMsg)) return

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: currentStatus === false })
                .eq('id', id)

            if (error) throw error

            setUsers(users.map(user =>
                user.id === id ? { ...user, is_active: currentStatus === false } : user
            ))

            // alert(`Usuario ${action === 'activar' ? 'reactivado' : 'desactivado'} correctamente.`)
        } catch (error) {
            console.error('Error updating user status:', error)
            alert('Error al actualizar estado: ' + error.message)
        }
    }

    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.observer_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getRoleIcon = (role) => {
        switch (role) {
            case 'admin': return <Shield className="w-5 h-5 text-purple-600" />
            case 'lider': return <Star className="w-5 h-5 text-yellow-600" />
            case 'editor': return <Pencil className="w-5 h-5 text-blue-600" />
            case 'reader': return <Eye className="w-5 h-5 text-gray-600" />
            default: return <User className="w-5 h-5 text-green-600" />
        }
    }

    const getRoleName = (role) => {
        const roles = {
            admin: 'Administrador',
            lider: 'Líder',
            observer: 'Observador',
            reader: 'Lector'
        }
        return roles[role] || role || 'Usuario'
    }

    return (
        <Layout>
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">
                                <ArrowLeft className="w-6 h-6" />
                            </Link>
                            <h1 className="text-2xl font-bold text-[#231F20] flex items-center">
                                <Users className="w-8 h-8 mr-3 text-[#E31937]" />
                                Gestión de Usuarios
                            </h1>
                        </div>
                        <p className="text-gray-500 mt-1 ml-10">Administra los accesos y roles del sistema</p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            to="/admin/users/new"
                            className="bg-[#E31937] text-white px-5 py-2.5 rounded-lg font-bold hover:bg-[#CA0926] transition flex items-center shadow-md active:scale-95"
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            Nuevo Usuario
                        </Link>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E31937] focus:border-[#E31937] sm:text-sm shadow-sm"
                        placeholder="Buscar por nombre, ID o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Users List */}
                <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-100">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E31937] mx-auto mb-4"></div>
                            Cargando usuarios...
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No se encontraron usuarios.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Usuario
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rol
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Sede / Grupo
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`flex items-center ${user.is_active === false ? 'opacity-50' : ''}`}>
                                                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg ${user.is_active === false ? 'bg-gray-200 text-gray-500' : 'bg-red-50 text-[#E31937]'
                                                        }`}>
                                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.full_name}
                                                            {user.is_active === false && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactivo</span>}
                                                        </div>
                                                        <div className="text-sm text-gray-500">{user.email} (ID: {user.observer_id})</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center text-sm text-gray-900 capitalize">
                                                    {getRoleIcon(user.role)}
                                                    <span className="ml-2">{getRoleName(user.role)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{user.site_default || '-'}</div>
                                                <div className="text-xs text-gray-500">{user.group_default || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                                <Link
                                                    to={`/admin/users/edit/${user.id}`}
                                                    className="text-[#231F20] hover:text-black inline-flex items-center bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4 mr-1.5" />
                                                    Editar
                                                </Link>

                                                {user.is_active === false ? (
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, user.full_name, user.is_active)}
                                                        className="text-green-600 hover:text-green-800 inline-flex items-center bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors"
                                                    >
                                                        <Check className="w-4 h-4 mr-1.5" />
                                                        Reactivar
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleToggleStatus(user.id, user.full_name, user.is_active)}
                                                        className="text-orange-600 hover:text-orange-800 inline-flex items-center bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-md transition-colors"
                                                        title="Desactivar usuario"
                                                    >
                                                        <Power className="w-4 h-4 mr-1.5" />
                                                        Desactivar
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => handleDelete(user.id, user.full_name)}
                                                    className="text-red-600 hover:text-red-800 inline-flex items-center bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
