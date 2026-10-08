import { X } from 'lucide-react'

export default function Modal({ onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`print-area relative max-h-[90vh] w-full overflow-auto rounded-xl bg-white p-6 shadow-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <button onClick={onClose} className="no-print absolute right-3 top-3 text-steel hover:text-ink" aria-label="Close"><X size={20} /></button>
        {children}
      </div>
    </div>
  )
}
