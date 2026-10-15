import { LoaderCircle } from 'lucide-react'

const styles = {
  primary: 'bg-lime text-[#171815] hover:bg-[#e0fa91] shadow-[0_0_22px_rgba(210,243,107,.08)]',
  secondary: 'border border-line bg-[#1b1c19] text-[#efefe9] hover:bg-[#22231f]',
  ghost: 'text-[#aaa] hover:bg-white/[.05] hover:text-white',
  danger: 'border border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/60',
}

export default function Button({ children, variant = 'primary', className = '', loading = false, ...props }) {
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
      {loading && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  )
}
