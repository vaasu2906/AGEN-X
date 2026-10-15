import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, FileText, Mail, Plus, Search, Sparkles, Zap } from 'lucide-react'
import Button from '../components/common/Button'
import StatusBadge from '../components/common/StatusBadge'
import { makeWorkflow, templates } from '../mock/mockData'

const templateIcons = { file: FileText, mail: Mail, search: Search }

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function DashboardPage({ workflows, onCreateWorkflow }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function execute(goal = prompt) {
    if (!goal.trim() || loading) return
    setLoading(true)
    const workflow = makeWorkflow(goal.trim())
    onCreateWorkflow(workflow)
    navigate(`/workflow/${workflow.id}`)
  }

  return (
    <div className="mx-auto max-w-[1120px] px-5 pb-16 pt-12 sm:px-8 sm:pt-[68px]">
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-lime/15 bg-lime/[.055] px-3 py-1.5 text-[10px] font-semibold tracking-[.12em] text-lime"><Sparkles size={12} />YOUR AI WORKSPACE</div>
        <h1 className="font-display text-3xl font-semibold tracking-[-.04em] text-[#eee] sm:text-[42px]">What can I help you <span className="text-lime">automate?</span></h1>
        <p className="mt-3 text-sm text-[#85867f]">Describe a task. Your agents will plan, execute, and verify it.</p>
      </div>
      <form className="mx-auto max-w-[760px]" onSubmit={(e) => { e.preventDefault(); execute() }}>
        <div className="rounded-[20px] border border-[#373931] bg-[#191a17] p-3 shadow-[0_10px_50px_rgba(0,0,0,.15)] transition focus-within:border-lime/40 focus-within:shadow-[0_0_30px_rgba(210,243,107,.035)]">
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); execute() } }} placeholder="e.g. Summarize my unread emails and flag anything urgent..." rows={3} className="min-h-[90px] w-full resize-y bg-transparent px-3 pt-2 text-[14px] leading-6 text-[#ecece5] outline-none placeholder:text-[#666760]" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex items-center gap-2 px-2 text-[11px] text-[#777871]"><span className="grid h-6 w-6 place-items-center rounded-md bg-white/[.045]"><Zap size={12} className="text-lime" /></span>Human approval on high-risk actions</div>
            <Button type="submit" className="px-4 py-2.5" loading={loading}>Execute workflow<ArrowRight size={15} /></Button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#61625c]">Press <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px]">Enter</kbd> to run · <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px]">Shift + Enter</kbd> for a new line</p>
      </form>

      <section className="mx-auto mt-12 max-w-[900px]">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[13px] font-semibold text-[#deded7]">Start with a template</h2><p className="mt-1 text-[11px] text-[#777871]">A little inspiration for your first workflow</p></div><span className="hidden text-[10px] text-[#666760] sm:block">3 QUICK STARTS</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          {templates.map((template) => { const Icon = templateIcons[template.icon]; return <button key={template.title} onClick={() => execute(template.prompt)} className="group rounded-2xl border border-line bg-[#171815] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#4b4c42] hover:bg-[#1a1b18]">
            <span className="mb-4 grid h-9 w-9 place-items-center rounded-xl border border-lime/10 bg-lime/[.055] text-lime"><Icon size={16} /></span>
            <span className="mb-1.5 block text-[12px] font-semibold text-[#e1e1da]">{template.title}</span>
            <span className="block text-[11px] leading-[1.65] text-[#82837c]">{template.description}</span>
            <span className="mt-4 flex items-center gap-1 text-[10px] font-semibold text-[#a5a69e] transition group-hover:text-lime">Use template<ArrowRight size={11} className="transition group-hover:translate-x-0.5" /></span>
          </button> })}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-[900px]">
        <div className="mb-4 flex items-end justify-between"><div><div className="mb-1 flex items-center gap-2"><Clock3 size={13} className="text-[#92938b]" /><h2 className="text-[13px] font-semibold text-[#deded7]">Recent runs</h2></div><p className="text-[11px] text-[#777871]">Pick up where you left off</p></div><button onClick={() => navigate('/history')} className="flex items-center gap-1 text-[11px] font-medium text-[#9c9d96] hover:text-lime">View all<ArrowRight size={12} /></button></div>
        <div className="overflow-hidden rounded-2xl border border-line bg-[#171815]">
          {workflows.length === 0 ? <div className="flex flex-col items-center py-10 text-center"><span className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-white/[.04] text-[#787972]"><Plus size={18} /></span><p className="text-sm text-[#d4d4cd]">No workflows yet</p><p className="mt-1 text-xs text-[#777871]">Your runs will show up here.</p></div> : workflows.slice(0, 3).map((workflow, index) => <button key={workflow.id} onClick={() => navigate(`/workflow/${workflow.id}`)} className={`flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[.025] sm:px-5 ${index > 0 ? 'border-t border-line' : ''}`}>
            <span className={`hidden h-8 w-8 shrink-0 place-items-center rounded-lg sm:grid ${workflow.status === 'FAILED' ? 'bg-red-400/10 text-red-300' : 'bg-lime/[.07] text-lime'}`}>{workflow.status === 'FAILED' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium text-[#dfdfd8]">{workflow.goal}</span><span className="mt-1 block font-mono text-[9px] text-[#6c6d67]">{workflow.id} · {formatDate(workflow.createdAt)}</span></span>
            <StatusBadge status={workflow.status} /><span className="hidden text-[10px] text-[#777871] md:block">{workflow.tokens.toLocaleString()} tokens</span><ArrowRight size={14} className="text-[#6b6c65]" />
          </button>)}
        </div>
      </section>
    </div>
  )
}
