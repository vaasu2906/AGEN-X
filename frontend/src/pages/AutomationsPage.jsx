import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Loader2, Pause, Play, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import Button from '../components/common/Button'
import api from '../lib/api'

const INTERVALS = [
  { label: 'Every 30s (demo)', seconds: 30 },
  { label: 'Every 5 min', seconds: 5 * 60 },
  { label: 'Every 30 min', seconds: 30 * 60 },
  { label: 'Every hour', seconds: 60 * 60 },
  { label: 'Every 6 hours', seconds: 6 * 60 * 60 },
  { label: 'Every day', seconds: 24 * 60 * 60 },
]

function timeUntil(iso) {
  if (!iso) return 'pending'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'due now'
  const secs = Math.round(diff / 1000)
  if (secs < 60) return `in ${secs}s`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `in ${hrs}h`
  return `in ${Math.round(hrs / 24)}d`
}

function timeAgo(iso) {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([])
  const [goal, setGoal] = useState('')
  const [intervalSeconds, setIntervalSeconds] = useState(INTERVALS[1].seconds)
  const [creating, setCreating] = useState(false)
  const [runningNowId, setRunningNowId] = useState(null)
  const [error, setError] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const res = await api.listAutomations()
      if (res?.automations) {
        setAutomations(res.automations)
        setIsLive(true)
        setError(null)
      }
    } catch (e) {
      setIsLive(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    if (!goal.trim() || creating) return
    setCreating(true)
    setError(null)
    try {
      await api.createAutomation(goal.trim(), intervalSeconds)
      setGoal('')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function toggle(a) {
    try {
      await api.setAutomationEnabled(a.id, !a.enabled)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(a) {
    try {
      await api.deleteAutomation(a.id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function runNow(a) {
    setRunningNowId(a.id)
    setError(null)
    try {
      const res = await api.runAutomationNow(a.id)
      await load()
      if (res?.last_run_id) {
        navigate(`/workflow/${res.last_run_id}`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setRunningNowId(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1160px] px-5 pb-16 pt-10 sm:px-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-lime">
          <CalendarClock size={13} />SCHEDULED AGENTS
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[#eee]">Background Automations</h1>
        <p className="mt-2 text-sm text-[#85867f]">
          Delegate goals to run on a repeating interval. The engine executes the full Planner → Executor → Critic loop autonomously in the background.
        </p>
      </div>

      <form onSubmit={handleCreate} className="mb-8 rounded-2xl border border-line bg-[#171815] p-5 shadow-lg">
        <label htmlFor="auto-goal" className="mb-2.5 block text-xs font-semibold text-[#deded7]">
          Schedule a new recurring workflow
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="auto-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Triage overdue invoices and draft follow-up emails..."
            className="min-h-[44px] flex-1 rounded-xl border border-line bg-[#11120f] px-3.5 text-xs text-white outline-none placeholder:text-[#686963] focus:border-lime/40"
          />
          <select
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value))}
            className="h-11 rounded-xl border border-line bg-[#11120f] px-3 font-mono text-xs text-[#d2d2cb] outline-none"
          >
            {INTERVALS.map((opt) => (
              <option key={opt.seconds} value={opt.seconds}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={creating || !goal.trim()} loading={creating} className="shrink-0 px-5">
            <Plus size={14} />Create Schedule
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-line bg-[#171815]">
        <div className="flex items-center justify-between border-b border-line bg-[#1a1b18] px-5 py-3">
          <span className="text-[9px] font-bold tracking-[.13em] text-[#73746d]">SCHEDULED GOALS</span>
          <span className="text-[10px] text-[#70716a]">{automations.length} ACTIVE</span>
        </div>

        {automations.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-line bg-[#1d1e1a] text-[#797a73]">
              <CalendarClock size={20} />
            </span>
            <h3 className="text-sm font-semibold text-[#ddd]">No automations scheduled yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-[#777871]">
              Set up a goal above to run on a repeating cadence without manual triggers.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {automations.map((a) => {
              const isRunningThis = runningNowId === a.id
              return (
                <div key={a.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                        a.enabled ? 'bg-lime/10 text-lime' : 'bg-white/[.04] text-[#888]'
                      }`}>
                        {a.enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                      <span className="font-mono text-[10px] text-[#70716b]">{a.id}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-[#eaeae3]">{a.goal}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[#7e7f78]">
                      <span>Interval: {INTERVALS.find((i) => i.seconds === a.interval_seconds)?.label || `${a.interval_seconds}s`}</span>
                      <span>Next: {a.enabled ? timeUntil(a.next_run_at) : 'paused'}</span>
                      <span>Last run: {timeAgo(a.last_run_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(a)}
                      title={a.enabled ? 'Pause schedule' : 'Resume schedule'}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-[#11120f] px-3 py-1.5 text-[11px] text-[#ccc] hover:border-lime/40 hover:text-white"
                    >
                      {a.enabled ? <Pause size={12} /> : <Play size={12} className="text-lime" />}
                      {a.enabled ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => runNow(a)}
                      disabled={isRunningThis}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-[#11120f] px-3 py-1.5 text-[11px] text-lime hover:border-lime/40 disabled:opacity-50"
                    >
                      {isRunningThis ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {isRunningThis ? 'Running...' : 'Run now'}
                    </button>
                    <button
                      onClick={() => remove(a)}
                      title="Delete automation"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-[#11120f] text-[#888] hover:border-red-400/40 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
