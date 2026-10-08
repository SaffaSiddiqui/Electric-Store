import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import BillModal from '../../components/BillModal'
import ProductImage from '../../components/ProductImage'
import { calcLine, nextTier } from '../../lib/discount'
import { money, stockInfo } from '../../lib/format'

export default function NewSale() {
  const toast = useToast()
  const codeRef = useRef(null)
  const [rules, setRules] = useState([])
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(1)
  const [cart, setCart] = useState([]) // [{ product, quantity }]
  const [customer, setCustomer] = useState('')
  const [busy, setBusy] = useState(false)
  const [bill, setBill] = useState(null)

  useEffect(() => { api.get('/discounts').then((r) => setRules(r.data)).catch((e) => toast.error(errText(e))) }, [])
  useEffect(() => {
    if (selected || !query.trim()) { setSuggestions([]); return }
    const t = setTimeout(() => {
      api.get('/products/search', { params: { q: query } }).then((r) => setSuggestions(r.data)).catch(() => {})
    }, 180)
    return () => clearTimeout(t)
  }, [query, selected])

  const pick = (p) => { setSelected(p); setQuery(p.code); setSuggestions([]) }
  const clearSelection = () => { setSelected(null); setQuery(''); setQty(1); codeRef.current?.focus() }

  // Lines shown in the live preview = cart + the line currently being typed (draft).
  const { lines, warning } = useMemo(() => {
    const out = cart.map((c) => ({ ...c, draft: false }))
    let warn = ''
    const q = Math.max(0, Number(qty) || 0)
    if (selected && q > 0) {
      const i = out.findIndex((l) => l.product.id === selected.id)
      const total = (i >= 0 ? out[i].quantity : 0) + q
      if (total > selected.quantity) warn = `Only ${selected.quantity} in stock for ${selected.name}`
      const line = { product: selected, quantity: total, draft: true }
      if (i >= 0) out[i] = line; else out.push(line)
    }
    return { lines: out.map((l) => ({ ...l, ...calcLine(l.product.price, l.quantity, rules) })), warning: warn }
  }, [cart, selected, qty, rules])

  const subtotal = lines.reduce((s, l) => s + l.gross, 0)
  const discount = lines.reduce((s, l) => s + l.discount, 0)
  const canAdd = selected && Number(qty) > 0 && !warning

  const addLine = () => {
    if (!canAdd) return
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === selected.id)
      if (i < 0) return [...c, { product: selected, quantity: Number(qty) }]
      return c.map((l, k) => (k === i ? { ...l, quantity: l.quantity + Number(qty) } : l))
    })
    clearSelection()
  }

  const finish = async () => {
    setBusy(true)
    try {
      const { data } = await api.post('/sales', {
        customer_name: customer || null,
        items: cart.map((c) => ({ product_id: c.product.id, quantity: c.quantity })),
      })
      setBill(data); setCart([]); setCustomer(''); clearSelection()
      toast.success('Sale saved. Stock updated.')
    } catch (e) {
      toast.error(errText(e))
    } finally { setBusy(false) }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">New sale</h1>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="card p-5">
          <label className="label mt-0" htmlFor="code">Product code or name</label>
          <input id="code" ref={codeRef} autoFocus className="input" autoComplete="off" placeholder="e.g. SW-001 or switch"
            value={query} onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); pick(suggestions[0]) } }} />
          {suggestions.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-md border border-line">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => pick(p)} className="flex w-full items-center justify-between gap-3 border-b border-line bg-white px-3 py-2 text-left text-sm last:border-0 hover:bg-paper">
                    <span>{p.code} — {p.name}</span><span className="text-steel">{money(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-paper p-2">
              <ProductImage product={selected} className="h-14 w-14 rounded-md" size={22} />
              <div className="text-sm">
                <div className="font-semibold">{selected.name}</div>
                <div className="text-steel">{money(selected.price)} each · <span className={`badge ${stockInfo(selected).cls}`}>{stockInfo(selected).text}</span></div>
              </div>
            </div>
          )}
          <label className="label" htmlFor="qty">Quantity</label>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost w-11" onClick={() => setQty(Math.max(1, (Number(qty) || 1) - 1))} aria-label="Decrease"><Minus size={16} /></button>
            <input id="qty" type="number" min="1" className="input text-center" value={qty}
              onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLine()} />
            <button type="button" className="btn-ghost w-11" onClick={() => setQty((Number(qty) || 0) + 1)} aria-label="Increase"><Plus size={16} /></button>
          </div>
          <label className="label">Amount (before discount)</label>
          <input className="input font-semibold" readOnly value={selected ? money(selected.price * (Number(qty) || 0)) : money(0)} />
          <label className="label" htmlFor="cust">Customer name (optional)</label>
          <input id="cust" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!canAdd} onClick={addLine}>Add to bill</button>
            <button className="btn-dark" disabled={!cart.length || busy} onClick={finish}>{busy ? 'Saving…' : 'Complete sale'}</button>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-2 text-lg font-bold">Bill preview</h2>
          {lines.length === 0 && <p className="py-6 text-sm text-steel">Pick a product and the bill builds up here as you type.</p>}
          {lines.map((l) => (
            <div key={l.product.id} className={`flex items-center gap-3 border-b border-line py-3 ${l.draft ? 'italic opacity-70' : ''}`}>
              <ProductImage product={l.product} className="h-11 w-11 flex-none rounded-md" size={18} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{l.product.name}
                  {l.pct > 0 && <span className="badge ml-2 bg-success">-{l.pct}%</span>}
                  {l.draft && <span className="ml-2 text-xs font-normal text-steel">(not added yet)</span>}
                </div>
                <div className="text-xs text-steel">{l.product.code} · {l.quantity} × {money(l.product.price)}{l.discount > 0 && ` · saves ${money(l.discount)}`}</div>
                {nextTier(l.quantity, rules) && (
                  <div className="text-xs text-copper-dark">Add {nextTier(l.quantity, rules).min_quantity - l.quantity} more for {Number(nextTier(l.quantity, rules).discount_percent)}% off</div>
                )}
              </div>
              <div className="text-right">
                <div className="font-bold">{money(l.total)}</div>
                {!l.draft && <button className="mt-1 text-xs text-danger hover:underline" onClick={() => setCart((c) => c.filter((x) => x.product.id !== l.product.id))}><Trash2 size={12} className="mr-1 inline" />Remove</button>}
              </div>
            </div>
          ))}
          {warning && <p className="mt-3 text-sm font-semibold text-danger" role="alert">{warning}</p>}
          <div className="mt-4 grid gap-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>- {money(discount)}</span></div>
            <div className="mt-1 flex justify-between border-t-2 border-copper pt-2 text-xl font-bold"><span>Grand total</span><span>{money(subtotal - discount)}</span></div>
          </div>
        </section>
      </div>
      {bill && <BillModal sale={bill} onClose={() => setBill(null)} />}
    </div>
  )
}
