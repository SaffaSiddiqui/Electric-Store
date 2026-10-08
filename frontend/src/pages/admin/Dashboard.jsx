import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { money } from '../../lib/format'

export default function Dashboard() {
  const toast = useToast()
  const [d, setD] = useState(null)
  useEffect(() => { api.get('/admin/dashboard').then((r) => setD(r.data)).catch((e) => toast.error(errText(e))) }, [])
  if (!d) return <p className="text-steel">Loading dashboard…</p>
  const stats = [
    [money(d.today.revenue), "Today's revenue"],
    [d.today.bills, 'Bills today'],
    [d.today.units, 'Units sold today'],
    [d.low_stock.length, 'Low-stock alerts'],
  ]
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([v, l]) => <div key={l} className="card p-4"><div className="text-2xl font-bold text-copper">{v}</div><div className="text-sm text-steel">{l}</div></div>)}
      </div>
      <div className="card mb-5 p-5">
        <h2 className="mb-3 text-lg font-bold">Sales, last 7 days</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={d.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3DED3" />
              <XAxis dataKey="day" stroke="#5B6B7F" fontSize={12} />
              <YAxis stroke="#5B6B7F" fontSize={12} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="total" fill="#B7791F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Low stock</h2>
          {d.low_stock.length === 0 && <p className="text-sm text-steel">Everything is well stocked.</p>}
          {d.low_stock.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
              <span>{p.code} — {p.name}</span>
              <span className={`badge ${p.quantity === 0 ? 'bg-danger' : 'bg-warning'}`}>{p.quantity} left</span>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Top sellers, last 30 days</h2>
          {d.top_products.length === 0 && <p className="text-sm text-steel">No sales yet.</p>}
          {d.top_products.map((p) => (
            <div key={p.code} className="flex justify-between border-b border-line py-2 text-sm last:border-0"><span>{p.name}</span><b>{p.units} sold</b></div>
          ))}
        </div>
      </div>
    </div>
  )
}
