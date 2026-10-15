import { Activity, ArrowUpRight, Database, Globe2, Mail, Search, Shield, Table2, Zap } from 'lucide-react'
import StatusBadge from '../components/common/StatusBadge'
import { tools } from '../mock/mockData'

const icons = { mail: Mail, table: Table2, database: Database, search: Globe2 }

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-[1160px] px-5 pb-16 pt-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-lime"><Zap size={13} />INTEGRATIONS</div><h1 className="font-display text-3xl font-semibold tracking-tight text-[#eee]">Tools & MCP registry</h1><p className="mt-2 max-w-lg text-sm leading-6 text-[#85867f]">The tools your agents can use. Every connection is scoped, monitored, and gated by risk.</p></div><div className="flex items-center gap-2 rounded-full border border-line bg-[#171815] px-3 py-2"><Activity size={13} className="text-lime" /><span className="text-[11px] text-[#aaa]">{tools.filter((tool) => tool.status === 'CONNECTED').length} active connections</span></div></div>
      <div className="mb-5 flex items-center justify-between border-b border-line pb-3"><h2 className="text-xs font-semibold text-[#d8d8d1]">Connected tools</h2><span className="text-[10px] text-[#70716a]">{tools.length} TOOLS</span></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => { const Icon = icons[tool.icon]; return <article key={tool.name} className="rounded-2xl border border-line bg-[#171815] p-5 transition hover:border-[#414239]">
          <div className="mb-5 flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-[#1d1e1a] text-[#deded7]"><Icon size={19} /></span><StatusBadge status={tool.status} /></div>
          <div className="flex items-start justify-between gap-3"><div><p className="font-display text-base font-semibold text-[#e8e8e1]">{tool.name}</p><p className="mt-1 text-[10px] text-[#777871]">{tool.category}</p></div><span className="rounded-md border border-line bg-[#11120f] px-2 py-1 text-[9px] font-semibold tracking-wide text-[#aaa]">{tool.type.toUpperCase()}</span></div>
          <p className="mt-3 text-xs leading-5 text-[#93948d]">{tool.description}</p>
          <div className="mt-5 grid gap-2 border-t border-line pt-4 sm:grid-cols-2"><div className="flex items-start gap-2"><Shield size={13} className="mt-0.5 shrink-0 text-[#888981]" /><span><span className="block text-[9px] uppercase tracking-wider text-[#666760]">Safety</span><span className="mt-1 block text-[10px] text-[#a2a39b]">{tool.sandbox}</span></span></div><div className="flex items-start gap-2"><Activity size={13} className="mt-0.5 shrink-0 text-[#888981]" /><span><span className="block text-[9px] uppercase tracking-wider text-[#666760]">Rate limit</span><span className="mt-1 block text-[10px] text-[#a2a39b]">{tool.limit}</span></span></div></div>
          <button className="mt-4 flex w-full items-center justify-between rounded-lg border border-line bg-[#1a1b18] px-3 py-2.5 text-[10px] font-medium text-[#9a9b94] transition hover:text-white"><span>Connection details</span><ArrowUpRight size={13} /></button>
        </article> })}
      </div>
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-lime/10 bg-lime/[.035] p-4"><span className="mt-0.5 text-lime"><Shield size={15} /></span><p className="text-[11px] leading-5 text-[#999a92]"><span className="font-semibold text-[#d0d1c9]">Human-first by design.</span> Tools that write, send, or modify data always require your approval before taking action. This project runs in mock mode—no external services are connected.</p></div>
      <span className="sr-only"><Search /></span>
    </div>
  )
}
