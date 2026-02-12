import Layout from '../components/Layout'
import { Link } from 'react-router-dom'
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



import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { observationService } from '../services/observations'
import MultiSelectFilter from '../components/MultiSelectFilter'

export default function DashboardPage() {
    const { user } = useAuth()
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
            // Basic query
            let query = supabase
                .from('observations')
                .select('*, profiles!inner(full_name), observation_records(id)')
                .order('created_at', { ascending: false })
                // Increase limit to allow finding older records when filtering, or keep 10?
                // Increasing limit to 50 to allow scrolling
                .limit(50)

            // Apply Filters
            if (filters.startDate) {
                query = query.gte('date', filters.startDate)
            }
            if (filters.endDate) {
                query = query.lte('date', filters.endDate)
            }
            if (filters.shift.length > 0) {
                query = query.in('shift', filters.shift)
            }
            if (filters.type.length > 0) {
                // Use .in for exact match, or iterate for ILIKE? 
                // Since types come from DB, exact match is better and safer for arrays
                query = query.in('observation_type', filters.type)
            }
            if (filters.group.length > 0) {
                query = query.in('group_info', filters.group)
            }
            if (filters.supervisor.length > 0) {
                // Filter by supervisor name is tricky with arrays and joins.
                // Assuming we filter by name string since we don't have IDs in filter options (yet)
                // But wait, filterOptions.supervisors are Names.
                // Supabase doesn't support .in() on joined tables directly easily without foreign table filtering syntax
                // But we CAN filter by inner join property!
                // syntax: query.in('profiles.full_name', filters.supervisor) works if referenced correctly?
                // Actually, Supabase JS client supports filtering on joined tables:
                // .in('profiles.full_name', values) -> This might fail if column format is rigid.
                // Alternative: We already select profiles!inner.
                // Let's try .in('profiles.full_name', filters.supervisor)
                // If this fails, we might need a different approach or filter by ID.
                // Given previous logic used ILIKE, exact match by Name is fine if options come from DB.
                query = query.filter('profiles.full_name', 'in', `(${filters.supervisor.map(s => `"${s}"`).join(',')})`)
            }

            // User Role Filter (Existing Logic)
            if (user && user.role !== 'admin' && user.role !== 'lider') {
                query = query.eq('supervisor_id', user.id)
            }

            try {
                const { data, error } = await query
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
    }, [user, filters]) // Re-run when filters change


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
            label: 'Operadores Únicos',
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
                    { header: 'Sede', accessor: 'site' },
                    { header: 'Grupo', accessor: 'group' },
                    { header: 'Operador', accessor: 'operator' },
                    // "Cantidad" column logic handled by passing the object with 'count' property
                    { header: 'Cantidad', accessor: 'count' }
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
                            // Display date as is from the string to avoid timezone backward shift
                            // e.g., "2026-02-10" displayed as "10/02/2026"
                            if (!row.date) return 'N/A'
                            const parts = String(row.date).split('T')[0].split('-')
                            return `${parts[2]}/${parts[1]}/${parts[0]}`
                        }
                    },
                    { header: 'Sede', accessor: 'site' },
                    { header: 'Grupo', accessor: 'group' },
                    { header: 'Observador', accessor: 'observer' }, // NEW Column
                    { header: 'Operador', accessor: 'operator' },
                    { header: 'Item Fallido', accessor: 'item' }, // Question/Item text
                    { header: 'Comentarios', accessor: 'comments' } // NEW Column
                ]
                break;
            case 'total':
                title = 'Total Observaciones'
                data = stats.observationsList
                columns = [
                    { header: 'Fecha', accessor: 'date', render: (row) => new Date(row.date).toLocaleDateString() },
                    { header: 'Turno', accessor: 'shift' },
                    { header: 'Sede', accessor: 'site' },
                    { header: 'Grupo', accessor: 'group_info' },
                    { header: 'Observador', accessor: 'profiles', render: (row) => row.profiles?.full_name || 'N/A' },
                    { header: 'Estado', accessor: 'status', render: (row) => row.status === 'completed' ? 'Completada' : 'En Curso' }
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
                            <Link
                                to="/observation/new"
                                className="flex items-center gap-2 bg-[#E31937] text-white px-4 py-2 rounded-lg hover:bg-[#CA0926] transition-colors shadow-sm"
                            >
                                <PlusCircle className="w-5 h-5" />
                                <span className="font-bold hidden sm:inline">Nueva Observación</span>
                            </Link>
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { title: 'Total Observaciones', value: stats.total, icon: FileEdit, color: 'blue', onClick: () => scrollToTable() },
                        { title: 'Operadores Observados', value: stats.totalOperators, icon: Users, color: 'emerald', onClick: () => openModal('operators') },
                        { title: 'Desviaciones Detectadas', value: stats.totalDeviations, icon: AlertTriangle, color: 'amber', onClick: () => openModal('deviations') },
                        { title: 'Seguridad Global', value: `${isNaN(stats.safe / stats.total) ? 0 : Math.round((stats.safe / stats.total) * 100)}%`, icon: Shield, color: 'purple', onClick: () => { } },
                    ].map((card, idx) => (
                        <div key={idx} onClick={card.onClick} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow group">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-${card.color}-50 text-${card.color}-500 group-hover:scale-110 transition-transform`}>
                                    <card.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800 mb-0">{card.value}</h3>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.title}</p>
                                </div>
                            </div>
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
                {/* Recent Observations Table - Modern Style */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800">Historial de Observaciones</h3>
                        <span className="text-sm text-gray-500">{stats.observationsList?.length || 0} registros</span>
                    </div>
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 font-bold">Fecha</th>
                                    <th className="px-6 py-3 font-bold">Turno</th>
                                    <th className="px-6 py-3 font-bold">Observador</th>
                                    <th className="px-6 py-3 font-bold">Grupo</th>
                                    <th className="px-6 py-3 font-bold">Sede</th>
                                    <th className="px-6 py-3 font-bold">Tipo</th>
                                    <th className="px-6 py-3 text-center font-bold"># Ops</th>
                                    <th className="px-6 py-3 text-center font-bold">Estado</th>
                                    <th className="px-6 py-3 text-center font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loadingStats ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-8 text-center text-gray-500 animate-pulse">
                                            Cargando datos...
                                        </td>
                                    </tr>
                                ) : stats.observationsList?.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                                            No se encontraron observaciones con los filtros actuales.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.observationsList.map((obs) => (
                                        <tr key={obs.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                {(() => {
                                                    if (!obs.date) return new Date(obs.created_at).toLocaleDateString()
                                                    // Parse YYYY-MM-DD manually to avoid timezone shift
                                                    const parts = String(obs.date).split('T')[0].split('-')
                                                    return `${parts[2]}/${parts[1]}/${parts[0]}`
                                                })()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                                                    {obs.shift || '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {obs.profiles?.full_name || 'Desconocido'}
                                            </td>
                                            <td className="px-6 py-4">{obs.group_info}</td>
                                            <td className="px-6 py-4">{obs.site}</td>
                                            <td className="px-6 py-4">{obs.observation_type}</td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-700">
                                                {obs.observation_records?.length || 0}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${obs.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {obs.status === 'completed' ? 'Completada' : 'En Curso'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                    {obs.status !== 'completed' && ['admin', 'observer', 'lider'].includes(user?.role) && (
                                                        <Link
                                                            to={`/observation/${obs.id}`}
                                                            className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                                                            title="Editar Observación"
                                                        >
                                                            <FileEdit className="w-5 h-5" />
                                                        </Link>
                                                    )}

                                                    {(user?.role === 'admin' || user?.role === 'lider') && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDelete(e, obs.id)}
                                                            className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                                                            title="Eliminar Observación"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
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

        </Layout >
    )
}
