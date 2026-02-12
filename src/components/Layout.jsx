import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, User, Menu, Users, Key, Shield } from 'lucide-react'
import { useState } from 'react'
import logo from '../assets/logo.png'

export default function Layout({ children }) {
    const { user, signOut } = useAuth()
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            {/* Navbar */}
            <nav className="bg-[#231F20] shadow-md border-b-4 border-[#E31937]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center gap-3 sm:gap-4">
                                <img src={logo} alt="Drummond Ltd." className="h-10 sm:h-16 w-auto transition-all duration-300" />
                                <span className="hidden sm:block text-xl sm:text-2xl font-bold text-white hover:text-[#E31937] transition tracking-wider">
                                    OBSERVACIONES DE SEGURIDAD
                                </span>
                                {/* Mobile Text (Short version if needed, or just logo) */}
                                <span className="sm:hidden text-lg font-bold text-white tracking-wider">
                                    OBSERVACIONES
                                </span>
                            </Link>
                        </div>

                        <div className="hidden sm:flex sm:items-center sm:space-x-4">
                            <div className="flex items-center text-white">
                                <User className="w-5 h-5 mr-2" />
                                <span className="text-sm font-medium">
                                    {user?.full_name || user?.email || 'Usuario'}
                                </span>
                            </div>

                            {/* Admin Link - Desktop (Moved here) */}
                            {user?.role === 'admin' && (
                                <>
                                    <Link
                                        to="/admin/users"
                                        className="p-2 rounded-full text-gray-400 hover:text-[#E31937] hover:bg-gray-800 transition-colors"
                                        title="Gestionar Usuarios"
                                    >
                                        <Users className="w-5 h-5" />
                                    </Link>
                                    <Link
                                        to="/admin/operators"
                                        className="p-2 rounded-full text-gray-400 hover:text-[#E31937] hover:bg-gray-800 transition-colors"
                                        title="Gestionar Operadores"
                                    >
                                        <Shield className="w-5 h-5" />
                                    </Link>
                                </>
                            )}

                            {/* Change Password Link */}
                            <Link
                                to="/profile/change-password"
                                className="p-2 rounded-full text-gray-400 hover:text-[#FFF200] hover:bg-gray-800 transition-colors"
                                title="Cambiar Contraseña"
                            >
                                <Key className="w-5 h-5" />
                            </Link>

                            <button
                                onClick={signOut}
                                className="p-2 rounded-full text-gray-400 hover:text-[#E31937] hover:bg-gray-800 transition-colors"
                                title="Cerrar Sesión"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Mobile menu button */}
                        <div className="flex items-center sm:hidden">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <div className="sm:hidden bg-[#231F20] border-t border-gray-700">
                        <div className="pt-2 pb-3 space-y-1">
                            {user?.role === 'admin' && (
                                <>
                                    <Link
                                        to="/admin/users"
                                        className="block px-4 py-2 text-base font-medium text-gray-300 hover:text-[#E31937] hover:bg-gray-900"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <div className="flex items-center">
                                            <Users className="w-5 h-5 mr-2" />
                                            Gestionar Usuarios
                                        </div>
                                    </Link>
                                    <Link
                                        to="/admin/operators"
                                        className="block px-4 py-2 text-base font-medium text-gray-300 hover:text-[#E31937] hover:bg-gray-900"
                                        onClick={() => setIsMenuOpen(false)}
                                    >
                                        <div className="flex items-center">
                                            <Shield className="w-5 h-5 mr-2" />
                                            Gestionar Operadores
                                        </div>
                                    </Link>
                                </>
                            )}
                            <div className="px-4 py-2 flex items-center text-gray-300">
                                <User className="w-5 h-5 mr-2" />
                                <span className="text-sm">
                                    {user?.full_name || user?.email || 'Usuario'}
                                </span>
                            </div>
                            <button
                                onClick={signOut}
                                className="w-full text-left px-4 py-2 text-base font-medium text-[#E31937] hover:bg-gray-900"
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    )
}
