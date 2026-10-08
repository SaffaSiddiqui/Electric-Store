import { useEffect, useState } from 'react'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'

export default function Discounts() {
  const toast = useToast()
  const [rules, setRules] = useState([])
  const [min, setMin] = useState('')
  const [pct, setPct] = useState('')

  const load = () => api.get('/discounts').then((r) => setRules(r.data)).catch((e) => toast.error(errText(e)))
  useEffect(() => { load() }, [])

  const add = async () => {
    try {
      await api.post('/discounts', { min_quantity: Number(min), discount_percent: Number(pct) })
      setMin(''); setPct(''); toast.success('Discount tier saved'); load()
    } catch (e) { toast.error(errText(e)) }
  }
  const del = async (id) => { try { await api.delete(`/discounts/${id}`); load() } catch (e) { toast.error(errText(e)) } }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Quantity discounts</h1>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <p className="mb-3 text-sm text-steel">For each product line, the highest tier reached by that line's quantity is applied automatically.</p>
          {rules.length === 0 && <p className="text-sm text-steel">No tiers yet. Sales will have no discount.</p>}
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-line py-2 last:border-0">
              <span>{r.min_quantity}+ units → <b>{Number(r.discount_percent)}%</b> off</span>
              <button className="btn-danger btn-sm" onClick={() => del(r.id)}>Delete</button>
            </div>
          ))}
        </section>
        <section className="card p-5">
          <h2 className="text-lg font-bold">Add or change a tier</h2>
          <label className="label" htmlFor="m">Minimum quantity</label>
          <input id="m" type="number" min="2" className="input" value={min} onChange={(e) => setMin(e.target.value)} />
          <label className="label" htmlFor="d">Discount percent</label>
          <input id="d" type="number" min="0.5" max="90" step="0.5" className="input" value={pct} onChange={(e) => setPct(e.target.value)} />
          <button className="btn-primary mt-4" disabled={!(Number(min) > 1 && Number(pct) > 0)} onClick={add}>Save tier</button>
        </section>
      </div>
    </div>
  )
}
