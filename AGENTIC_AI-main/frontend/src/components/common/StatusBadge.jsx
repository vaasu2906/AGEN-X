const tones = {
  COMPLETED: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  RUNNING: 'bg-blue-400/10 text-blue-300 ring-blue-400/20',
  VERIFYING: 'bg-violet-400/10 text-violet-300 ring-violet-400/20',
  PENDING: 'bg-white/[.05] text-[#a5a69f] ring-white/10',
  FAILED: 'bg-red-400/10 text-red-300 ring-red-400/20',
  AWAITING_APPROVAL: 'bg-amber-300/10 text-amber-200 ring-amber-300/20',
  CONNECTED: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  HIGH: 'bg-amber-300/10 text-amber-200 ring-amber-300/20',
  LOW: 'bg-white/[.05] text-[#a5a69f] ring-white/10',
  MOCK: 'bg-lime/10 text-lime ring-lime/20',
}

export default function StatusBadge({ status, className = '' }) {
  const label = status === 'AWAITING_APPROVAL' ? 'NEEDS APPROVAL' : status
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[.08em] ring-1 ring-inset ${tones[status] || tones.PENDING} ${className}`}>
    {status === 'RUNNING' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}{label}
  </span>
}
