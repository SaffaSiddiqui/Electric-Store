import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { errText } from '../api/client'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await login(username.trim(), password) } catch (err) { setError(errText(err)) } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-2 text-2xl font-bold"><Zap className="text-copper" /> Electric Store</div>
        <p className="mb-2 text-sm text-steel">Log in to start selling or manage stock.</p>
        <label className="label" htmlFor="u">Username</label>
        <input id="u" className="input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <label className="label" htmlFor="p">Password</label>
        <input id="p" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary mt-5 w-full" disabled={busy || !username || !password}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </div>
  )
}
