import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Coins, Cpu, ShieldCheck } from 'lucide-react'
import StatusBadge from '../components/common/StatusBadge'
import StepCard from '../components/workflow/StepCard'
import LogConsole from '../components/workflow/LogConsole'
import CriticPanel from '../components/workflow/CriticPanel'
import ApprovalModal from '../components/workflow/ApprovalModal'

const stamp = () => new Date().toLocaleTimeString([], { hour12: false })

export default function WorkflowDetailPage({ workflows, updateWorkflow }) {
  const { id } = useParams()
  const workflow = workflows.find((item) => item.id === id)
  const [nextIndex, setNextIndex] = useState(() => {
    const current = workflows.find((item) => item.id === id)
    const next = current?.steps.findIndex((step) => !['COMPLETED', 'FAILED'].includes(step.status))
    return next >= 0 ? next : 0
  })
  const busy = useRef(false)
  const timer = useRef(null)
  const completed = useMemo(() => workflow?.steps?.filter((step) => step.status === 'COMPLETED').length || 0, [workflow])

  useEffect(() => {
    if (!workflow || workflow.status !== 'RUNNING' || busy.current || nextIndex >= workflow.steps.length) return undefined
    const index = nextIndex
    const step = workflow.steps[index]
    if (!step || step.status === 'AWAITING_APPROVAL' || step.status === 'COMPLETED') return undefined

    let cancelled = false
    timer.current = window.setTimeout(() => {
      if (cancelled) return
      busy.current = true
      if (step.risk === 'HIGH' && step.status === 'PENDING') {
        updateWorkflow(id, (item) => ({
          ...item,
          status: 'AWAITING_APPROVAL',
          steps: item.steps.map((entry, i) => i === index ? { ...entry, status: 'AWAITING_APPROVAL' } : entry),
          logs: [...item.logs, { time: stamp(), type: 'approval', text: `${step.role}: Waiting for your approval before ${step.description.toLowerCase()}.` }],
          tokens: item.tokens + 120,
          cost: Number((item.cost + 0.0006).toFixed(4)),
        }))
        return
      }
      updateWorkflow(id, (item) => ({
        ...item,
        steps: item.steps.map((entry, i) => i === index ? { ...entry, status: 'RUNNING' } : entry),
        logs: [...item.logs, { time: stamp(), type: 'agent', text: `${step.role}: ${step.description}.` }],
        tokens: item.tokens + 180 + Math.floor(Math.random() * 100),
        cost: Number((item.cost + 0.0012).toFixed(4)),
        elapsed: Number((item.elapsed + 2.1).toFixed(1)),
      }))
      timer.current = window.setTimeout(() => {
        if (cancelled) return
        updateWorkflow(id, (item) => ({
          ...item,
          steps: item.steps.map((entry, i) => i === index ? { ...entry, status: step.role === 'CriticAgent' ? 'VERIFYING' : 'COMPLETED' } : entry),
          logs: [...item.logs, { time: stamp(), type: entryType(step), text: `${step.role}: ${step.role === 'CriticAgent' ? 'Checking output against the original goal.' : 'Step completed successfully.'}` }],
          elapsed: Number((item.elapsed + 1.4).toFixed(1)),
        }))
        timer.current = window.setTimeout(() => {
          if (cancelled) return
          const justFinished = step.role === 'CriticAgent'
          updateWorkflow(id, (item) => ({
            ...item,
            steps: item.steps.map((entry, i) => i === index ? { ...entry, status: 'COMPLETED' } : entry),
            status: justFinished ? 'COMPLETED' : item.status,
            validationScore: justFinished ? 94 : item.validationScore,
            feedback: justFinished ? 'The result is consistent with the original request. No unverified external changes were detected.' : item.feedback,
            logs: justFinished ? [...item.logs, { time: stamp(), type: 'success', text: 'CriticAgent: Verification passed with a score of 94/100. Workflow complete.' }] : item.logs,
          }))
          busy.current = false
          if (!justFinished) setNextIndex(index + 1)
        }, step.role === 'CriticAgent' ? 800 : 950)
      }, 950)
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
      busy.current = false
    }
  }, [id, workflow?.status, nextIndex, updateWorkflow])

  function resolveApproval(approved) {
    const stepIndex = workflow.steps.findIndex((step) => step.status === 'AWAITING_APPROVAL')
    const step = workflow.steps[stepIndex]
    if (!step) return
    updateWorkflow(id, (item) => ({
      ...item,
      steps: item.steps.map((entry, i) => i === stepIndex ? { ...entry, status: approved ? 'RUNNING' : 'FAILED' } : entry),
      logs: [...item.logs, { time: stamp(), type: approved ? 'approval' : 'error', text: approved ? `Human approval received. ${step.role} is proceeding.` : `Action rejected by user. Workflow stopped safely.` }],
      status: approved ? 'RUNNING' : 'FAILED',
      elapsed: Number((item.elapsed + 0.8).toFixed(1)),
      feedback: approved ? item.feedback : 'The high-risk action was rejected. No external changes were made.',
    }))
    if (!approved) return
    busy.current = true
    timer.current = window.setTimeout(() => {
      updateWorkflow(id, (item) => ({
        ...item,
        steps: item.steps.map((entry, i) => i === stepIndex ? { ...entry, status: 'COMPLETED' } : entry),
        logs: [...item.logs, { time: stamp(), type: 'success', text: `${step.role}: Approved action completed.` }],
      }))
      busy.current = false
      setNextIndex(stepIndex + 1)
    }, 900)
  }

  if (!workflow) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><p className="text-sm text-[#999]">This workflow could not be found.</p><Link className="mt-4 inline-flex text-sm text-lime" to="/">Return to dashboard</Link></div>

  const isRunning = workflow.status === 'RUNNING'
  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8 sm:px-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs text-[#85867f] hover:text-white"><ArrowLeft size={14} />Back to dashboard</Link>
      <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl"><div className="mb-3 flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-[#777871]">{workflow.id}</span><span className="text-[#55564f]">/</span><StatusBadge status={workflow.status} /></div><h1 className="font-display text-[22px] font-semibold leading-snug tracking-tight text-[#efefe9] sm:text-[28px]">{workflow.goal}</h1><p className="mt-2 text-xs text-[#777871]">Started {new Date(workflow.createdAt).toLocaleString()}</p></div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={Cpu} label="Total tokens" value={workflow.tokens.toLocaleString()} foot="Across all agents" />
        <Metric icon={Coins} label="Estimated cost" value={`$${workflow.cost.toFixed(4)}`} foot="Mock usage estimate" />
        <Metric icon={Clock3} label="Elapsed latency" value={`${workflow.elapsed.toFixed(1)}s`} foot={isRunning ? 'Live execution' : 'Total run time'} />
        <div className="rounded-xl border border-line bg-[#171815] p-4"><div className="mb-3 flex items-center gap-2 text-[11px] text-[#8c8d86]"><ShieldCheck size={14} />Overall status</div><StatusBadge status={workflow.status} /><p className="mt-2 text-[10px] text-[#666760]">{completed} of {workflow.steps.length} steps complete</p></div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-line bg-[#141512] p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[#e8e8e1]">Execution plan</h2><p className="mt-1 text-[11px] text-[#777871]">Agents work in sequence, with verification at every step</p></div><span className="text-[10px] text-[#777871]">{workflow.steps.length} STEPS</span></div>
          {workflow.steps.map((step, index) => <StepCard key={step.id} step={step} index={index} isLast={index === workflow.steps.length - 1} />)}
          {workflow.status === 'FAILED' && <div className="mt-1 rounded-xl border border-red-400/15 bg-red-400/[.04] p-3 text-xs text-red-200">Workflow stopped safely. No further actions were taken.</div>}
        </section>
        <div className="space-y-4"><LogConsole logs={workflow.logs} running={isRunning} /><CriticPanel score={workflow.validationScore} feedback={workflow.feedback} status={workflow.status} /></div>
      </div>
      <ApprovalModal step={workflow.steps.find((step) => step.status === 'AWAITING_APPROVAL')} open={workflow.status === 'AWAITING_APPROVAL'} onApprove={() => resolveApproval(true)} onReject={() => resolveApproval(false)} />
    </div>
  )
}

function entryType(step) {
  return step.role === 'CriticAgent' ? 'system' : 'agent'
}

function Metric({ icon: Icon, label, value, foot }) {
  return <div className="rounded-xl border border-line bg-[#171815] p-4"><div className="mb-3 flex items-center gap-2 text-[11px] text-[#8c8d86]"><Icon size={14} />{label}</div><p className="font-display text-lg font-bold text-[#e9e9e2]">{value}</p><p className="mt-1 text-[10px] text-[#686963]">{foot}</p></div>
}
