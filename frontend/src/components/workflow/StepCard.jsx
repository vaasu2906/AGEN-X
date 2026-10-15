import { Check, Circle, LoaderCircle, ShieldAlert, X } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'

const icons = {
  COMPLETED: Check,
  RUNNING: LoaderCircle,
  VERIFYING: LoaderCircle,
  FAILED: X,
  AWAITING_APPROVAL: ShieldAlert,
  PENDING: Circle,
}

export default function StepCard({ step, index, isLast }) {
  const Icon = icons[step.status] || Circle
  const active = ['RUNNING', 'VERIFYING', 'AWAITING_APPROVAL'].includes(step.status)
  return (
    <div className="relative flex gap-4">
      {!isLast && <span className={`absolute left-[17px] top-10 h-[calc(100%-16px)] w-px ${step.status === 'COMPLETED' ? 'bg-lime/40' : 'bg-line'}`} />}
      <div className={`relative z-10 mt-1 grid h-[35px] w-[35px] shrink-0 place-items-center rounded-full border ${step.status === 'COMPLETED' ? 'border-lime/40 bg-lime/10 text-lime' : active ? 'border-blue-400/40 bg-blue-400/10 text-blue-300' : step.status === 'FAILED' ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-line bg-[#1a1b18] text-[#62635e]'}`}>
        <Icon size={15} className={['RUNNING', 'VERIFYING'].includes(step.status) ? 'animate-spin' : ''} />
      </div>
      <article className={`mb-4 min-w-0 flex-1 rounded-xl border p-4 transition ${active ? 'border-blue-400/25 bg-blue-400/[.035]' : 'border-line bg-[#171815]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="mb-1 flex items-center gap-2 text-[10px] font-bold tracking-[.12em] text-[#85867f]"><span>STEP {String(index + 1).padStart(2, '0')}</span><span className="h-1 w-1 rounded-full bg-[#5f605a]" /><span>{step.role}</span></div>
            <h3 className="text-[13px] font-semibold leading-5 text-[#e5e5de]">{step.description}</h3>
          </div>
          <StatusBadge status={step.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line bg-[#11120f] px-2 py-1 text-[10px] text-[#a4a59d]">{step.tool}</span>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] ${step.risk === 'HIGH' ? 'bg-amber-300/[.08] text-amber-200' : 'bg-white/[.035] text-[#82837c]'}`}><ShieldAlert size={10} />{step.risk} RISK</span>
        </div>
      </article>
    </div>
  )
}
