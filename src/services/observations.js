import { supabase } from '../lib/supabase'
import { OBSERVATION_QUESTIONS } from '../constants'

export const observationService = {
    /**
     * Crea la cabecera de la observación.
     * Se llama cuando el usuario bloquea/confirma los datos de la sesión.
     */
    async createHeader(data) {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) throw new Error('Usuario no autenticado')

        const { data: observation, error } = await supabase
            .from('observations')
            .insert({
                supervisor_id: user.id,
                date: data.date,
                shift: data.shift,
                site: data.site,
                group_info: data.group,
                observation_type: data.observationType,
                status: 'in_progress'
            })
            .select()
            .single()

        if (error) throw error
        return observation
    },

    /**
     * Busca si el usuario ya tiene una observación en curso.
     */
    async getActiveObservation(userId) {
        const { data, error } = await supabase
            .from('observations')
            .select('*')
            .eq('supervisor_id', userId)
            .eq('status', 'in_progress')
            .maybeSingle()

        if (error) throw error
        return data
    },

    /**
     * Agrega el registro de un operador a una observación existente.
     */
    async addRecord(observationId, operatorData) {
        const { data, error } = await supabase
            .from('observation_records')
            .insert({
                observation_id: observationId,
                operator_name: operatorData.operatorName,
                checklist: operatorData.checklist,
                comments: operatorData.comments
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Obtiene el resumen de observaciones recientes (para el Dashboard)
     */
    async getRecent() {
        const { data, error } = await supabase
            .from('observations')
            .select('*, profiles(full_name), observation_records(count)')
            .order('created_at', { ascending: false })
            .limit(10)

        if (error) throw error
        return data
    },

    /**
     * Obtiene una observación completa por ID (Cabecera + Operadores)
     */
    async getById(id) {
        const { data, error } = await supabase
            .from('observations')
            .select(`
                *,
                observation_records (*)
            `)
            .eq('id', id)
            .single()

        if (error) throw error
        return data
    },

    /**
     * Actualiza un registro de operador existente
     */
    async updateRecord(recordId, operatorData) {
        const { data, error } = await supabase
            .from('observation_records')
            .update({
                operator_name: operatorData.operatorName,
                checklist: operatorData.checklist,
                comments: operatorData.comments
            })
            .eq('id', recordId)
            .select()
            .single()

        if (error) throw error
        return data
    },

    /**
     * Elimina una observación completa (y sus registros en cascada si está configurado, 
     * o manual si no)
     */
    async delete(id) {
        // 1. Eliminar registros asociados (si no hay ON DELETE CASCADE en BD)
        const { error: recordsError } = await supabase
            .from('observation_records')
            .delete()
            .eq('observation_id', id)

        if (recordsError) throw recordsError

        // 2. Eliminar la cabecera
        const { error, count } = await supabase
            .from('observations')
            .delete({ count: 'exact' })
            .eq('id', id)

        if (error) throw error

        // Si no se borró nada, lanzar error (probablemente permisos o ya no existe)
        if (count === 0) {
            throw new Error('No se pudo eliminar la observación. Verifique permisos o si ya fue eliminada.')
        }
        return true
    },

    /**
     * Calcula estadísticas para el dashboard
     */
    async getDashboardStats(filters = {}) {
        let query = supabase
            .from('observations')
            .select(`
                id,
                date,
                shift,
                site,
                group_info,
                observation_type,
                supervisor_id,
                status,
                profiles(full_name),
                observation_records(id, operator_name, checklist)
            `)
            .order('created_at', { ascending: false })
            .limit(1000)

        // Apply DB Filters
        if (filters.startDate) query = query.gte('date', filters.startDate)
        if (filters.endDate) query = query.lte('date', filters.endDate)
        if (filters.shift?.length > 0) {
            let mappedShifts = [...filters.shift]
            if (filters.shift.includes('Diurno')) mappedShifts.push('Mañana', 'Tarde', '1', '2')
            if (filters.shift.includes('Nocturno')) mappedShifts.push('Noche', 'Nocturno', '3')
            // Remove duplicates
            mappedShifts = [...new Set(mappedShifts)]
            query = query.in('shift', mappedShifts)
        }
        if (filters.site?.length > 0) query = query.in('site', filters.site)
        if (filters.group?.length > 0) query = query.in('group_info', filters.group)
        // Note: 'profiles!inner' ensures we can filter by filtered related tables if needed, 
        // but here we filter on main table columns mostly.

        const { data: observations, error } = await query

        if (error) {
            console.error('Error fetching stats data:', error)
            throw error
        }

        let safeCount = 0
        let riskCount = 0

        // Chart 3: Findings (Positive vs Negative)
        let positiveFindings = 0
        let negativeFindings = 0

        // Chart 2: Types (Operators vs Deviations)
        const typeStats = {} // { type: { operators: Set, deviations: 0 } }

        // Use a Map for unique operators to track frequency and latest details
        const operatorMap = new Map()
        const deviationList = []
        const monthlyData = {}
        const observerStats = {} // Phase 4.12
        const itemsGroupStats = {} // Phase 4.12

        observations.forEach(obs => {
            // Observer Stats Init
            const observerName = obs.profiles?.full_name || 'Desconocido'
            if (!observerStats[observerName]) {
                observerStats[observerName] = {
                    count: 0,
                    operators: new Set(),
                    deviations: 0,
                    shifts: { 'Diurno': 0, 'Nocturno': 0 }
                }
            }
            observerStats[observerName].count++
            if (obs.shift) {
                let shiftKey = obs.shift
                if (['Mañana', 'Tarde', 'Diurno', '1', '2'].includes(obs.shift)) shiftKey = 'Diurno'
                if (['Noche', 'Nocturno', '3'].includes(obs.shift)) shiftKey = 'Nocturno'

                if (observerStats[observerName].shifts[shiftKey] !== undefined) {
                    observerStats[observerName].shifts[shiftKey]++
                }
            }
            // Init Type Stats
            const type = obs.observation_type || 'Desconocido'
            if (!typeStats[type]) typeStats[type] = { operators: new Set(), deviations: 0 }

            // Determinar si es Segura o Riesgo
            let obsHasRisk = false

            if (obs.observation_records) {
                obs.observation_records.forEach(record => {
                    // Track unique operators and count frequency
                    if (record.operator_name) {
                        const existingOp = operatorMap.get(record.operator_name)
                        if (existingOp) {
                            existingOp.count++
                        } else {
                            operatorMap.set(record.operator_name, {
                                id: record.id,
                                operator: record.operator_name,
                                site: obs.site,
                                group: obs.group_info,
                                count: 1
                            })
                        }
                        // Add to Type Stats
                        if (typeStats[type]) typeStats[type].operators.add(record.operator_name)
                        // Add to Observer Stats
                        if (observerStats[observerName]) observerStats[observerName].operators.add(record.operator_name)
                    }

                    // Check deviations & Findings
                    const checklist = record.checklist || {}
                    Object.entries(checklist).forEach(([key, val]) => {
                        const v = String(val).toLowerCase()
                        if (v === 'si') positiveFindings++
                        if (v === 'no') {
                            negativeFindings++
                            // Observer Deviations
                            if (observerStats[observerName]) observerStats[observerName].deviations++

                            // Item vs Group Stats
                            // OBSERVATION_QUESTIONS is an object { Category: [ {id, label} ] }
                            const questionText = Object.values(OBSERVATION_QUESTIONS).flat().find(q => q.id === key)?.label || key
                            if (!itemsGroupStats[questionText]) itemsGroupStats[questionText] = { 'Grupo 1': 0, 'Grupo 2': 0, 'Grupo 3': 0 }

                            const groupName = obs.group_info || 'Sin Grupo'
                            if (groupName.includes('1')) itemsGroupStats[questionText]['Grupo 1']++
                            else if (groupName.includes('2')) itemsGroupStats[questionText]['Grupo 2']++
                            else if (groupName.includes('3')) itemsGroupStats[questionText]['Grupo 3']++
                        }
                    })

                    const deviations = Object.entries(checklist).filter(([key, val]) => {
                        const v = String(val).toLowerCase()
                        return v === 'no'
                    })

                    if (deviations.length > 0) {
                        obsHasRisk = true
                        typeStats[type].deviations += deviations.length // Add to Type Stats

                        // Create a flat map of questions for easy lookup
                        // ... (Optimization: Move map creation outside loop if static, but keeping here for scope safety)
                        const questionMap = {}
                        Object.values(OBSERVATION_QUESTIONS).flat().forEach(q => {
                            if (q && q.id) questionMap[q.id.toLowerCase()] = q.label
                        })

                        deviations.forEach(([itemKey, val]) => {
                            const cleanKey = String(itemKey).trim().toLowerCase()
                            deviationList.push({
                                id: record.id,
                                date: obs.date,
                                operator: record.operator_name,
                                site: obs.site,
                                group: obs.group_info,
                                item: questionMap[cleanKey] || cleanKey,
                                observer: obs.profiles?.full_name,
                                comments: record.comments
                            })
                        })
                    }
                })
            }

            if (obsHasRisk) riskCount++
            else safeCount++

            // Datos Mensuales
            const date = new Date(obs.created_at)
            const monthName = date.toLocaleString('es-ES', { month: 'short' })
            if (!monthlyData[monthName]) monthlyData[monthName] = { safe: 0, risk: 0 }
            if (obsHasRisk) monthlyData[monthName].risk++
            else monthlyData[monthName].safe++
        })

        // Chart 1: Groups (Parallel Query - Ignores Group Filter)
        const groupsData = await this.getGroupStats({ ...filters, group: [] })

        // Format Chart 2 Data
        const typeLabels = Object.keys(typeStats)
        const typeOpsData = typeLabels.map(t => typeStats[t].operators.size)
        const typeDevsData = typeLabels.map(t => typeStats[t].deviations)

        // Convert Map to Array for frontend
        const operatorList = Array.from(operatorMap.values())

        // Fix KPI: Sum of all operator observations (not unique)
        const totalOperatorsCount = operatorList.reduce((acc, curr) => acc + curr.count, 0)

        // Formatear Mensual (Legacy but kept for line chart if needed)
        const labels = Object.keys(monthlyData)
        const safeData = labels.map(m => monthlyData[m].safe)
        const riskData = labels.map(m => monthlyData[m].risk)

        // Process Observer Data for Charts
        const observersLabels = Object.keys(observerStats)
        const observersData = {
            labels: observersLabels,
            observations: observersLabels.map(l => observerStats[l].count),
            uniqueOperators: observersLabels.map(l => observerStats[l].operators.size),
            labels: observersLabels,
            observations: observersLabels.map(l => observerStats[l].count),
            uniqueOperators: observersLabels.map(l => observerStats[l].operators.size),
            deviations: observersLabels.map(l => observerStats[l].deviations),
            shifts: {
                morning: observersLabels.map(l => observerStats[l].shifts['Diurno'] || 0), // Now Diurno
                afternoon: [], // Deprecated/Empty
                night: observersLabels.map(l => observerStats[l].shifts['Nocturno'] || 0)
            }
        }

        // Process Item vs Group Data
        // Get Top 10 failing items? Or all? Let's take top 7 to avoid clutter
        const sortedItems = Object.entries(itemsGroupStats)
            .sort(([, a], [, b]) => {
                const totalA = a['Grupo 1'] + a['Grupo 2'] + a['Grupo 3']
                const totalB = b['Grupo 1'] + b['Grupo 2'] + b['Grupo 3']
                return totalB - totalA
            })
            .slice(0, 7) // Top 7 items

        const itemsChart = {
            labels: sortedItems.map(([k]) => k.length > 30 ? k.substring(0, 30) + '...' : k), // Truncate long labels
            groups: {
                g1: sortedItems.map(([, v]) => v['Grupo 1']),
                g2: sortedItems.map(([, v]) => v['Grupo 2']),
                g3: sortedItems.map(([, v]) => v['Grupo 3'])
            }
        }

        return {
            total: observations.length,
            safe: safeCount, // FIXED: Count of SAFE OBSERVATIONS (0 deviations)
            risk: riskCount, // FIXED: Count of RISK OBSERVATIONS (>0 deviations)
            totalOperators: totalOperatorsCount,
            totalDeviations: negativeFindings, // Keep total deviations count for reference
            observationsList: observations,
            observationsList: observations,
            deviationList,
            operatorList,
            // New Charts Data
            groupsChart: groupsData,
            typesChart: {
                labels: typeLabels,
                operators: typeOpsData,
                deviations: typeDevsData
            },
            findingsChart: {
                positive: positiveFindings,
                negative: negativeFindings
            },
            // Legacy for transition (can remove later if unused)
            chartData: { labels, safeData, riskData },
            // NEW Charts Data
            observersChart: observersData,
            itemsChart: itemsChart
        }
    },

    /**
     * Helper: Get Group Stats ignoring Group Filter
     */
    async getGroupStats(baseFilters) {
        let query = supabase
            .from('observations')
            .select(`
                group_info,
                observation_records (
                    operator_name,
                    checklist
                )
            `)
            .limit(1000)

        // Apply Base Filters (Date, Site, Shift) but NOT Group
        if (baseFilters.startDate) query = query.gte('date', baseFilters.startDate)
        if (baseFilters.endDate) query = query.lte('date', baseFilters.endDate)
        if (baseFilters.shift?.length > 0) {
            let mappedShifts = [...baseFilters.shift]
            if (baseFilters.shift.includes('Diurno')) mappedShifts.push('Mañana', 'Tarde', '1', '2')
            if (baseFilters.shift.includes('Nocturno')) mappedShifts.push('Noche', 'Nocturno', '3')
            mappedShifts = [...new Set(mappedShifts)]
            query = query.in('shift', mappedShifts)
        }
        if (baseFilters.site?.length > 0) query = query.in('site', baseFilters.site)

        const { data, error } = await query
        if (error) {
            console.error('Error fetching group stats:', error)
            return { labels: [], operators: [], deviations: [] }
        }

        const groupStats = {} // { '1': { count: 0, deviations: 0 } }

        data.forEach(obs => {
            const g = obs.group_info || 'N/A'
            if (!groupStats[g]) groupStats[g] = { count: 0, deviations: 0 }

            if (obs.observation_records) {
                obs.observation_records.forEach(r => {
                    if (r.operator_name) groupStats[g].count++ // Count total, no unique set

                    if (r.checklist) {
                        const devs = Object.values(r.checklist).filter(v => String(v).toLowerCase() === 'no').length
                        groupStats[g].deviations += devs
                    }
                })
            }
        })

        const labels = Object.keys(groupStats).sort()
        return {
            labels,
            operators: labels.map(l => groupStats[l].count),
            deviations: labels.map(l => groupStats[l].deviations)
        }
    },

    /**
     * Obtiene TODAS las observaciones para exportar a Excel
     */
    async getAllForExport() {
        const { data, error } = await supabase
            .from('observations')
            .select(`
                *,
                profiles(full_name, site_default, group_default),
                observation_records (*)
            `)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    }
}
