import { Check, X, Search } from 'lucide-react'
import { OBSERVATION_QUESTIONS } from '../../constants'
import { operatorService } from '../../services/operators'

export default function OperatorCard({ onSave, onCancel, initialData = null, observationType, selectedSite, selectedGroup }) {
    const [operatorName, setOperatorName] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [checklist, setChecklist] = useState({})
    const [comments, setComments] = useState('Sin comentarios')

    // Obtener preguntas dinámicas según el tipo
    const questions = OBSERVATION_QUESTIONS[observationType] || []

    const [operatorsList, setOperatorsList] = useState([])
    const [loadingOps, setLoadingOps] = useState(false)

    // Filtro reactivo para la búsqueda
    const filteredOperators = (operatorsList || []).filter(op =>
        op.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Fetch operators when site/group changes
    useEffect(() => {
        if (selectedSite && selectedGroup) {
            const loadOperators = async () => {
                setLoadingOps(true)
                try {
                    const data = await operatorService.getAll({ site: selectedSite, group: selectedGroup })
                    setOperatorsList(data)
                } catch (error) {
                    console.error('Error loading operators:', error)
                } finally {
                    setLoadingOps(false)
                }
            }
            loadOperators()
        } else {
            setOperatorsList([])
        }
    }, [selectedSite, selectedGroup])

    // Inicializar checklist cuando cambian las preguntas o el tipo
    useEffect(() => {
        if (initialData) {
            setOperatorName(initialData.operator_name)
            setChecklist(initialData.checklist || {})
            setComments(initialData.comments || '')
            setSearchTerm('')
        } else {
            // Reset y Default a "SI" para nuevas preguntas
            setOperatorName('')
            setSearchTerm('')
            const defaultChecklist = questions.reduce((acc, item) => ({ ...acc, [item.id]: 'Si' }), {})
            setChecklist(defaultChecklist)
            setComments('Sin comentarios')
        }
    }, [initialData, observationType])

    const handleCheckChange = (id, value) => {
        setChecklist(prev => ({ ...prev, [id]: value }))
    }

    const handleSave = () => {
        if (!operatorName.trim()) return alert('Ingrese el nombre del operador')

        onSave({
            operatorName,
            checklist,
            comments
        })

        if (!initialData) {
            setOperatorName('')
            setSearchTerm('')
            const defaultChecklist = questions.reduce((acc, item) => ({ ...acc, [item.id]: 'Si' }), {})
            setChecklist(defaultChecklist)
            setComments('Sin comentarios')
        }
    }

    if (!observationType) {
        return <div className="p-4 bg-gray-100 text-gray-500 rounded-lg text-center">Seleccione un Tipo de Observación para ver el formulario.</div>
    }

    return (
        <div className={`bg-white rounded-lg shadow border overflow-hidden ${initialData ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-blue-100'}`}>
            <div className={`px-6 py-4 border-b flex justify-between items-center ${initialData ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-100'}`}>
                <h3 className={`text-lg font-bold ${initialData ? 'text-yellow-800' : 'text-blue-900'}`}>
                    {initialData ? 'Editando Operador' : 'Nuevo Operador'}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wide ${initialData ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800'}`}>
                    {initialData ? 'Edición en Curso' : 'En Progreso'}
                </span>
            </div>

            <div className="p-6 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase">Operador</label>
                    <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                    <select
                        value={operatorName}
                        onChange={(e) => setOperatorName(e.target.value)}
                        disabled={loadingOps}
                        className="block w-full text-lg p-3 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                        <option value="">
                            {loadingOps ? 'Cargando operadores...' : '-- Seleccione Operador --'}
                        </option>
                        {filteredOperators.map((op) => (
                            <option key={op.id || op.name} value={op.name}>
                                {op.name}
                            </option>
                        ))}
                    </select>
                    {!loadingOps && operatorsList.length === 0 && (
                        <p className="text-red-500 text-xs mt-1">
                            No se encontraron operadores para {selectedSite} - Grupo {selectedGroup}
                        </p>
                    )}
                </div>

                {/* Checklist Dinámico */}
                <div className="space-y-4">
                    {questions.length === 0 ? (
                        <p className="text-gray-500 italic">No hay preguntas configuradas para este tipo.</p>
                    ) : (
                        questions.map((item) => (
                            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <label className="text-sm font-medium text-gray-800 sm:col-span-2">
                                    {item.label}
                                </label>

                                <div className="sm:col-span-1">
                                    <select
                                        value={checklist[item.id] || 'Si'}
                                        onChange={(e) => handleCheckChange(item.id, e.target.value)}
                                        className={`w-full p-2 rounded-md border text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none ${checklist[item.id] === 'No' ? 'bg-red-50 text-red-700 border-red-300' :
                                            checklist[item.id] === 'N/A' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                                                'bg-green-50 text-green-700 border-green-300'
                                            }`}
                                    >
                                        <option value="Si">Si</option>
                                        <option value="No">No</option>
                                        <option value="N/A">N/A</option>
                                    </select>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Comentarios */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase">Comentarios</label>
                    <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={2}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex items-center justify-end space-x-4">
                    {initialData && (
                        <button
                            onClick={onCancel}
                            className="text-gray-500 font-medium hover:text-gray-700 px-4 py-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancelar Edición
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        className={`flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white shadow-lg transform hover:scale-105 transition-all ${initialData ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        <Check className="w-5 h-5 mr-2" />
                        {initialData ? 'Actualizar Operador' : 'Guardar y Siguiente'}
                    </button>
                </div>
            </div>
        </div>
    )
}
