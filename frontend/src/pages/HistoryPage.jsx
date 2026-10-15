import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock3, Search, SlidersHorizontal } from 'lucide-react'
import StatusBadge from '../components/common/StatusBadge'

export default function HistoryPage({ workflows }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const navigate = useNavigate()
  const filtered = useMemo(() => workflows.filter((workflow) => (status === 'ALL' || workflow.status === status) && `${workflow.id} ${workflow.goal}`.toLowerCase().includes(query.toLowerCase())), [workflows, query, status])
  return (
    <div className="mx-auto max-w-[1160px] px-5 pb-16 pt-10 sm:px-8">
      <div className="mb-8"><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-lime"><Clock3 size={13} />AUDIT TRAIL</div><h1 className="font-display text-3xl font-semibold tracking-tight text-[#eee]">Workflow history</h1><p className="mt-2 text-sm text-[#85867f]">A complete record of your agent runs and their outcomes.</p></div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74756e]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by run ID or goal..." className="h-11 w-full rounded-xl border border-line bg-[#171815] pl-10 pr-4 text-xs text-white outline-none placeholder:text-[#6d6e67] focus:border-[#494a40]" /></label>
        <label className="relative flex items-center gap-2 rounded-xl border border-line bg-[#171815] px-3.5"><SlidersHorizontal size={14} className="text-[#85867f]" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 min-w-[130px] appearance-none bg-transparent pr-4 text-xs text-[#d2d2cb] outline-none"><option value="ALL">All statuses</option><option value="COMPLETED">Completed</option><option value="RUNNING">Running</option><option value="FAILED">Failed</option></select></label>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-[#171815]">
        <div className="grid grid-cols-[minmax(0,1fr)_120px_95px_100px] gap-3 border-b border-line bg-[#1a1b18] px-5 py-3 text-[9px] font-bold tracking-[.13em] text-[#73746d] lg:grid-cols-[minmax(220px,1.8fr)_120px_100px_105px_160px_100px]"><span>RUN / GOAL</span><span>STATUS</span><span className="hidden lg:block">TOKENS</span><span className="hidden sm:block">COST</span><span className="hidden lg:block">DATE & TIME</span><span /></div>
        {filtered.length === 0 ? <div className="flex flex-col items-center px-6 py-16 text-center"><span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-[#1d1e1a] text-[#797a73]"><Search size={18} /></span><h3 className="text-sm font-semibold text-[#ddd]">No runs found</h3><p className="mt-1 max-w-xs text-xs leading-5 text-[#777871]">Try a different search or status filter. New workflows will appear here.</p></div> : filtered.map((workflow, index) => <div key={workflow.id} onClick={() => navigate(`/workflow/${workflow.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/workflow/${workflow.id}`)} role="button" tabIndex={0} className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_120px_95px_100px] items-center gap-3 px-5 py-4 transition hover:bg-white/[.025] lg:grid-cols-[minmax(220px,1.8fr)_120px_100px_105px_160px_100px] ${index > 0 ? 'border-t border-line' : ''}`}>
          <span className="min-w-0"><span className="mb-1 block font-mono text-[9px] text-[#74756e]">{workflow.id}</span><span className="block truncate text-xs font-medium text-[#deded7]">{workflow.goal}</span></span>
          <StatusBadge status={workflow.status} /><span className="hidden font-mono text-[10px] text-[#aaa] lg:block">{workflow.tokens.toLocaleString()}</span><span className="hidden font-mono text-[10px] text-[#aaa] sm:block">${workflow.cost.toFixed(4)}</span><span className="hidden text-[10px] text-[#85867f] lg:block">{new Date(workflow.createdAt).toLocaleString()}</span><span className="flex items-center gap-1 text-[10px] font-semibold text-[#aaa] hover:text-lime">View run<ArrowRight size={12} /></span>
        </div>)}
      </div>
      <p className="mt-3 text-[10px] text-[#6c6d66]">Showing {filtered.length} of {workflows.length} runs</p>
    </div>
  )
}
