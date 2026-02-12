import { useState } from 'react'
import { Calendar, MapPin, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { SITES, GROUPS } from '../../constants'

export default function SessionHeader({ sessionData, setSessionData, locked, setLocked }) {
    const { user } = useAuth()
    const [isExpanded, setIsExpanded] = useState(true)

    const handleChange = (e) => {
        const { name, value } = e.target
        setSessionData(prev => ({ ...prev, [name]: value }))
    }

    const toggleExpand = () => setIsExpanded(!isExpanded)

    return (
        <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                    Datos de la Sesión
                </h3>
                <button onClick={toggleExpand} className="text-gray-500 hover:text-gray-700">
                    {isExpanded ? <ChevronUp /> : <ChevronDown />}
                </button>
            </div>

            {isExpanded && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Fecha */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            name="date"
                            value={sessionData.date}
                            onChange={handleChange}
                            disabled={locked}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        />
                    </div>

                    {/* Turno */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                        <select
                            name="shift"
                            value={sessionData.shift}
                            onChange={handleChange}
                            disabled={locked}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                            <option value="">Seleccionar...</option>
                            <option value="Diurno">Diurno</option>
                            <option value="Nocturno">Nocturno</option>
                        </select>
                    </div>

                    {/* Sede */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sede</label>
                        <select
                            name="site"
                            value={sessionData.site}
                            onChange={handleChange}
                            disabled={locked || (user?.role !== 'admin' && user?.role !== 'lider')}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                            <option value="">Seleccionar Sede...</option>
                            {SITES.map(site => (
                                <option key={site} value={site}>{site}</option>
                            ))}
                        </select>
                    </div>

                    {/* Grupo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                        <select
                            name="group"
                            value={sessionData.group}
                            onChange={handleChange}
                            disabled={locked || (user?.role !== 'admin' && user?.role !== 'lider')}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                        >
                            <option value="">Seleccionar Grupo...</option>
                            {GROUPS.map(group => (
                                <option key={group} value={group}>Grupo {group}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tipo de Observacion */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Observación</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {['Vías', 'Botaderos', 'Cargue', 'Bahías', 'Isla'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => !locked && setSessionData(prev => ({ ...prev, observationType: type }))}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${sessionData.observationType === type
                                        ? 'bg-red-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Botón de Bloqueo/Desbloqueo */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                {!locked ? (
                    <button
                        onClick={() => setLocked(true)}
                        className="text-sm text-blue-600 font-medium hover:text-blue-800"
                    >
                        Confirmar e Iniciar Ronda de Operadores &rarr;
                    </button>
                ) : (
                    <button
                        onClick={() => setLocked(false)}
                        className="text-sm text-gray-500 font-medium hover:text-gray-700"
                    >
                        Editar Cabecera
                    </button>
                )}
            </div>
        </div>
    )
}
