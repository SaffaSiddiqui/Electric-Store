import { useEffect, useState } from 'react'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { dateTime } from '../../lib/format'

export default function Restock() {
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [filter, setFilter] = useState('')
  const [id, setId] = useState('')
  const [qty, setQty] = useState(10)
  const [moves, setMoves] = useState([])
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.get('/products', { params: { page_size: 200 } }).then((r) => { setProducts(r.data.items); setId((cur) => cur || r.data.items[0]?.id || '') }).catch((e) => toast.error(errText(e)))
    api.get('/admin/stock-movements').then((r) => setMoves(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const shown = products.filter((p) => (p.code + p.name).toLowerCase().includes(filter.toLowerCase()))
  const product = products.find((p) => p.id === id)
  const add = Math.max(0, Number(qty) || 0)

  const submit = async () => {
    if (!product || add < 1) { toast.error('Enter a quantity above 0'); return }
    setBusy(true)
    try {
      const { data } = await api.post(`/admin/products/${id}/restock`, { quantity: add })
      toast.success(`${product.name}: stock is now ${data.quantity}`); load()
    } catch (e) { toast.error(errText(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Restock</h1>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <label className="label mt-0" htmlFor="f">Find product</label>
          <input id="f" className="input" placeholder="Type a code or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <label className="label" htmlFor="p">Product</label>
          <select id="p" className="input" value={id} onChange={(e) => setId(e.target.value)}>
            {shown.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <label className="label" htmlFor="q">Quantity to add</label>
          <input id="q" type="number" min="1" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
          {product && <p className="mt-3 text-sm">Current stock <b>{product.quantity}</b> → new stock <b className="text-success">{product.quantity + add}</b></p>}
          <button className="btn-primary mt-4" disabled={busy || !product} onClick={submit}>{busy ? 'Adding…' : 'Add stock'}</button>
        </section>
        <section className="card p-5">
          <h2 className="mb-2 text-lg font-bold">Recent stock changes</h2>
          {moves.length === 0 && <p className="text-sm text-steel">No stock changes yet.</p>}
          {moves.slice(0, 15).map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
              <div>{m.product?.code} · {m.reason}<div className="text-xs text-steel">{dateTime(m.created_at)} {m.user?.full_name && `· ${m.user.full_name}`}</div></div>
              <b className={m.change > 0 ? 'text-success' : 'text-danger'}>{m.change > 0 ? '+' : ''}{m.change}</b>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
