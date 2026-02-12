import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/Auth/ProtectedRoute'

import ObservationPage from './pages/ObservationPage'
import { PlusCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import DashboardPage from './pages/DashboardPage'

// Placeholder for Dashboard
const DashboardPlaceholder = () => (
  <div className="p-8">
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-2xl font-bold text-gray-800">Panel de Control</h1>
      <Link
        to="/observation/new"
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        <PlusCircle className="w-5 h-5 mr-2" />
        Nueva Observación
      </Link>
    </div>
    <div className="bg-white p-6 rounded-lg shadow text-center">
      <p className="text-gray-500">Aquí irán los gráficos. ¡Empieza creando una observación!</p>
    </div>
  </div>
)

import AdminUsersListPage from './pages/AdminUsersListPage'
import AdminUserFormPage from './pages/AdminUserFormPage'
import AdminOperatorsPage from './pages/AdminOperatorsPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>

          {/* Rutas Públicas */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas Protegidas por Rol */}

          {/* Solo Admin */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/users" element={<AdminUsersListPage />} />
            <Route path="/admin/users/new" element={<AdminUserFormPage />} />
            <Route path="/admin/users/new" element={<AdminUserFormPage />} />
            <Route path="/admin/users/edit/:id" element={<AdminUserFormPage />} />
            <Route path="/admin/operators" element={<AdminOperatorsPage />} />
          </Route>

          {/* Admin y Observador y Lider */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'observer', 'lider']} />}>
            <Route path="/observation/new" element={<ObservationPage />} />
            <Route path="/observation/:id" element={<ObservationPage />} />
          </Route>

          {/* Todos los roles autenticados (Admin, Observer, Reader, Lider) */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'observer', 'reader', 'lider']} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/profile/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Catch all - Redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
