import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Boxes, LogOut, Package, PackagePlus, Percent, Receipt, ShoppingCart, Users, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const WORKER = [
  { to: '/products', label: 'Products', icon: Package },
  { to: '/sale', label: 'New sale', icon: ShoppingCart },
  { to: '/sales', label: 'My sales', icon: Receipt },
]
const ADMIN = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/sale', label: 'New sale', icon: ShoppingCart },
  { to: '/admin/products', label: 'Manage products', icon: Boxes },
  { to: '/admin/restock', label: 'Restock', icon: PackagePlus },
  { to: '/sales', label: 'Sales history', icon: Receipt },
  { to: '/admin/discounts', label: 'Discounts', icon: Percent },
  { to: '/admin/workers', label: 'Workers', icon: Users },
]

export default function Layout() {
  const { auth, logout } = useAuth()
  const items = auth.role === 'admin' ? ADMIN : WORKER
  const link = ({ isActive }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#B7791F]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`
  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print bg-ink text-white md:sticky md:top-0 md:h-screen md:w-60 md:flex-none md:flex md:flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2 text-lg font-bold"><Zap className="text-copper" size={20} /> Electric Store</div>
          <button onClick={logout} className="md:hidden text-slate-300" aria-label="Log out"><LogOut size={18} /></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={link}><Icon size={17} />{label}</NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-4 md:block">
          <div className="text-sm font-semibold">{auth.name}</div>
          <div className="mb-3 text-xs text-slate-400">{auth.role === 'admin' ? 'Administrator' : 'Worker'}</div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"><LogOut size={16} /> Log out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8"><Outlet /></main>
    </div>
  )
}
