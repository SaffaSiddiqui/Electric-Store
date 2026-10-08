import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import api, { errText } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import BillModal from '../components/BillModal'
import { dateTime, money } from '../lib/format'

export default function SalesHistory() {
  const { auth } = useAuth()
  const toast = useToast()
  const admin = auth.role === 'admin'
  const [filters, setFilters] = useState({ date_from: '', date_to: '', worker_id: '', product_code: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [workers, setWorkers] = useState([])
  const [open, setOpen] = useState(null)
  const size = 25

  useEffect(() => { if (admin) api.get('/admin/workers').then((r) => setWorkers(r.data)).catch(() => {}) }, [admin])
  useEffect(() => {
    const params = { page, page_size: size }
    Object.entries(filters).forEach(([k, v]) => { if (v && admin) params[k] = v })
    api.get('/sales', { params }).then((r) => setData(r.data)).catch((e) => toast.error(errText(e)))
  }, [filters, page])

  const set = (k) => (e) => { setPage(1); setFilters((f) => ({ ...f, [k]: e.target.value })) }
  const units = (s) => s.sale_items.reduce((a, i) => a + i.quantity, 0)

  const exportCsv = () => {
    const rows = [['Bill', 'Date', 'Worker', 'Customer', 'Units', 'Subtotal', 'Discount', 'Total']]
    data.items.forEach((s) => rows.push([s.bill_no, s.sold_at, s.worker?.full_name || '', s.customer_name || '', units(s), s.subtotal, s.total_discount, s.grand_total]))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'sales.csv'; a.click()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{admin ? 'Sales history' : 'My sales today'}</h1>
        {admin && data?.items.length > 0 && <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> Export this page (CSV)</button>}
      </div>
      {admin && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label mt-0">From</label><input type="date" className="input" value={filters.date_from} onChange={set('date_from')} /></div>
          <div><label className="label mt-0">To</label><input type="date" className="input" value={filters.date_to} onChange={set('date_to')} /></div>
          <div><label className="label mt-0">Worker</label>
            <select className="input" value={filters.worker_id} onChange={set('worker_id')}>
              <option value="">All workers</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
            </select></div>
          <div><label className="label mt-0">Product code</label><input className="input" placeholder="e.g. SW-001" value={filters.product_code} onChange={set('product_code')} /></div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-line"><th className="th">Bill</th><th className="th">Date and time</th><th className="th">Worker</th><th className="th">Units</th><th className="th">Discount</th><th className="th text-right">Total</th></tr></thead>
          <tbody>
            {!data && <tr><td className="td text-steel" colSpan="6">Loading…</td></tr>}
            {data?.items.length === 0 && <tr><td className="td text-steel" colSpan="6">No sales found.</td></tr>}
            {data?.items.map((s) => (
              <tr key={s.id} className="cursor-pointer border-b border-line hover:bg-paper" onClick={() => setOpen(s)}>
                <td className="td font-semibold">#{s.bill_no}</td><td className="td">{dateTime(s.sold_at)}</td>
                <td className="td">{s.worker?.full_name || '—'}</td><td className="td">{units(s)}</td>
                <td className="td">{money(s.total_discount)}</td><td className="td text-right font-semibold">{money(s.grand_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.count > size && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          <button className="btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {Math.ceil(data.count / size)}</span>
          <button className="btn-ghost btn-sm" disabled={page * size >= data.count} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      {open && <BillModal sale={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
