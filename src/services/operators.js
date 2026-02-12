import { supabase } from '../lib/supabase'
import { OPERATORS } from '../data/operators'

export const operatorService = {
    // Leer todos los operadores (con filtros opcionales)
    getAll: async ({ site, group } = {}) => {
        let query = supabase
            .from('operators')
            .select('*')
            .eq('is_active', true)
            .order('name')

        if (site) query = query.eq('site', site)
        if (group) query = query.eq('group', group)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    // Crear un operador
    create: async (operator) => {
        const { data, error } = await supabase
            .from('operators')
            .insert([{
                name: operator.name,
                site: operator.site,
                group: operator.group,
                is_active: true
            }])
            .select()
            .single()

        if (error) throw error
        return data
    },

    // Actualizar un operador
    update: async (id, updates) => {
        const { data, error } = await supabase
            .from('operators')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    // "Eliminar" (Soft Delete)
    delete: async (id) => {
        const { error } = await supabase
            .from('operators')
            .update({ is_active: false })
            .eq('id', id)

        if (error) throw error
        return true
    },

    // MIGRACIÓN MASIVA
    // Inserta los datos del archivo local a Supabase
    migrateFromLocal: async () => {
        console.log('Iniciando migración de', OPERATORS.length, 'operadores...')

        // Preparar datos (mapear claves si es necesario)
        const records = OPERATORS.map(op => ({
            name: op.name,
            site: op.site,
            group: op.group,
            is_active: true
        }))

        // Insertar en lotes de 100 para no saturar
        const BATCH_SIZE = 100
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE)
            const { error } = await supabase
                .from('operators')
                .insert(batch)

            if (error) {
                console.error(`Error en lote ${i}:`, error)
                throw error
            }
        }

        console.log('Migración completada con éxito.')
        return records.length
    }
}
