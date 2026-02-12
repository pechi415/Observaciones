import { Filter, Search, X } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'

// Custom Hook for Click Outside
export function useOnClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) {
                return
            }
            handler(event)
        }
        document.addEventListener("mousedown", listener)
        document.addEventListener("touchstart", listener)
        return () => {
            document.removeEventListener("mousedown", listener)
            document.removeEventListener("touchstart", listener)
        }
    }, [ref, handler])
}

export const ColumnFilter = ({ column, data, filters, onChange }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef()

    // Check if this is a date column
    const isDateColumn = column.accessor === 'date' || column.header.toLowerCase().includes('fecha')

    // Extract unique values from the FULL dataset for this column
    const uniqueValues = useMemo(() => {
        if (isDateColumn) return []
        const values = new Set(data.map(row => {
            const val = row[column.accessor]
            return val === null || val === undefined ? '' : String(val)
        }))
        return Array.from(values).sort()
    }, [data, column, isDateColumn])

    // Current selected values for this column
    const selectedValues = filters[column.accessor]

    const toggleSelectAll = () => {
        if (selectedValues && selectedValues.length === uniqueValues.length) {
            onChange(column.accessor, []) // Deselect all
        } else {
            onChange(column.accessor, undefined) // Select all (reset filter)
        }
    }

    const toggleValue = (val) => {
        let newSelected
        if (filters[column.accessor] === undefined) {
            newSelected = uniqueValues.filter(v => v !== val)
        } else {
            const current = selectedValues || []
            if (current.includes(val)) {
                newSelected = current.filter(v => v !== val)
            } else {
                newSelected = [...current, val]
            }
        }

        if (newSelected.length === uniqueValues.length) {
            onChange(column.accessor, undefined)
        } else {
            onChange(column.accessor, newSelected)
        }
    }

    const handleDateChange = (type, val) => {
        const currentRange = selectedValues || { start: '', end: '' }
        const newRange = { ...currentRange, [type]: val }

        if (!newRange.start && !newRange.end) {
            onChange(column.accessor, undefined)
        } else {
            onChange(column.accessor, newRange)
        }
    }

    useOnClickOutside(containerRef, () => setIsOpen(false))

    const displayedValues = uniqueValues.filter(v =>
        v.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const isFilterActive = filters[column.accessor] !== undefined

    return (
        <div className="relative inline-block ml-2" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${isFilterActive ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Filtrar"
            >
                <Filter className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 lg:left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col max-h-[400px]">

                    {isDateColumn ? (
                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-600">Desde</label>
                                <input
                                    type="date"
                                    value={selectedValues?.start || ''}
                                    onChange={(e) => handleDateChange('start', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-600">Hasta</label>
                                <input
                                    type="date"
                                    value={selectedValues?.end || ''}
                                    onChange={(e) => handleDateChange('end', e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="pt-2 border-t border-gray-100 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(column.accessor, undefined)
                                        setIsOpen(false)
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                    Limpiar Filtro
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>

                            <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
                                <label className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!selectedValues || selectedValues.length === uniqueValues.length}
                                        onChange={toggleSelectAll}
                                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                                    />
                                    <span className="ml-2 text-sm text-gray-700 font-medium">(Seleccionar todo)</span>
                                </label>

                                <div className="my-1 border-t border-gray-100"></div>

                                {displayedValues.map(val => (
                                    <label key={val} className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!selectedValues || selectedValues.includes(val)}
                                            onChange={() => toggleValue(val)}
                                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                                        />
                                        <span className="ml-2 text-sm text-gray-600 truncate" title={val}>{val || '(Vacío)'}</span>
                                    </label>
                                ))}
                                {displayedValues.length === 0 && (
                                    <p className="text-xs text-center text-gray-400 py-2">No hay resultados</p>
                                )}
                            </div>
                        </>
                    )}

                    {!isDateColumn && (
                        <div className="p-2 border-t border-gray-100 bg-gray-50 rounded-b-lg flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
