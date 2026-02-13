import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import SessionHeader from '../components/Observation/SessionHeader'
import OperatorCard from '../components/Observation/OperatorCard'
import { observationService } from '../services/observations'
import { PlusCircle, Save, CheckCircle2, AlertCircle, ArrowLeft, FileEdit } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ObservationPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { id } = useParams() // Get ID from URL for editing
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Estado para modal de completar perfil
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [profileData, setProfileData] = useState({ site: '', group: '' })

    // Helper para detectar turno
    const getInitialShift = () => {
        const now = new Date()
        const minutes = now.getHours() * 60 + now.getMinutes()
        const startDay = 5 * 60 + 50 // 05:50
        const endDay = 17 * 60 + 50  // 17:50

        return (minutes >= startDay && minutes < endDay) ? 'Diurno' : 'Nocturno'
    }

    // Estado de la Sesión (Restaurado)
    const [sessionData, setSessionData] = useState({
        date: new Date().toISOString().split('T')[0],
        shift: getInitialShift(),
        site: '',
        group: '',
        observationType: ''
    })

    const [sessionId, setSessionId] = useState(null) // ID de BD cuando se crea
    const [locked, setLocked] = useState(false) // Si la cabecera está confirmada
    const [operators, setOperators] = useState([])
    const [editingOperator, setEditingOperator] = useState(null) // Operador en edición

    // Cargar datos si estamos en modo edición (URL) o verificar si ya hay uno activo
    useEffect(() => {
        const checkExisting = async () => {
            if (id) {
                // MODO EDICIÓN
                setLoading(true)
                try {
                    const data = await observationService.getById(id)
                    if (data) {
                        setSessionId(data.id)
                        setSessionData({
                            date: data.date,
                            shift: data.shift,
                            site: data.site,
                            group: data.group_info,
                            observationType: data.observation_type
                        })
                        setOperators(data.observation_records || [])
                        setLocked(true)
                    }
                } catch (err) {
                    console.error('Error loading observation:', err)
                    setError('Error cargando la observación.')
                } finally {
                    setLoading(false)
                }
            } else if (user) {
                // MODO NUEVO - Verificar si ya tiene uno en curso
                try {
                    setLoading(true)
                    const activeObs = await observationService.getActiveObservation(user.id)
                    if (activeObs) {
                        // Ya tiene uno activo, redirigir
                        navigate(`/observation/${activeObs.id}`, { replace: true })
                    }
                } catch (err) {
                    console.error('Error checking active:', err)
                } finally {
                    setLoading(false)
                }
            }
        }
        checkExisting()
    }, [id, user, navigate])

    // Efecto para verificar si faltan datos en el perfil
    useEffect(() => {
        if (user && !id) { // Only set defaults if NOT editing
            if (!user.site_default || !user.group_default) {
                setShowProfileModal(true)
            } else {
                setSessionData(prev => ({
                    ...prev,
                    site: prev.site || user.site_default || '',
                    group: prev.group || user.group_default || ''
                }))
            }
        }
    }, [user, id])

    const handleSaveProfile = async () => {
        if (!profileData.site || !profileData.group) {
            setError('Por favor complete Sede y Grupo para continuar.')
            return
        }

        try {
            setLoading(true)
            const { error } = await supabase
                .from('profiles')
                .update({
                    site_default: profileData.site,
                    group_default: profileData.group
                })
                .eq('id', user.id)

            if (error) throw error

            // Forzar recarga de página para que AuthContext tome los nuevos datos
            window.location.reload()

        } catch (err) {
            console.error(err)
            setError('Error guardando perfil: ' + err.message)
            setLoading(false)
        }
    }


    // Paso 1: Confirmar Cabecera e Iniciar en BD
    const handleLockSession = async (shouldLock) => {
        if (shouldLock) {
            // Validaciones básicas
            if (!sessionData.site || !sessionData.shift || !sessionData.group || !sessionData.observationType) {
                setError('Por favor complete todos los campos de la sesión (Sede, Turno, Grupo, Tipo).')
                return
            }

            try {
                setLoading(true)
                setError(null)
                // Crear la cabecera en Supabase
                const observation = await observationService.createHeader(sessionData)
                setSessionId(observation.id)
                setLocked(true)
                console.log('Sesión iniciada:', observation.id)
            } catch (err) {
                console.error(err)
                setError('Error al iniciar la sesión en la base de datos: ' + err.message)
            } finally {
                setLoading(false)
            }
        } else {
            // Desbloquear (Solo si no hay operadores guardados aún, o advertir)
            if (operators.length > 0) {
                if (!window.confirm('Ya hay operadores guardados. Si edita la cabecera, seguirá aplicando a esta sesión. ¿Desea continuar?')) {
                    return
                }
            }
            setLocked(false)
        }
    }

    // Paso 2: Guardar Operador (Crear o Actualizar)
    const handleSaveOperator = async (operatorData) => {
        try {
            setLoading(true)
            setError(null)

            if (editingOperator) {
                // ACTUALIZAR
                const updatedRecord = await observationService.updateRecord(editingOperator.id, operatorData)

                // Actualizar en la lista local
                setOperators(prev => prev.map(op => op.id === editingOperator.id ? updatedRecord : op))
                setEditingOperator(null) // Salir de modo edición
            } else {
                // CREAR
                const record = await observationService.addRecord(sessionId, operatorData)
                setOperators(prev => [record, ...prev])
            }

        } catch (err) {
            console.error(err)
            setError('Error al guardar el operador: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleEditOperator = (operator) => {
        setEditingOperator(operator)
        // Scroll to top or form could be nice, but not strictly necessary if layout is side-by-side
    }

    const handleCancelEdit = () => {
        setEditingOperator(null)
    }



    const handleFinish = async () => {
        try {
            setLoading(true)
            await supabase
                .from('observations')
                .update({ status: 'completed' })
                .eq('id', sessionId)

            navigate('/')
        } catch (err) {
            console.error('Error finalizing:', err)
            setError('Error al finalizar sesión')
            setLoading(false)
        }
    }

    // ... (handleFinish remains same)

    return (
        <Layout>
            <div className="max-w-4xl mx-auto px-4 pb-20">
                {/* ... Header and Title ... */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/')}
                            className="mr-2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                            title="Volver al Dashboard"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Nueva Observación</h1>
                    </div>
                    {operators.length > 0 && (
                        <button
                            onClick={handleFinish}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm"
                        >
                            <Save className="w-5 h-5 mr-2" />
                            Finalizar Sesión ({operators.length})
                        </button>
                    )}
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}

                <SessionHeader
                    sessionData={sessionData}
                    setSessionData={setSessionData}
                    locked={locked}
                    setLocked={handleLockSession}
                />

                {/* 2. Área de Trabajo (Solo visible si está bloqueado/iniciado) */}
                {locked && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">

                        {/* Columna Izquierda: Formulario */}
                        <div className="lg:col-span-2">
                            <OperatorCard
                                onSave={handleSaveOperator}
                                onCancel={handleCancelEdit}
                                initialData={editingOperator}
                                observationType={sessionData.observationType}
                                selectedSite={sessionData.site}
                                selectedGroup={sessionData.group}
                            />
                        </div>

                        {/* Columna Derecha: Historial de la Sesión */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow p-4 border border-gray-200 sticky top-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                                    <span className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2" /> Operadores ({operators.length})</span>
                                    {editingOperator && <span className="text-xs text-yellow-600 animate-pulse">Editando...</span>}
                                </h3>

                                {operators.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-sm italic">
                                        Aquí aparecerán los operadores que vayas agregando.
                                    </div>
                                ) : (
                                    <ul className="space-y-3 max-h-[500px] overflow-y-auto">
                                        {operators.map((op) => (
                                            <li
                                                key={op.id}
                                                className={`p-3 rounded-md border-l-4 flex justify-between items-start transition-colors cursor-pointer hover:bg-blue-50 group ${editingOperator?.id === op.id ? 'bg-yellow-50 border-yellow-500 ring-1 ring-yellow-200' : 'bg-gray-50 border-green-500'
                                                    }`}
                                                onClick={() => handleEditOperator(op)}
                                            >
                                                <div>
                                                    <p className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{op.operator_name}</p>
                                                    <p className="text-xs text-gray-500 truncate max-w-[150px]">{op.comments}</p>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-mono text-gray-400 mb-1">
                                                        {new Date(op.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <FileEdit className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </Layout>
    )
}
