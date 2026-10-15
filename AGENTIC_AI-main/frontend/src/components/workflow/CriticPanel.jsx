import { BadgeCheck, ShieldCheck } from 'lucide-react'

export default function CriticPanel({ score = 0, feedback, status }) {
  const finished = ['COMPLETED', 'FAILED'].includes(status)
  return (
    <section className="rounded-2xl border border-line bg-[#171815] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#e8e8e1]"><ShieldCheck size={15} className="text-lime" />Critic verification</div>
        {finished && <BadgeCheck size={16} className={status === 'COMPLETED' ? 'text-emerald-300' : 'text-red-300'} />}
      </div>
      <div className="mb-3 flex items-end justify-between"><span className="text-xs text-[#92938d]">Validation score</span><span className="font-display text-xl font-bold text-[#eee]">{finished ? `${score}%` : '—'}</span></div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#2a2b26]"><div className={`h-full rounded-full transition-all duration-700 ${status === 'FAILED' ? 'bg-red-400' : 'bg-lime'}`} style={{ width: `${finished ? score : 0}%` }} /></div>
      <p className="rounded-lg border border-line bg-[#11120f] p-3 text-xs leading-5 text-[#9b9c95]">{feedback || 'The critic will review agent output when the workflow finishes.'}</p>
    </section>
  )
}
