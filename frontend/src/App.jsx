import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Products from './pages/worker/Products'
import NewSale from './pages/worker/NewSale'
import SalesHistory from './pages/SalesHistory'
import Dashboard from './pages/admin/Dashboard'
import ManageProducts from './pages/admin/ManageProducts'
import Restock from './pages/admin/Restock'
import Discounts from './pages/admin/Discounts'
import Workers from './pages/admin/Workers'

export default function App() {
  const { auth } = useAuth()
  const home = auth?.role === 'admin' ? '/admin' : '/products'
  return (
    <Routes>
      <Route path="/login" element={auth ? <Navigate to={home} replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/products" element={<Products />} />
        <Route path="/sale" element={<NewSale />} />
        <Route path="/sales" element={<SalesHistory />} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute roles={['admin']}><ManageProducts /></ProtectedRoute>} />
        <Route path="/admin/restock" element={<ProtectedRoute roles={['admin']}><Restock /></ProtectedRoute>} />
        <Route path="/admin/discounts" element={<ProtectedRoute roles={['admin']}><Discounts /></ProtectedRoute>} />
        <Route path="/admin/workers" element={<ProtectedRoute roles={['admin']}><Workers /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={auth ? home : '/login'} replace />} />
    </Routes>
  )
}
