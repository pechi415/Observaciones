import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function MultiSelectFilter({ label, options, selected, onChange, formatOption, icon: Icon, className = "" }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleOption = (option) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option]
        onChange(newSelected)
    }

    const toggleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([])
        } else {
            onChange([...options])
        }
    }

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full min-w-[120px] pl-2 pr-2 h-full border border-gray-300 rounded text-xs bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
                <div className="flex items-center truncate mr-2">
                    {Icon && <Icon className="w-3 h-3 text-gray-500 mr-2" />}
                    <span className="truncate">
                        {selected.length === 0
                            ? label
                            : selected.length === options.length
                                ? `Todos (${label})`
                                : selected.length === 1
                                    ? (formatOption ? formatOption(selected[0]) : selected[0])
                                    : `${selected.length} ${label}`
                        }
                    </span>
                </div>
                <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full min-w-[12rem] mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {options.length > 0 && (
                        <div
                            onClick={toggleSelectAll}
                            className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                        >
                            <div className={`w-4 h-4 mr-2 border rounded flex items-center justify-center ${selected.length === options.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                }`}>
                                {selected.length === options.length && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-semibold text-gray-700">
                                Seleccionar Todos
                            </span>
                        </div>
                    )}

                    {options.length === 0 ? (
                        <div className="p-2 text-xs text-gray-500">No hay opciones</div>
                    ) : (
                        options.map(option => (
                            <div
                                key={option}
                                onClick={() => toggleOption(option)}
                                className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                <div className={`w-4 h-4 mr-2 border rounded flex items-center justify-center ${selected.includes(option) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                    }`}>
                                    {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-xs text-gray-700">
                                    {formatOption ? formatOption(option) : option}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
