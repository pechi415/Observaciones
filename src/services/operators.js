import { supabase } from '../lib/supabase'

export const operatorService = {
    // Leer todos los operadores (con filtros opcionales)
    getAll: async ({ site, group } = {}) => {
        let query = supabase
            .from('operators')
            .select('*')
            .eq('is_active', true)
            .order('name')

        if (site && site.length > 0) query = query.in('site', Array.isArray(site) ? site : [site])
        if (group && group.length > 0) query = query.in('group', Array.isArray(group) ? group : [group])

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

}
