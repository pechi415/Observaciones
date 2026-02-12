import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { PlusCircle, Search, Trash2, Edit2, AlertCircle, Database, ArrowLeft } from 'lucide-react'
import { operatorService } from '../services/operators'
import { SITES, GROUPS } from '../constants'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function AdminOperatorsPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [operators, setOperators] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filters, setFilters] = useState({ site: '', group: '' })
    const [showModal, setShowModal] = useState(false)
    const [editingOperator, setEditingOperator] = useState(null)
    const [formData, setFormData] = useState({ name: '', site: 'El Descanso', group: '1' })
    const [error, setError] = useState(null)
    const [migrationStatus, setMigrationStatus] = useState(null)

    // Cargar operadores
    const fetchOperators = async () => {
        setLoading(true)
        try {
            const data = await operatorService.getAll(filters) // Consider adding pagination if list grows too large
            setOperators(data)
        } catch (err) {
            console.error(err)
            setError('Error cargando operadores')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate('/') // Only admins allowed
        } else {
            fetchOperators()
        }
    }, [user, filters])

    // Filtrado en cliente por nombre (ya que getAll filtra por Sede/Grupo en servidor)
    const filteredList = operators.filter(op =>
        op.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSave = async (e) => {
        e.preventDefault()
        if (!formData.name) return

        try {
            setLoading(true)
            if (editingOperator) {
                await operatorService.update(editingOperator.id, formData)
            } else {
                await operatorService.create(formData)
            }
            setShowModal(false)
            setFormData({ name: '', site: 'El Descanso', group: '1' })
            setEditingOperator(null)
            fetchOperators() // Recargar lista
        } catch (err) {
            console.error(err)
            setError('Error guardando operador')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que desea eliminar a este operador?')) {
            try {
                await operatorService.delete(id)
                fetchOperators()
            } catch (err) {
                console.error(err)
                setError('Error eliminando operador')
            }
        }
    }

    const handleMigrate = async () => {
        if (!window.confirm('Esta acción migrará 793 operadores desde el archivo local a la Base de Datos. ¿Continuar?')) return

        try {
            setLoading(true)
            setMigrationStatus('Migrando...')
            const count = await operatorService.migrateFromLocal()
            setMigrationStatus(`Migración Exitosa: ${count} registros creados.`)
            fetchOperators()
        } catch (err) {
            console.error(err)
            setMigrationStatus('Error en migración: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const prepareEdit = (op) => {
        setEditingOperator(op)
        setFormData({ name: op.name, site: op.site, group: op.group })
        setShowModal(true)
    }

    const openCreateModal = () => {
        setEditingOperator(null)
        setFormData({ name: '', site: 'El Descanso', group: '1' })
        setShowModal(true)
    }

    return (
        <Layout>
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/')}
                            className="mr-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-800">Gestión de Operadores</h1>
                    </div>

                    <div className="flex gap-2">
                        {/* Botón de Migración (Solo visible si no hay operadores, o para admin avanzado) */}
                        {operators.length === 0 && (
                            <button
                                onClick={handleMigrate}
                                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                                title="Migrar desde archivo local"
                            >
                                <Database className="w-5 h-5 mr-2" />
                                Migrar Datos Iniciales
                            </button>
                        )}

                        <button
                            onClick={openCreateModal}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm"
                        >
                            <PlusCircle className="w-5 h-5 mr-2" />
                            Nuevo Operador
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}

                {migrationStatus && (
                    <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-md">
                        {migrationStatus}
                    </div>
                )}

                {/* Filtros */}
                <div className="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nombre</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Escribe para buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar Sede</label>
                        <select
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={filters.site}
                            onChange={(e) => setFilters(prev => ({ ...prev, site: e.target.value }))}
                        >
                            <option value="">Todas</option>
                            {SITES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar Grupo</label>
                        <select
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            value={filters.group}
                            onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                        >
                            <option value="">Todos</option>
                            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>

                {/* Tabla */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sede</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading && operators.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-4">Cargando...</td></tr>
                            ) : filteredList.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-8 text-gray-500">No se encontraron operadores.</td></tr>
                            ) : (
                                filteredList.map((op) => (
                                    <tr key={op.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{op.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{op.site}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Grupo {op.group}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => prepareEdit(op)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(op.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Modal Crear/Editar */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in-up">
                            <h2 className="text-xl font-bold mb-4">
                                {editingOperator ? 'Editar Operador' : 'Nuevo Operador'}
                            </h2>
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Sede</label>
                                        <select
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            value={formData.site}
                                            onChange={e => setFormData({ ...formData, site: e.target.value })}
                                        >
                                            {SITES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Grupo</label>
                                        <select
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            value={formData.group}
                                            onChange={e => setFormData({ ...formData, group: e.target.value })}
                                        >
                                            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                        disabled={loading}
                                    >
                                        {loading ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
