import { createContext, useCallback, useContext, useState } from 'react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, type = 'info') => {
    const id = Math.random()
    setItems((l) => [...l, { id, text, type }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800)
  }, [])
  const toast = { success: (t) => push(t, 'success'), error: (t) => push(t, 'error'), info: (t) => push(t) }
  const border = { success: 'border-success', error: 'border-danger', info: 'border-copper' }
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] grid gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`max-w-sm rounded-md border-l-4 bg-ink px-4 py-3 text-sm text-white shadow-lg ${border[t.type]}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
