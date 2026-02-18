import Layout from '../components/Layout'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import KPIDetailModal from '../components/KPIDetailModal'
import {
    Chart as ChartJS, // REQUIRED FIX
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement, // NEW
    PointElement, // NEW
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler // NEW
} from 'chart.js'
import * as XLSX from 'xlsx'
import { Shield, AlertTriangle, CheckCircle, TrendingUp, Users, PlusCircle, FileEdit, Trash2, Filter, Search, X, Calendar, Download, List, BarChart2, Briefcase, UserCheck, AlertOctagon, Sun } from 'lucide-react'
import { OBSERVATION_QUESTIONS, SITES, GROUPS } from '../constants'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement, // NEW
    PointElement, // NEW
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler // NEW
)



import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { observationService } from '../services/observations'
import MultiSelectFilter from '../components/MultiSelectFilter'
import { ColumnFilter } from '../components/ColumnFilter'

export default function DashboardPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [recentObservations, setRecentObservations] = useState([])
    const [loadingObs, setLoadingObs] = useState(true)

    // Stats State
    const [stats, setStats] = useState({
        total: 0,
        safe: 0,
        risk: 0,
        totalOperators: 0,
        totalDeviations: 0,
        activeObservers: 0,
        observationsList: [],
        deviationList: [],
        operatorList: [],
        chartData: { labels: [], safeData: [], riskData: [] }
    })
    const [loadingStats, setLoadingStats] = useState(true)
    const [exporting, setExporting] = useState(false)

    // Modal State
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        data: [],
        columns: []
    })

    // Table Column Filters State
    const [tableColumnFilters, setTableColumnFilters] = useState({})

    // Export Function
    const handleExport = async () => {
        try {
            setExporting(true)
            const observations = await observationService.getAllForExport()

            if (!observations || observations.length === 0) {
                alert('No hay datos para exportar')
                return
            }

            // 1. Obtener todas las preguntas únicas para las cabeceras
            const allQuestionsMap = new Map() // ID -> Label
            Object.values(OBSERVATION_QUESTIONS).flat().forEach(q => {
                allQuestionsMap.set(q.id, q.label)
            })

            // Aplanar datos: Cada fila es un registro de observación (un operador)
            const flatData = []

            observations.forEach(obs => {
                const baseInfo = {
                    'ID Observación': obs.id,
                    'Fecha': new Date(obs.date).toLocaleDateString(),
                    'Hora Creación': new Date(obs.created_at).toLocaleTimeString(),
                    'Turno': obs.shift,
                    'Observador': obs.profiles?.full_name || 'Desconocido',
                    'Sede': obs.site,
                    'Grupo': obs.group_info,
                    'Tipo Observación': obs.observation_type,
                }

                if (!obs.observation_records || obs.observation_records.length === 0) {
                    flatData.push({
                        ...baseInfo,
                        'Operador': 'SIN REGISTROS',
                        'Comentarios': '',
                    })
                } else {
                    obs.observation_records.forEach(record => {
                        const row = {
                            ...baseInfo,
                            'Operador': record.operator_name,
                        }

                        // Mapear respuestas del checklist a columnas tras el Operador
                        const checklist = record.checklist || {}

                        // Estrategia: Iterar sobre el mapa global de preguntas y buscar respuesta
                        allQuestionsMap.forEach((label, id) => {
                            if (checklist.hasOwnProperty(id)) {
                                row[label] = checklist[id]
                            } else {
                                row[label] = ''
                            }
                        })

                        // Añadir Comentarios al final de todo
                        row['Comentarios'] = record.comments

                        flatData.push(row)
                    })
                }
            })

            // Crear Worksheet y Workbook
            const worksheet = XLSX.utils.json_to_sheet(flatData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Observaciones")

            // Generar archivo
            XLSX.writeFile(workbook, `Observaciones_${new Date().toISOString().split('T')[0]}.xlsx`)

        } catch (error) {
            console.error('Error exportando:', error)
            alert('Error al exportar datos')
        } finally {
            setExporting(false)
        }
    }

    const scrollToTable = () => {
        const tableElement = document.querySelector('table');
        if (tableElement) {
            tableElement.scrollIntoView({ behavior: 'smooth' });
        }
    }

    const handleNewObservation = async () => {
        if (!user) return

        try {
            setLoadingObs(true)
            const activeObs = await observationService.getActiveObservation(user.id)

            if (activeObs) {
                if (window.confirm(`Ya tienes una observación en curso iniciada el ${new Date(activeObs.date).toLocaleDateString()}. \n\nDebes finalizarla o eliminarla para poder iniciar una nueva. \n\n¿Deseas ir a la observación abierta ahora?`)) {
                    navigate(`/observation/${activeObs.id}`)
                }
            } else {
                navigate('/observation/new')
            }
        } catch (error) {
            console.error('Error checking active observation:', error)
            alert('Error al verificar observaciones activas')
        } finally {
            setLoadingObs(false)
        }
    }

    const handleDelete = async (e, id) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (e && e.preventDefault) e.preventDefault();

        if (!window.confirm('¿Estás seguro de que quieres eliminar esta observación? Esta acción no se puede deshacer.')) {
            return
        }

        try {
            await observationService.delete(id)
            setRecentObservations(prev => prev.filter(obs => obs.id !== id))
            // Refresh stats after delete
            loadStats()
        } catch (error) {
            console.error('Error deleting observation:', error)
            alert('Error al eliminar la observación: ' + (error.message || 'Error desconocido'))
            // If delete failed, we might want to refresh the list just in case
            const fetchObservations = async () => {
                try {
                    const { data } = await supabase
                        .from('observations')
                        .select('*, profiles(full_name), observation_records(id)')
                        .order('created_at', { ascending: false })
                        .limit(10)
                    if (data) setRecentObservations(data)
                } catch (err) { console.error(err) }
            }
            fetchObservations()
        }
    }

    const loadStats = async (currentFilters = filters) => {
        try {
            setLoadingStats(true)
            const data = await observationService.getDashboardStats(currentFilters)
            setStats(data)
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    // Filter State
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        shift: [], // Array
        site: [], // Array - NEW
        group: [], // Array
        type: [], // Array - Fix for undefined
        supervisor: [] // Array - Fix for undefined
    })

    // Dynamic Filter Options State
    const [filterOptions, setFilterOptions] = useState({
        shifts: [],
        types: [],
        groups: [],
        supervisors: []
    })

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                // Fetch unique values from observations
                const { data, error } = await supabase
                    .from('observations')
                    .select('shift, observation_type, group_info, supervisor_id')

                if (error) throw error

                if (data) {
                    const shifts = [...new Set(data.map(item => item.shift).filter(Boolean))].sort()
                    const types = [...new Set(data.map(item => item.observation_type).filter(Boolean))].sort()
                    const groups = [...new Set(data.map(item => item.group_info).filter(Boolean))].sort()
                    const supervisorIds = [...new Set(data.map(item => item.supervisor_id).filter(Boolean))]

                    // Fetch supervisor names
                    let supervisors = []
                    if (supervisorIds.length > 0) {
                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('id, full_name')
                            .in('id', supervisorIds)

                        if (profiles) {
                            supervisors = profiles.map(p => p.full_name).sort()
                        }
                    }

                    setFilterOptions({ shifts, types, groups, supervisors, sites: SITES })
                }
            } catch (error) {
                console.error('Error fetching filter options:', error)
            }
        }

        fetchFilterOptions()
    }, [])

    const handleFilterChange = (field, value) => {
        const newFilters = { ...filters, [field]: value }
        setFilters(newFilters)
        loadStats(newFilters) // Reload stats when filters change
    }

    const clearFilters = () => {
        const initialFilters = { startDate: '', endDate: '', shift: [], site: [], group: [], type: [], supervisor: [] }
        setFilters(initialFilters)
        loadStats(initialFilters)
    }

    useEffect(() => {
        const fetchObservations = async () => {
            setLoadingObs(true)
            try {
                // Fetch recent observations without global filters (Independence)
                const { data, error } = await supabase
                    .from('observations')
                    .select('*, profiles(full_name), observation_records(id)')
                    .order('created_at', { ascending: false })
                    .limit(100)

                if (error) throw error
                setRecentObservations(data || [])
            } catch (error) {
                console.error('Error fetching observations:', error)
            } finally {
                setLoadingObs(false)
            }
        }

        if (user) {
            fetchObservations()
        }

        // Set up subscription for real-time updates
        const subscription = supabase
            .channel('public:observations_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'observations' }, fetchObservations)
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [user]) // Independent of global filters

    // Client-side filtering for the table
    const filteredObservations = useMemo(() => {
        return recentObservations.filter(item => {
            return Object.entries(tableColumnFilters).every(([accessor, filterValue]) => {
                if (!filterValue) return true

                // DATE RANGE FILTER
                if (typeof filterValue === 'object' && !Array.isArray(filterValue) && (filterValue.start !== undefined || filterValue.end !== undefined)) {
                    const itemDateStr = item.date ? String(item.date).split('T')[0] : String(item.created_at).split('T')[0]
                    const { start, end } = filterValue
                    if (start && end) return itemDateStr >= start && itemDateStr <= end
                    if (start) return itemDateStr >= start
                    if (end) return itemDateStr <= end
                    return true
                }

                // STANDARD ARRAY FILTER
                if (Array.isArray(filterValue)) {
                    if (filterValue.length === 0) return false
                    const itemValue = accessor === 'full_name'
                        ? (item.profiles?.full_name || 'Desconocido')
                        : accessor === 'num_ops'
                            ? String(item.observation_records?.length || 0)
                            : String(item[accessor] || '')
                    return filterValue.includes(itemValue)
                }

                return true
            })
        })
    }, [recentObservations, tableColumnFilters])


    // Load stats only once or when user changes
    useEffect(() => {
        if (user) loadStats()
    }, [user])

    // ... (token check)

    // Chart Options Helper: Draw Values on Bars
    const dataLabelsPlugin = {
        id: 'dataLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart
            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i)
                if (!meta.hidden) {
                    meta.data.forEach((element, index) => {
                        const data = dataset.data[index]
                        if (data !== 0 && data !== null) { // Only show non-zero
                            ctx.fillStyle = '#6B7280' // Gray-500
                            ctx.font = 'bold 11px sans-serif'
                            ctx.textAlign = 'center'
                            ctx.textBaseline = 'bottom'
                            const position = element.tooltipPosition()
                            ctx.fillText(data, position.x, position.y - 4)
                        }
                    })
                }
            })
        }
    }

    // Chart 1: Groups (Operators vs Deviations) - Unfiltered by Group
    const groupsChartData = {
        labels: stats.groupsChart?.labels || [],
        datasets: [
            {
                label: 'Operadores',
                data: stats.groupsChart?.operators || [],
                backgroundColor: '#93C5FD', // Light Blue (Blue-300)
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.8
            },
            {
                label: 'Desviaciones',
                data: stats.groupsChart?.deviations || [],
                backgroundColor: '#FCA5A5', // Light Red (Red-300)
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.8
            }
        ]
    }

    // Chart 2: Types (Operators vs Deviations)
    const typesChartData = {
        labels: stats.typesChart?.labels || [],
        datasets: [
            {
                label: 'Operadores',
                data: stats.typesChart?.operators || [],
                backgroundColor: '#93C5FD', // Light Blue
                borderRadius: 4
            },
            {
                label: 'Desviaciones',
                data: stats.typesChart?.deviations || [],
                backgroundColor: '#FCA5A5', // Light Red
                borderRadius: 4
            }
        ]
    }

    // Chart 3: Findings (Positive vs Negative)
    const totalFindings = (stats.findingsChart?.positive || 0) + (stats.findingsChart?.negative || 0)
    const positivePct = totalFindings ? Math.round(((stats.findingsChart?.positive || 0) / totalFindings) * 100) : 0
    const negativePct = totalFindings ? Math.round(((stats.findingsChart?.negative || 0) / totalFindings) * 100) : 0

    const findingsChartData = {
        labels: ['Positivos (Si)', 'Negativos (No)'],
        datasets: [
            {
                data: [stats.findingsChart?.positive || 0, stats.findingsChart?.negative || 0],
                backgroundColor: [
                    '#86EFAC', // Light Green (Green-300)
                    '#FCA5A5', // Light Red (Red-300)
                ],
                borderWidth: 0,
                hoverOffset: 10
            }
        ]
    }

    // New Charts Data (Phase 4.12)
    const observersRaw = stats.observersChart || { labels: [], observations: [], uniqueOperators: [], deviations: [], shifts: { morning: [], afternoon: [], night: [] } }

    // Chart 4: Obs vs Observers
    const obsVsObserversData = {
        labels: observersRaw.labels,
        datasets: [{
            label: 'Observaciones',
            data: observersRaw.observations,
            backgroundColor: '#A78BFA', // Violet-400
            borderRadius: 4
        }]
    }

    // Chart 5: Operators vs Observers
    const opsVsObserversData = {
        labels: observersRaw.labels,
        datasets: [{
            label: 'Operadores',
            data: observersRaw.uniqueOperators,
            backgroundColor: '#22D3EE', // Cyan-400
            borderRadius: 4
        }]
    }

    // Chart 6: Deviations vs Observers
    const devVsObserversData = {
        labels: observersRaw.labels,
        datasets: [{
            label: 'Desviaciones',
            data: observersRaw.deviations,
            backgroundColor: '#818CF8', // Indigo-400
            borderRadius: 4
        }]
    }

    // Chart 7: Shifts vs Observers
    const shiftsVsObserversData = {
        labels: observersRaw.labels,
        datasets: [
            { label: 'Diurno', data: observersRaw.shifts.morning, backgroundColor: '#EAB308', borderRadius: 4 }, // Yellow-500
            { label: 'Nocturno', data: observersRaw.shifts.night, backgroundColor: '#1E3A8A', borderRadius: 4 } // Blue-900
        ]
    }

    // Chart 8: Items vs Groups
    const itemsRaw = stats.itemsChart || { labels: [], groups: { g1: [], g2: [], g3: [] } }
    const itemsVsGroupsData = {
        labels: itemsRaw.labels,
        datasets: [
            { label: 'Grupo 1', data: itemsRaw.groups.g1, backgroundColor: '#93C5FD', borderRadius: 4 }, // Blue-300
            { label: 'Grupo 2', data: itemsRaw.groups.g2, backgroundColor: '#FCA5A5', borderRadius: 4 }, // Red-300
            { label: 'Grupo 3', data: itemsRaw.groups.g3, backgroundColor: '#86EFAC', borderRadius: 4 }  // Green-300
        ]
    }

    // Interactive Cards Logic
    const openModal = (type) => {
        let title = ''
        let data = []
        let columns = []

        switch (type) {
            case 'operators':
                title = 'Operadores Observados'
                data = stats.operatorList
                columns = [
                    {
                        header: 'Sede',
                        accessor: 'site',
                        render: (row) => (
                            <span className="text-xs font-semibold px-2 py-1 bg-gray-50 text-gray-600 rounded border border-gray-100 uppercase tracking-tight">
                                {row.site}
                            </span>
                        )
                    },
                    { header: 'Grupo', accessor: 'group' },
                    { header: 'Operador', accessor: 'operator' },
                    {
                        header: 'Cantidad',
                        accessor: 'count',
                        render: (row) => <span className="font-black text-gray-800">{row.count}</span>
                    }
                ]
                break;
            case 'deviations':
                title = 'Desviaciones Detectadas'
                data = stats.deviationList
                columns = [
                    {
                        header: 'Fecha',
                        accessor: 'date',
                        render: (row) => {
                            if (!row.date) return 'N/A'
                            const parts = String(row.date).split('T')[0].split('-')
                            return <span className="font-bold text-gray-700">{`${parts[2]}/${parts[1]}/${parts[0]}`}</span>
                        }
                    },
                    {
                        header: 'Sede',
                        accessor: 'site',
                        render: (row) => (
                            <span className="text-xs font-semibold px-2 py-1 bg-gray-50 text-gray-600 rounded">
                                {row.site}
                            </span>
                        )
                    },
                    { header: 'Grupo', accessor: 'group' },
                    { header: 'Observador', accessor: 'observer' },
                    { header: 'Operador', accessor: 'operator' },
                    {
                        header: 'Item Fallido',
                        accessor: 'item',
                        render: (row) => <span className="text-red-600 font-medium">{row.item}</span>
                    },
                    {
                        header: 'Comentarios',
                        accessor: 'comments',
                        render: (row) => <span className="text-xs text-gray-500 italic max-w-xs truncate block">{row.comments || '-'}</span>
                    }
                ]
                break;
            case 'total':
                title = 'Total Observaciones'
                data = stats.observationsList
                columns = [
                    {
                        header: 'Fecha',
                        accessor: 'date',
                        render: (row) => {
                            const dateVal = row.date || row.created_at
                            const parts = String(dateVal).split('T')[0].split('-')
                            return <span className="font-bold text-gray-800">{`${parts[2]}/${parts[1]}/${parts[0]}`}</span>
                        }
                    },
                    {
                        header: 'Turno',
                        accessor: 'shift',
                        render: (row) => (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-700 border border-gray-200 uppercase">
                                {row.shift || '-'}
                            </span>
                        )
                    },
                    { header: 'Sede', accessor: 'site' },
                    { header: 'Grupo', accessor: 'group_info' },
                    { header: 'Observador', accessor: 'profiles', render: (row) => row.profiles?.full_name || 'N/A' },
                    {
                        header: 'Estado',
                        accessor: 'status',
                        render: (row) => (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${row.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                                }`}>
                                {row.status === 'completed' ? 'Completada' : 'En Curso'}
                            </span>
                        )
                    },
                    {
                        header: 'Acciones',
                        accessor: 'actions',
                        render: (row) => (
                            <div className="flex items-center gap-2">
                                {row.status !== 'completed' && ['admin', 'observer', 'lider'].includes(user?.role) && (
                                    <Link
                                        to={`/observation/${row.id}`}
                                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                        title="Editar"
                                    >
                                        <FileEdit className="w-3.5 h-3.5" />
                                    </Link>
                                )}
                                {(user?.role === 'admin' || user?.role === 'lider') && (
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(e, row.id)}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )
                    }
                ]
                break;
            default:
                return;
        }

        setModalConfig({ isOpen: true, title, data, columns })
    }

    const cards = [
        {
            title: 'Operadores Observados',
            value: stats.totalOperators,
            icon: Users,
            color: 'blue',
            onClick: () => openModal('operators'),
            gradient: 'from-blue-500 to-cyan-400'
        },
        {
            title: 'Desviaciones',
            value: stats.totalDeviations,
            icon: AlertTriangle,
            color: 'red',
            onClick: () => openModal('deviations'),
            gradient: 'from-red-500 to-orange-400'
        },
        {
            title: 'Total Observaciones',
            value: stats.total,
            icon: Shield,
            color: 'emerald',
            // onClick removed as requested
            gradient: 'from-emerald-500 to-green-400'
        }
    ]

    return (
        <Layout user={user}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
                        <p className="text-gray-500">Resumen general de operaciones</p>
                    </div>

                    {/* Admin Actions */}
                    <div className="flex gap-3">
                        {(user?.role === 'admin' || user?.role === 'observer' || user?.role === 'lider') && (
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="w-5 h-5" />
                                <span className="font-bold hidden sm:inline">
                                    {exporting ? 'Exportando...' : 'Exportar Excel'}
                                </span>
                            </button>
                        )}


                        {/* New Observation Button - Only for Admin and Observer and Lider */}
                        {user?.role && ['admin', 'observer', 'lider'].includes(user.role) && (
                            <button
                                onClick={handleNewObservation}
                                className="flex items-center gap-2 bg-[#E31937] text-white px-4 py-2 rounded-lg hover:bg-[#CA0926] transition-colors shadow-sm"
                            >
                                <PlusCircle className="w-5 h-5" />
                                <span className="font-bold hidden sm:inline">Nueva Observación</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ... (Charts) ... */}
                {/* Filters Section - Fixed & Styled - Single Line */}
                {/* Placeholder height div to prevent content jump when filters are fixed */}
                {/* Filters Section - Sticky & Styled - Single Line */}
                <div className="sticky top-4 z-40 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-md border border-white/20 mb-6 transition-all duration-300 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-2 shrink-0">
                        <Filter className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-gray-800 text-lg whitespace-nowrap">Filtros de Análisis</h3>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-center w-full justify-end">
                        {/* Date Range */}
                        <div className="w-full sm:w-auto flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 h-10 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <Calendar className="w-4 h-4 text-blue-500 mr-1" />
                            <div className="relative w-24">
                                <input
                                    type="text"
                                    name="startDate"
                                    value={filters.startDate}
                                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                    onFocus={(e) => (e.target.type = "date")}
                                    onBlur={(e) => (e.target.type = filters.startDate ? "date" : "text")}
                                    className="w-full text-sm outline-none bg-transparent placeholder-gray-400 text-gray-700 font-medium"
                                    placeholder="Desde"
                                />
                            </div>
                            <span className="text-gray-300">|</span>
                            <div className="relative w-24">
                                <input
                                    type="text"
                                    name="endDate"
                                    value={filters.endDate}
                                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                    onFocus={(e) => (e.target.type = "date")}
                                    onBlur={(e) => (e.target.type = filters.endDate ? "date" : "text")}
                                    className="w-full text-sm outline-none bg-transparent placeholder-gray-400 text-gray-700 font-medium"
                                    placeholder="Hasta"
                                />
                            </div>
                        </div>

                        <MultiSelectFilter
                            label="Turno"
                            options={filterOptions.shifts}
                            selected={filters.shift}
                            onChange={(val) => handleFilterChange('shift', val)}
                            icon={Filter}
                            className="shadow-sm h-10 w-full sm:w-auto"
                        />

                        <MultiSelectFilter
                            label="Sede"
                            options={SITES}
                            selected={filters.site}
                            onChange={(val) => handleFilterChange('site', val)}
                            icon={Filter}
                            className="shadow-sm h-10 w-full sm:w-auto"
                        />

                        <MultiSelectFilter
                            label="Grupo"
                            options={filterOptions.groups}
                            selected={filters.group}
                            onChange={(val) => handleFilterChange('group', val)}
                            icon={Filter}
                            className="shadow-sm h-10 w-full sm:w-auto"
                        />

                        {/* Clear Button - Fixed width, centered or next to last item */}
                        <div className="flex justify-center sm:justify-start lg:block w-full sm:w-auto">
                            {(filters.startDate || filters.endDate || filters.shift.length > 0 || filters.site.length > 0 || filters.group.length > 0) && (
                                <button
                                    onClick={clearFilters}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors flex items-center justify-center border border-red-100 lg:border-none w-full sm:w-auto"
                                    title="Limpiar Filtros"
                                >
                                    <X className="w-5 h-5" />
                                    <span className="sm:hidden ml-2 text-sm font-medium">Limpiar</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>



                {/* Stats Cards - Modern Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { title: 'Total Observaciones', value: stats.total, icon: FileEdit, color: 'blue', onClick: scrollToTable },
                        { title: 'Operadores Observados', value: stats.totalOperators, icon: Users, color: 'emerald', onClick: () => openModal('operators') },
                        { title: 'Desviaciones Detectadas', value: stats.totalDeviations, icon: AlertTriangle, color: 'amber', onClick: () => openModal('deviations') },
                        { title: 'Seguridad Global', value: `${isNaN(stats.safe / stats.total) ? 0 : Math.round((stats.safe / stats.total) * 100)}%`, icon: Shield, color: 'purple', onClick: () => { } },
                    ].map((card, idx) => (
                        <div key={idx} onClick={card.onClick} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group relative overflow-hidden h-fit sm:h-24">

                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <div className={`p-2.5 sm:p-3 rounded-xl bg-${card.color}-50 text-${card.color}-500 group-hover:scale-110 transition-transform shrink-0`}>
                                    <card.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xl sm:text-2xl font-black text-gray-800 mb-0 leading-tight">{card.value}</h3>
                                    <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-tighter whitespace-nowrap">
                                        {card.title}
                                    </p>
                                </div>
                            </div>

                            {card.onClick && card.title !== 'Seguridad Global' && (
                                <div className="absolute top-2 right-2 text-blue-400/30 group-hover:text-blue-500 transition-colors shrink-0">
                                    <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Charts Section */}
                {/* Charts Section - New Specific Charts Refined */}

                {/* Title for Core Analysis */}

                <div className="flex items-center gap-3 mb-6 mt-2 px-2">
                    <Shield className="w-8 h-8 text-indigo-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Análisis de Desviaciones y Comportamiento</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                    {/* Chart 1: Groups (Now 50% because inside grid-cols-2) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <Users className="w-12 h-12 text-blue-500" /> {/* Scaled Icon */}
                            Comparativa por Grupos
                        </h3>
                        <div className="h-80 flex items-center justify-center">
                            <Bar data={groupsChartData} plugins={[dataLabelsPlugin]} options={{
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    tooltip: {
                                        mode: 'index',
                                        intersect: false,
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        titleColor: '#1F2937',
                                        bodyColor: '#4B5563',
                                        borderColor: '#E5E7EB',
                                        borderWidth: 1,
                                        padding: 10
                                    }
                                },
                                layout: { padding: { top: 20 } },
                                scales: {
                                    y: {
                                        grid: { color: '#F3F4F6' },
                                        beginAtZero: true,
                                        grace: '10%' // Add space for labels
                                    },
                                    x: {
                                        grid: { display: false }
                                    }
                                }
                            }} />
                        </div>
                    </div>

                    {/* Chart 3: Findings (50% - moved up to share row) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-400 to-green-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <CheckCircle className="w-12 h-12 text-green-500" /> {/* Scaled Icon */}
                            Distribución de Hallazgos
                        </h3>
                        <div className="h-80 flex items-center justify-center relative">
                            <Doughnut data={findingsChartData} options={{
                                maintainAspectRatio: false,
                                cutout: '70%',
                                plugins: {
                                    legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } },
                                    tooltip: {
                                        callbacks: {
                                            label: function (context) {
                                                let val = context.parsed;
                                                return ` ${context.label}: ${val} (${Math.round(val / totalFindings * 100)}%)`
                                            }
                                        },
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        bodyColor: '#1F2937',
                                        borderColor: '#E5E7EB',
                                        borderWidth: 1
                                    }
                                }
                            }} />
                            {/* Center Percentage */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                                <h4 className="text-sm font-bold text-green-600 uppercase">Positivos</h4>
                                <p className="text-3xl font-black text-gray-800">{positivePct}%</p>
                                <div className="w-12 h-1 bg-gray-200 my-1 rounded"></div>
                                <p className="text-xl font-bold text-gray-400">{negativePct}%</p>
                                <h4 className="text-[10px] font-bold text-red-400 uppercase">Negativos</h4>
                            </div>
                        </div>
                    </div>

                    {/* Chart 2: Types (Full Width for visibility or 50% centered?) 
                         Let's keep it in the grid flow, effectively it will take 50% of the next row if strict grid, 
                         or we can make it col-span-2 to be full width. 
                         User didn't specify size for this one, but "Groups" had to be smaller.
                         Let's make this one full width to differentiate.
                     */}
                    <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <FileEdit className="w-12 h-12 text-blue-500" /> {/* Scaled Icon */}
                            Desempeño por Tipo de Observación
                        </h3>
                        <div className="h-80 flex items-center justify-center">
                            <Bar data={typesChartData} plugins={[dataLabelsPlugin]} options={{
                                maintainAspectRatio: false,
                                responsive: true,
                                plugins: {
                                    legend: { position: 'top' },
                                    tooltip: {
                                        mode: 'index',
                                        intersect: false,
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        titleColor: '#1F2937',
                                        bodyColor: '#4B5563',
                                        borderColor: '#E5E7EB',
                                        borderWidth: 1
                                    }
                                },
                                scales: {
                                    y: { grid: { color: '#F3F4F6' }, beginAtZero: true },
                                    x: { grid: { display: false } }
                                }
                            }} />
                        </div>
                    </div>
                </div>

                {/* Detailed Analysis Title */}
                <div className="flex items-center gap-3 mb-6 mt-12 px-2">
                    <BarChart2 className="w-8 h-8 text-purple-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Análisis Detallado por Observador</h2>
                </div>

                {/* Observer Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                    {/* Chart 4: Observations vs Observers */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-400 to-purple-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <Users className="w-12 h-12 text-purple-500" />
                            Observaciones vs Observadores
                        </h3>
                        <div className="h-80 flex items-center justify-center">
                            <Bar data={obsVsObserversData} plugins={[dataLabelsPlugin]} options={{
                                maintainAspectRatio: false,
                                layout: { padding: { top: 20 } },
                                scales: {
                                    y: { beginAtZero: true, grace: '10%' },
                                    x: { grid: { display: false } }
                                }
                            }} />
                        </div>
                    </div>

                    {/* Chart 5: Operators vs Observers */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-400 to-pink-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <UserCheck className="w-12 h-12 text-pink-500" />
                            Operadores vs Observadores
                        </h3>
                        <div className="h-80 flex items-center justify-center">
                            <Bar data={opsVsObserversData} plugins={[dataLabelsPlugin]} options={{
                                maintainAspectRatio: false,
                                layout: { padding: { top: 20 } },
                                scales: {
                                    y: { beginAtZero: true, grace: '10%' },
                                    x: { grid: { display: false } }
                                }
                            }} />
                        </div>
                    </div>

                    {/* Chart 6: Deviations vs Observers */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-400 to-red-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <AlertTriangle className="w-12 h-12 text-red-500" />
                            Desviaciones vs Observadores
                        </h3>
                        <div className="h-80 flex items-center justify-center">
                            <Bar data={devVsObserversData} plugins={[dataLabelsPlugin]} options={{
                                maintainAspectRatio: false,
                                layout: { padding: { top: 20 } },
                                scales: {
                                    y: { beginAtZero: true, grace: '10%' },
                                    x: { grid: { display: false } }
                                }
                            }} />
                        </div>
                    </div>

                    {/* Chart 7: Shifts vs Observers (Stacked) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-blue-600"></div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                            <Sun className="w-12 h-12 text-amber-500" />
                            Observaciones por Turno
                        </h3>
                        <div className="h-80 flex items-center justify-center">
                            <Bar data={shiftsVsObserversData} plugins={[dataLabelsPlugin]} options={{
                                maintainAspectRatio: false,
                                layout: { padding: { top: 20 } },
                                scales: {
                                    x: { stacked: true, grid: { display: false } },
                                    y: { stacked: true, grace: '10%' }
                                }
                            }} />
                        </div>
                    </div>
                </div>

                {/* Failed Items Analysis Title */}
                <div className="flex items-center gap-3 mb-6 mt-12 px-2">
                    <AlertOctagon className="w-8 h-8 text-red-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Análisis de Fallos (Items NO)</h2>
                </div>

                {/* Chart 8: Items vs Groups */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden mb-12">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-400 to-red-600"></div>
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-3">
                        <List className="w-12 h-12 text-red-500" />
                        Items con Respuesta "No" por Grupo
                    </h3>
                    <div className="h-80 flex items-center justify-center">
                        <Bar data={itemsVsGroupsData} plugins={[dataLabelsPlugin]} options={{
                            maintainAspectRatio: false,
                            layout: { padding: { top: 20 } },
                            scales: {
                                y: { beginAtZero: true, grace: '10%' },
                                x: { grid: { display: false } }
                            }
                        }} />
                    </div>
                </div>

                {
                    modalConfig.isOpen && (
                        <KPIDetailModal
                            title={modalConfig.title}
                            data={modalConfig.data}
                            columns={modalConfig.columns}
                            onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                        />
                    )
                }
                {/* Recent Observations Table - Overhauled Style */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-12">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 bg-blue-500/10 rounded-lg">
                                <Sun className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Historial de Observaciones</h3>
                                <p className="text-sm text-gray-500">{filteredObservations.length} de {recentObservations.length} registros cargados</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const tableData = filteredObservations.map(obs => ({
                                    'Fecha': obs.date || new Date(obs.created_at).toLocaleDateString(),
                                    'Turno': obs.shift,
                                    'Observador': obs.profiles?.full_name,
                                    'Grupo': obs.group_info,
                                    'Sede': obs.site,
                                    'Tipo': obs.observation_type,
                                    'Operadores': obs.observation_records?.length
                                }))
                                const worksheet = XLSX.utils.json_to_sheet(tableData)
                                const workbook = XLSX.utils.book_new()
                                XLSX.utils.book_append_sheet(workbook, worksheet, "Historial")
                                XLSX.writeFile(workbook, `Historial_${new Date().toISOString().split('T')[0]}.xlsx`)
                            }}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center shadow-sm"
                        >
                            <Download className="w-4 h-4 mr-2" /> Exportar Tabla
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm border-b border-gray-200">
                                    <tr>
                                        {[
                                            { header: 'Fecha', accessor: 'date' },
                                            { header: 'Turno', accessor: 'shift' },
                                            { header: 'Observador', accessor: 'full_name' },
                                            { header: 'Grupo', accessor: 'group_info' },
                                            { header: 'Sede', accessor: 'site' },
                                            { header: 'Tipo', accessor: 'observation_type' },
                                            { header: '# Ops', accessor: 'num_ops' },
                                            { header: 'Estado', accessor: 'status' }
                                        ].map((col, idx) => (
                                            <th key={idx} className="px-6 py-4 font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                                <div className="flex items-center justify-between gap-4">
                                                    <span>{col.header}</span>
                                                    <ColumnFilter
                                                        column={col}
                                                        data={recentObservations.map(o => ({
                                                            ...o,
                                                            full_name: o.profiles?.full_name || 'Desconocido',
                                                            num_ops: o.observation_records?.length || 0
                                                        }))}
                                                        filters={tableColumnFilters}
                                                        onChange={(acc, val) => setTableColumnFilters(prev => ({ ...prev, [acc]: val }))}
                                                    />
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-6 py-4 font-bold text-gray-700 uppercase tracking-wider text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loadingObs ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                                    <p className="text-gray-500 font-medium">Cargando historial...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredObservations.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center text-gray-500 bg-gray-50/30">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Filter className="w-10 h-10 text-gray-300" />
                                                    <p className="text-lg">No se encontraron observaciones</p>
                                                    <button
                                                        onClick={() => setTableColumnFilters({})}
                                                        className="text-blue-600 font-bold hover:underline"
                                                    >
                                                        Limpiar todos los filtros de la tabla
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredObservations.map((obs) => (
                                            <tr key={obs.id} className="hover:bg-blue-50/40 transition-colors group border-b border-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap">
                                                    {(() => {
                                                        const dateVal = obs.date || obs.created_at
                                                        const parts = String(dateVal).split('T')[0].split('-')
                                                        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(dateVal)
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 border border-gray-200">
                                                        {obs.shift || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-600">
                                                    {obs.profiles?.full_name || 'Desconocido'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{obs.group_info}</td>
                                                <td className="px-6 py-4 text-gray-600">{obs.site}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-semibold px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                                                        {obs.observation_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-gray-700">
                                                    {obs.observation_records?.length || 0}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${obs.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                                                        }`}>
                                                        {obs.status === 'completed' ? 'Completada' : 'En Curso'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        {obs.status !== 'completed' && ['admin', 'observer', 'lider'].includes(user?.role) && (
                                                            <Link
                                                                to={`/observation/${obs.id}`}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shadow-sm bg-white border border-blue-100"
                                                                title="Editar"
                                                            >
                                                                <FileEdit className="w-4 h-4" />
                                                            </Link>
                                                        )}

                                                        {user?.role === 'admin' && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDelete(e, obs.id)}
                                                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors shadow-sm bg-white border border-red-100"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

        </Layout >
    )
}
