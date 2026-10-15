import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, dismissible = true }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm" onMouseDown={(event) => dismissible && event.target === event.currentTarget && onClose?.()}>
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-lg rounded-2xl border border-line bg-[#191a17] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="modal-title" className="font-display text-lg font-bold text-white">{title}</h2>
          {dismissible && <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white"><X size={18} /></button>}
        </div>
        {children}
      </section>
    </div>
  )
}
