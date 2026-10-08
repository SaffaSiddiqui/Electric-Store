import { useEffect, useState } from 'react'
import api, { errText } from '../../api/client'
import { useToast } from '../../context/ToastContext'

export default function Workers() {
  const toast = useToast()
  const [list, setList] = useState([])
  const [form, setForm] = useState({ username: '', full_name: '', password: '' })
  const [pw, setPw] = useState({}) // per-worker new password input

  const load = () => api.get('/admin/workers').then((r) => setList(r.data)).catch((e) => toast.error(errText(e)))
  useEffect(() => { load() }, [])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const create = async (e) => {
    e.preventDefault()
    try { await api.post('/admin/workers', form); setForm({ username: '', full_name: '', password: '' }); toast.success('Worker created'); load() }
    catch (err) { toast.error(errText(err)) }
  }
  const update = async (id, body, msg) => {
    try { await api.put(`/admin/workers/${id}`, body); toast.success(msg); setPw((p) => ({ ...p, [id]: '' })); load() }
    catch (err) { toast.error(errText(err)) }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Workers</h1>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <form onSubmit={create} className="card p-5">
          <h2 className="text-lg font-bold">Add worker</h2>
          <label className="label" htmlFor="un">Username</label><input id="un" className="input" value={form.username} onChange={set('username')} autoComplete="off" />
          <label className="label" htmlFor="fn">Full name</label><input id="fn" className="input" value={form.full_name} onChange={set('full_name')} />
          <label className="label" htmlFor="pw">Password (min 6 characters)</label><input id="pw" type="password" className="input" value={form.password} onChange={set('password')} autoComplete="new-password" />
          <button className="btn-primary mt-4" disabled={form.username.length < 3 || !form.full_name || form.password.length < 6}>Create worker</button>
        </form>
        <div className="card overflow-x-auto p-2">
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className="th">Name</th><th className="th">Username</th><th className="th">Status</th><th className="th">Reset password</th><th className="th"></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td className="td text-steel" colSpan="5">No workers yet. Add the first one.</td></tr>}
              {list.map((w) => (
                <tr key={w.id} className="border-b border-line">
                  <td className="td font-semibold">{w.full_name}</td><td className="td">{w.username}</td>
                  <td className="td"><span className={`badge ${w.is_active ? 'bg-success' : 'bg-steel'}`}>{w.is_active ? 'Active' : 'Disabled'}</span></td>
                  <td className="td"><div className="flex gap-1">
                    <input type="password" className="input w-32 py-1" placeholder="New password" value={pw[w.id] || ''} onChange={(e) => setPw((p) => ({ ...p, [w.id]: e.target.value }))} />
                    <button className="btn-ghost btn-sm" disabled={(pw[w.id] || '').length < 6} onClick={() => update(w.id, { password: pw[w.id] }, 'Password changed')}>Set</button></div></td>
                  <td className="td"><button className="btn-ghost btn-sm" onClick={() => update(w.id, { is_active: !w.is_active }, w.is_active ? 'Worker disabled' : 'Worker enabled')}>{w.is_active ? 'Disable' : 'Enable'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
