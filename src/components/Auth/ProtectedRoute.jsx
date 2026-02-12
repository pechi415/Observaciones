import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ProtectedRoute({ allowedRoles }) {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // Forced Password Change
    if (user.must_change_password && location.pathname !== '/profile/change-password') {
        return <Navigate to="/profile/change-password" replace />
    }

    // Role Check
    if (allowedRoles && allowedRoles.length > 0) {
        // Si el usuario no tiene rol o su rol no está permitido
        if (!user.role || !allowedRoles.includes(user.role)) {
            // Usuario autenticado pero sin permiso: mandar a Home (Dashboard) o Login
            // Si intenta entrar a admin y no es admin => Home
            return <Navigate to="/" replace />
        }
    }

    return <Outlet />
}
