import axios from 'axios'

const STORAGE_KEY = 'electric-store-auth'

export const loadAuth = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}
export const saveAuth = (a) => localStorage.setItem(STORAGE_KEY, JSON.stringify(a))
export const clearAuth = () => localStorage.removeItem(STORAGE_KEY)

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`).replace(/\/+$/, '')
const apiBaseUrl = configuredApiBaseUrl.replace(/\/functions\/v1\/api\/api$/, '/functions/v1/api')
const api = axios.create({ baseURL: apiBaseUrl })

api.interceptors.request.use((config) => {
  const auth = loadAuth()
  if (auth?.token) config.headers.Authorization = `Bearer ${auth.token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const onLogin = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !onLogin) {
      clearAuth()
      window.dispatchEvent(new Event('auth:logout'))
    }
    return Promise.reject(error)
  },
)

/** Turn any axios error into a message a shop worker can read. */
export const errText = (e) => {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg).join(', ')
  if (e?.code === 'ERR_NETWORK') return 'Cannot reach Supabase. Check your connection and configuration.'
  return e?.message || 'Something went wrong'
}

export default api
