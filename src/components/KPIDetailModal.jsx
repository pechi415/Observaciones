import { X, Filter, Download, Search, Check, ChevronDown, List } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'

// Custom Hook for Click Outside
function useOnClickOutside(ref, handler) {
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

const ColumnFilter = ({ column, data, filters, onChange }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef()

    // Check if this is a date column (based on header name or accessor)
    const isDateColumn = column.accessor === 'date' || column.header.toLowerCase().includes('fecha')

    // Extract unique values from the FULL dataset for this column (for standard filters)
    const uniqueValues = useMemo(() => {
        if (isDateColumn) return []
        const values = new Set(data.map(row => String(row[column.accessor] || '')))
        return Array.from(values).sort()
    }, [data, column, isDateColumn])

    // Current selected values for this column. 
    // For Date: { start: '', end: '' } or undefined
    // For Standard: [values] or undefined
    const selectedValues = filters[column.accessor]

    // Handle "Select All" toggle (Standard only)
    const toggleSelectAll = () => {
        if (selectedValues && selectedValues.length === uniqueValues.length) {
            onChange(column.accessor, []) // Deselect all
        } else {
            onChange(column.accessor, undefined) // Select all (reset filter)
        }
    }

    // Handle individual value toggle (Standard only)
    const toggleValue = (val) => {
        let newSelected
        // If currently "All" (undefined), we need to start with all unique values then remove the clicked one
        if (filters[column.accessor] === undefined) {
            newSelected = uniqueValues.filter(v => v !== val)
        } else {
            // Already filtering, just toggle
            const current = selectedValues || []
            if (current.includes(val)) {
                newSelected = current.filter(v => v !== val)
            } else {
                newSelected = [...current, val]
            }
        }

        // If we ended up selecting everything, reset to undefined for valid "Select All" state
        if (newSelected.length === uniqueValues.length) {
            onChange(column.accessor, undefined)
        } else {
            onChange(column.accessor, newSelected)
        }
    }

    // Handle Dates
    const handleDateChange = (type, val) => {
        const currentRange = selectedValues || { start: '', end: '' }
        const newRange = { ...currentRange, [type]: val }

        // If both empty, clear filter
        if (!newRange.start && !newRange.end) {
            onChange(column.accessor, undefined)
        } else {
            onChange(column.accessor, newRange)
        }
    }

    useOnClickOutside(containerRef, () => setIsOpen(false))

    // Filter the list of values displayed in the dropdown based on search (Standard only)
    const displayedValues = uniqueValues.filter(v =>
        v.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const isFilterActive = filters[column.accessor] !== undefined

    return (
        <div className="relative inline-block ml-2" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${isFilterActive ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
                title="Filtrar"
            >
                <Filter className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 flex flex-col max-h-[400px]">

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
                                {/* Select All Option */}
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

export default function KPIDetailModal({ title, data, columns, onClose }) {
    // State for per-column filters: { accessor: [selected_values] }
    // If key is missing, it means "All Selected".
    const [columnFilters, setColumnFilters] = useState({})

    const filteredData = useMemo(() => {
        return data.filter(item => {
            return Object.entries(columnFilters).every(([accessor, filterValue]) => {
                // If filterValue is undefined or null, initialized as no filter
                if (!filterValue) return true

                // DATA RANGE FILTER LOGIC
                // Check if filterValue is an object with start/end properties (and not an array)
                if (typeof filterValue === 'object' && !Array.isArray(filterValue) && (filterValue.start !== undefined || filterValue.end !== undefined)) {
                    // Normalize row date to YYYY-MM-DD string to avoid timezone shifts
                    // Assuming row.date is "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..."
                    const itemDateStr = String(item[accessor]).split('T')[0]

                    const startStr = filterValue.start
                    const endStr = filterValue.end

                    if (startStr && endStr) return itemDateStr >= startStr && itemDateStr <= endStr
                    if (startStr) return itemDateStr >= startStr
                    if (endStr) return itemDateStr <= endStr
                    return true
                }

                // STANDARD ARRAY FILTER LOGIC
                if (Array.isArray(filterValue)) {
                    if (filterValue.length === 0) return true // Should handle empty as "all"? Or "none"? Logic above sets [] as deselect all.
                    // If logic above sets [] as "Deselect All", then we should return false if item in list?
                    // Let's stick to: undefined = All, [] = None? or [] = All?
                    // In ColumnFilter:
                    // - Select All -> onChange(undefined)
                    // - Deselect All -> onChange([])
                    if (filterValue.length === 0) return false

                    const itemValue = String(item[accessor] || '')
                    return filterValue.includes(itemValue)
                }

                return true
            })
        })
    }, [data, columnFilters])

    const handleFilterChange = (accessor, newSelected) => {
        setColumnFilters(prev => ({
            ...prev,
            [accessor]: newSelected
        }))
    }

    const handleExport = () => {
        // Map data to headers for export
        const exportData = filteredData.map(row => {
            const rowData = {}
            columns.forEach(col => {
                rowData[col.header] = row[col.accessor]
            })
            return rowData
        })
        const worksheet = XLSX.utils.json_to_sheet(exportData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle")
        XLSX.writeFile(workbook, `Reporte_${title.replace(' ', '_')}.xlsx`)
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col animate-fadeIn">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-black text-blue-600">{filteredData.length}</span>
                            <span className="text-sm text-gray-500">registros encontrados</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors shadow-sm"
                        >
                            <Download className="w-4 h-4" /> Exportar Excel
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Table Container with Scroll */}
                <div className="flex-1 overflow-hidden p-6">
                    <div className="border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col">
                        <div className="overflow-y-auto max-h-[60vh] custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        {columns.map((col, idx) => (
                                            <th key={idx} className="px-6 py-4 font-bold bg-gray-50 min-w-[150px]">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-gray-700">{col.header}</span>
                                                    <ColumnFilter
                                                        column={col}
                                                        data={data}
                                                        filters={columnFilters}
                                                        onChange={handleFilterChange}
                                                    />
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.length > 0 ? (
                                        filteredData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                                {columns.map((col, cIdx) => (
                                                    <td key={cIdx} className="px-6 py-3 text-gray-700 whitespace-nowrap group-hover:text-gray-900">
                                                        {col.render ? col.render(row) : row[col.accessor]}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 bg-gray-50/30">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Filter className="w-8 h-8 text-gray-300" />
                                                    <p>No se encontraron resultados con los filtros actuales</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer (No Pagination) */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl shrink-0 text-center">
                    <p className="text-xs text-gray-400">Mostrando todos los registros ({filteredData.length})</p>
                </div>
            </div>
        </div>
    )
}
