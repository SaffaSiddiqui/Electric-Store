import { useEffect, useRef, useState } from 'react'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import ProductImage from '../../components/ProductImage'
import { money } from '../../lib/format'

const EMPTY = { code: '', name: '', category: '', quality: '', price: '', quantity: 0, low_stock_threshold: 10, description: '', usage: '' }

export default function ManageProducts() {
  const toast = useToast()
  const fileRef = useRef(null)
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/products', { params: { page_size: 200 } }).then((r) => setItems(r.data.items)).catch((e) => toast.error(errText(e)))
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const reset = () => { setForm(EMPTY); setEditing(null); setFile(null); setPreview(''); if (fileRef.current) fileRef.current.value = '' }
  const edit = (p) => {
    setEditing(p); setFile(null); setPreview(p.image_url || '')
    setForm({ code: p.code, name: p.name, category: p.category || '', quality: p.quality || '', price: p.price, quantity: p.quantity,
      low_stock_threshold: p.low_stock_threshold, description: p.description || '', usage: p.usage || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const pickFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2 MB'); e.target.value = ''; return }
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim() || form.price === '') { toast.error('Code, name and price are required'); return }
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (!(editing && k === 'quantity')) fd.append(k, v) })
    if (file) fd.append('image', file)
    setBusy(true)
    try {
      if (editing) await api.put(`/admin/products/${editing.id}`, fd)
      else await api.post('/admin/products', fd)
      toast.success('Product saved'); reset(); load()
    } catch (err) { toast.error(errText(err)) } finally { setBusy(false) }
  }

  const remove = async (p) => {
    if (!confirm(`Remove ${p.name} from the store list? Old bills stay unchanged.`)) return
    try { await api.delete(`/admin/products/${p.id}`); toast.success('Product removed'); load() } catch (err) { toast.error(errText(err)) }
  }

  const field = (k, label, type = 'text', extra = {}) => (
    <div><label className="label" htmlFor={k}>{label}</label><input id={k} type={type} className="input" value={form[k]} onChange={set(k)} {...extra} /></div>
  )

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Manage products</h1>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <form onSubmit={save} className="card p-5">
          <h2 className="text-lg font-bold">{editing ? `Edit ${editing.code}` : 'Add product'}</h2>
          {field('code', 'Code (unique)')}{field('name', 'Name')}{field('category', 'Category')}{field('quality', 'Quality')}
          {field('price', 'Price', 'number', { min: 0, step: '0.01' })}
          {field('quantity', editing ? 'Quantity (use Restock to change)' : 'Starting quantity', 'number', { min: 0, disabled: !!editing })}
          {field('low_stock_threshold', 'Low-stock alert at', 'number', { min: 0 })}
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" rows="2" className="input" value={form.description} onChange={set('description')} />
          <label className="label" htmlFor="usage">Usage</label>
          <textarea id="usage" rows="2" className="input" value={form.usage} onChange={set('usage')} />
          <label className="label" htmlFor="photo">Product photo (JPG, PNG or WEBP, up to 2 MB)</label>
          <input id="photo" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={pickFile} />
          {preview && <img src={preview} alt="Preview" className="mt-3 h-32 w-32 rounded-lg object-cover" />}
          <div className="mt-5 flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</button>
            {editing && <button type="button" className="btn-ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
        <div className="card overflow-x-auto p-2">
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className="th">Photo</th><th className="th">Code</th><th className="th">Name</th><th className="th">Price</th><th className="th">Qty</th><th className="th"></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="td"><ProductImage product={p} className="h-10 w-10 rounded" size={16} /></td>
                  <td className="td font-semibold">{p.code}</td><td className="td">{p.name}</td><td className="td">{money(p.price)}</td><td className="td">{p.quantity}</td>
                  <td className="td whitespace-nowrap"><button className="btn-ghost btn-sm" onClick={() => edit(p)}>Edit</button> <button className="btn-danger btn-sm" onClick={() => remove(p)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
