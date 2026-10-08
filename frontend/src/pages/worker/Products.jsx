import { useEffect, useState } from 'react'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import ProductImage from '../../components/ProductImage'
import { money, stockInfo } from '../../lib/format'

export default function Products() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [open, setOpen] = useState(null)

  useEffect(() => { api.get('/products/categories').then((r) => setCategories(r.data)).catch(() => {}) }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/products', { params: { search, category, page_size: 200 } })
        .then((r) => setData(r.data)).catch((e) => toast.error(errText(e)))
    }, 250)
    return () => clearTimeout(t)
  }, [search, category])

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Products</h1>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <div className="card p-4"><div className="text-3xl font-bold text-copper">{data?.total_products ?? '–'}</div><div className="text-sm text-steel">Total products</div></div>
        <div className="card p-4"><div className="text-3xl font-bold text-copper">{data?.total_quantity ?? '–'}</div><div className="text-sm text-steel">Total units in stock</div></div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-sm" placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-[200px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {!data ? <p className="text-steel">Loading products…</p> : data.items.length === 0 ? (
        <p className="text-steel">No products match your search.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {data.items.map((p) => {
            const s = stockInfo(p)
            return (
              <button key={p.id} onClick={() => setOpen(p)} className="card overflow-hidden text-left transition hover:border-copper">
                <ProductImage product={p} className="aspect-[4/3] w-full" />
                <div className="grid gap-1 p-3">
                  <div className="font-semibold leading-tight">{p.name}</div>
                  <div className="text-xs text-steel">{p.code} · {p.category}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-bold">{money(p.price)}</span>
                    <span className={`badge ${s.cls}`}>{s.text}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {open && (
        <Modal onClose={() => setOpen(null)}>
          <ProductImage product={open} className="mb-4 aspect-[4/3] w-full rounded-lg" size={56} />
          <h2 className="text-xl font-bold">{open.name}</h2>
          <p className="mb-3 text-sm text-steel">{open.code} · {open.category}</p>
          <p className="mb-3 text-sm">{open.description}</p>
          <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
            <dt className="text-steel">Quality</dt><dd>{open.quality}</dd>
            <dt className="text-steel">Usage</dt><dd>{open.usage}</dd>
            <dt className="text-steel">Price</dt><dd className="font-semibold">{money(open.price)}</dd>
            <dt className="text-steel">Stock</dt><dd><span className={`badge ${stockInfo(open).cls}`}>{stockInfo(open).text}</span></dd>
          </dl>
        </Modal>
      )}
    </div>
  )
}
