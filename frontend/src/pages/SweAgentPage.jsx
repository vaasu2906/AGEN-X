import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Code,
  ExternalLink,
  FileCode,
  GitBranch,
  GitFork,
  GitPullRequest,
  Key,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
  User,
} from 'lucide-react'
import api from '../lib/api'

const TOKEN_KEY = 'agentic-github-token'

export default function SweAgentPage() {
  const [issueUrl, setIssueUrl] = useState('')
  const [githubToken, setGithubToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || ''
    } catch {
      return ''
    }
  })
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [tempToken, setTempToken] = useState(githubToken)
  const [currentUser, setCurrentUser] = useState(null)
  const [isCheckingUser, setIsCheckingUser] = useState(false)

  const [runs, setRuns] = useState([])
  const [activeRunId, setActiveRunId] = useState(null)
  const [activeRun, setActiveRun] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState('console') // 'console' | 'diff' | 'pr'

  // HITL state
  const [autoMerge, setAutoMerge] = useState(true)
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isMerging, setIsMerging] = useState(false)

  const terminalEndRef = useRef(null)

  // Verify GitHub token
  useEffect(() => {
    let mounted = true
    async function verify() {
      if (!githubToken) {
        setCurrentUser(null)
        return
      }
      setIsCheckingUser(true)
      try {
        const res = await api.checkGithubUser(githubToken)
        if (mounted) {
          if (res.authenticated) {
            setCurrentUser(res)
          } else {
            setCurrentUser(null)
          }
        }
      } catch {
        if (mounted) setCurrentUser(null)
      } finally {
        if (mounted) setIsCheckingUser(false)
      }
    }
    verify()
    return () => {
      mounted = false
    }
  }, [githubToken])

  // Save token helper
  function saveToken(tok) {
    const clean = tok.trim()
    setGithubToken(clean)
    setTempToken(clean)
    try {
      localStorage.setItem(TOKEN_KEY, clean)
    } catch {
      /* ignore */
    }
    setShowTokenModal(false)
  }

  // Load runs list
  async function fetchRuns() {
    try {
      const res = await api.listSweRuns()
      const list = res.runs || []
      setRuns(list)
      if (list.length > 0 && !activeRunId) {
        setActiveRunId(list[0].run_id)
      }
    } catch (e) {
      console.warn('Could not list SWE runs:', e)
    }
  }

  useEffect(() => {
    fetchRuns()
  }, [])

  // Poll active run if running or awaiting_approval
  useEffect(() => {
    if (!activeRunId) return
    let intervalId = null
    let mounted = true

    async function loadActive() {
      try {
        const data = await api.getSweRun(activeRunId)
        if (mounted) {
          setActiveRun(data)
          // Also update list entry
          setRuns((prev) =>
            prev.map((r) => (r.run_id === activeRunId ? { ...r, ...data } : r))
          )
        }
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalId) clearInterval(intervalId)
        }
      } catch (e) {
        console.warn('Failed to load active SWE run:', e)
      }
    }

    loadActive()
    intervalId = setInterval(loadActive, 2000)

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [activeRunId])

  // Scroll to bottom of terminal log
  useEffect(() => {
    if (activeTab === 'console' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeRun?.logs, activeTab])

  // Submit new resolution
  async function handleSubmit(e) {
    e.preventDefault()
    if (!issueUrl.trim()) return
    setErrorMsg('')
    setIsSubmitting(true)

    try {
      const initial = await api.resolveSweIssue(issueUrl.trim(), githubToken)
      setRuns((prev) => [initial, ...prev])
      setActiveRunId(initial.run_id)
      setActiveRun(initial)
      setIssueUrl('')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to trigger SWE Agent')
    } finally {
      setIsSubmitting(false)
    }
  }

  // HITL: Approve action
  async function handleApprove() {
    if (!activeRunId) return
    setIsApproving(true)
    setErrorMsg('')
    try {
      const updated = await api.approveSweRun(activeRunId, autoMerge)
      setActiveRun(updated)
      setRuns((prev) =>
        prev.map((r) => (r.run_id === activeRunId ? { ...r, ...updated } : r))
      )
    } catch (err) {
      setErrorMsg(err.message || 'Failed to approve fix')
    } finally {
      setIsApproving(false)
    }
  }

  // HITL: Reject action
  async function handleReject() {
    if (!activeRunId) return
    setIsRejecting(true)
    setErrorMsg('')
    try {
      const updated = await api.rejectSweRun(activeRunId, 'Rejected by human reviewer')
      setActiveRun(updated)
      setRuns((prev) =>
        prev.map((r) => (r.run_id === activeRunId ? { ...r, ...updated } : r))
      )
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reject fix')
    } finally {
      setIsRejecting(false)
    }
  }

  // Merge PR manually
  async function handleMerge() {
    if (!activeRunId) return
    setIsMerging(true)
    setErrorMsg('')
    try {
      const updated = await api.mergeSweRunPr(activeRunId)
      setActiveRun(updated)
      setRuns((prev) =>
        prev.map((r) => (r.run_id === activeRunId ? { ...r, ...updated } : r))
      )
    } catch (err) {
      setErrorMsg(err.message || 'Failed to merge Pull Request')
    } finally {
      setIsMerging(false)
    }
  }

  const isAwaitingApproval = activeRun?.status === 'awaiting_approval'
  const isRunning = activeRun?.status === 'running'

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/10 text-lime">
              <GitPullRequest size={18} />
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#f0f0e9]">
              Autonomous SWE Agent
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#92938d]">
            Autonomous issue solver with Human-in-the-Loop review: forks, clones, synthesizes verified fixes, requests approval, and merges the Pull Request.
          </p>
        </div>

        {/* GitHub Account Badge */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3 rounded-full border border-lime/30 bg-[#162215] px-3.5 py-1.5 text-xs">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.login}
                  className="h-5 w-5 rounded-full"
                />
              ) : (
                <User size={14} className="text-lime" />
              )}
              <span className="font-medium text-[#d1d1ca]">
                @{currentUser.login}
              </span>
              <button
                onClick={() => setShowTokenModal(true)}
                className="text-[11px] text-[#8e9087] underline hover:text-white"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTokenModal(true)}
              className="flex items-center gap-2 rounded-full border border-line bg-[#171815] px-4 py-2 text-xs font-medium text-[#d1d1ca] transition hover:border-lime/40 hover:bg-white/[.04]"
            >
              <Key size={14} className="text-lime" />
              <span>Connect GitHub Token</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Side: Input & Run list */}
        <div className="space-y-6 lg:col-span-4">
          {/* Issue Input Card */}
          <div className="rounded-2xl border border-line bg-[#141512] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-white">Resolve Open Source Issue</h2>
            <p className="mt-0.5 text-xs text-[#8e9087]">
              Enter the GitHub issue URL to begin autonomous triage & resolution.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#b6b7af]">
                  GitHub Issue URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo/issues/42"
                  value={issueUrl}
                  onChange={(e) => setIssueUrl(e.target.value)}
                  required
                  className="w-full rounded-xl border border-line bg-[#1b1c19] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5c54] outline-none transition focus:border-lime"
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 text-xs text-red-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !issueUrl.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime py-2.5 text-xs font-bold text-[#141512] transition hover:brightness-105 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Initializing SWE Loop...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>Run SWE Agent</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Historical Runs List */}
          <div className="rounded-2xl border border-line bg-[#141512] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">SWE Run History</h2>
              <button
                onClick={fetchRuns}
                title="Refresh history"
                className="text-[#8e9087] hover:text-white"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {runs.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#71736b]">
                No SWE tasks yet. Enter a GitHub issue above to launch resolution!
              </p>
            ) : (
              <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                {runs.map((r) => {
                  const isSelected = r.run_id === activeRunId
                  const isDone = r.status === 'completed'
                  const isFailed = r.status === 'failed'
                  const isWaiting = r.status === 'awaiting_approval'

                  return (
                    <div
                      key={r.run_id}
                      onClick={() => setActiveRunId(r.run_id)}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        isSelected
                          ? 'border-lime/40 bg-white/[.04]'
                          : 'border-line/70 bg-[#171815] hover:border-line'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-lime">
                          #{r.issue_number || r.run_id.slice(4, 10)}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            isDone
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isFailed
                              ? 'bg-red-500/10 text-red-400'
                              : isWaiting
                              ? 'bg-amber-500/15 text-amber-400 animate-pulse'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {r.status === 'awaiting_approval' ? 'Approval Required' : r.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs font-medium text-white">
                        {r.issue_title || (r.owner ? `${r.owner}/${r.repo}` : r.issue_url)}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-[#71736b]">
                        <span>
                          {new Date(r.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {r.is_merged && (
                          <span className="font-semibold text-emerald-400">Merged</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active SWE Task View */}
        <div className="lg:col-span-8">
          {activeRun ? (
            <div className="space-y-6">
              {/* Task Header Box */}
              <div className="rounded-2xl border border-line bg-[#141512] p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-lime">
                        {activeRun.owner}/{activeRun.repo} #{activeRun.issue_number}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          activeRun.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : activeRun.status === 'failed'
                            ? 'bg-red-500/15 text-red-400'
                            : activeRun.status === 'awaiting_approval'
                            ? 'bg-amber-500/20 text-amber-300 animate-pulse border border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-400'
                        }`}
                      >
                        {activeRun.status === 'awaiting_approval' ? 'Human Review Required' : activeRun.status}
                      </span>
                      {activeRun.is_merged && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                          <Check size={11} /> Merged
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-white">
                      {activeRun.issue_title || 'Analyzing Issue...'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    {activeRun.pr_url && (
                      <a
                        href={activeRun.pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-lime px-4 py-2 text-xs font-bold text-[#141512] transition hover:brightness-105"
                      >
                        <GitPullRequest size={15} />
                        <span>Pull Request #{activeRun.pr_number}</span>
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>

                {/* 8-Step Visual Pipeline */}
                <div className="mt-6 border-t border-line/60 pt-5">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                    {(activeRun.steps || []).map((step, idx) => {
                      const isComplete = step.status === 'completed'
                      const isRunningStep = step.status === 'in_progress'
                      const isWaitingStep = step.status === 'awaiting_approval'
                      const isFailedStep = step.status === 'failed'

                      return (
                        <div
                          key={step.name}
                          className={`flex flex-col rounded-xl border p-2.5 transition ${
                            isComplete
                              ? 'border-emerald-500/30 bg-emerald-950/10'
                              : isWaitingStep
                              ? 'border-amber-400/50 bg-amber-950/20 shadow-sm shadow-amber-500/10 animate-pulse'
                              : isRunningStep
                              ? 'border-lime/60 bg-lime/[.06]'
                              : isFailedStep
                              ? 'border-red-500/40 bg-red-950/10'
                              : 'border-line/60 bg-[#181916]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-[#71736b]">
                              0{idx + 1}
                            </span>
                            {isComplete ? (
                              <CheckCircle2 size={13} className="text-emerald-400" />
                            ) : isWaitingStep ? (
                              <ShieldAlert size={13} className="text-amber-300" />
                            ) : isRunningStep ? (
                              <RefreshCw size={13} className="animate-spin text-lime" />
                            ) : isFailedStep ? (
                              <AlertCircle size={13} className="text-red-400" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-[#383a31]" />
                            )}
                          </div>
                          <span className="mt-1.5 text-[11px] font-semibold text-white leading-tight">
                            {step.label}
                          </span>
                          <span className="mt-1 text-[10px] text-[#8e9087] truncate">
                            {step.details || (isWaitingStep ? 'Review Required' : isRunningStep ? 'Running...' : 'Pending')}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* HUMAN-IN-THE-LOOP APPROVAL CARD */}
              {isAwaitingApproval && (
                <div className="rounded-2xl border-2 border-amber-400/30 bg-[#191913] p-6 shadow-xl shadow-amber-500/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
                        <ShieldAlert size={20} />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">
                            Human-in-the-Loop Review & Approval Required
                          </h3>
                          <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                            Action Pending
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#a9aa9f] leading-relaxed">
                          The agent has synthesized and verified a fix for this open-source contribution. Please inspect the target file and code diff below before approving PR submission and merge.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary of Changes Box */}
                  <div className="mt-5 rounded-xl border border-line bg-[#121310] p-4 text-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[#8e9087]">Target File:</span>
                        <code className="rounded bg-white/[.06] px-2 py-0.5 font-mono text-lime font-semibold">
                          {activeRun.target_file || 'core/domain/feedback_services.py'}
                        </code>
                      </div>
                      <button
                        onClick={() => setActiveTab('diff')}
                        className="text-xs text-lime underline hover:brightness-110"
                      >
                        View Full Diff in Tab &rarr;
                      </button>
                    </div>

                    {activeRun.reasoning && (
                      <div>
                        <span className="text-[11px] font-semibold text-[#8e9087]">Reasoning & Approach:</span>
                        <p className="mt-1 text-xs text-[#d6d6cf] leading-relaxed">
                          {activeRun.reasoning}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Approval Actions */}
                  <div className="mt-6 flex flex-col justify-between gap-4 border-t border-line/60 pt-4 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2.5 text-xs text-[#d1d1ca] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoMerge}
                        onChange={(e) => setAutoMerge(e.target.checked)}
                        className="h-4 w-4 rounded border-line bg-[#1b1c19] text-lime focus:ring-lime"
                      />
                      <span>Automatically merge Pull Request once opened</span>
                    </label>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={isRejecting || isApproving}
                        className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-950/40 disabled:opacity-50"
                      >
                        {isRejecting ? 'Rejecting...' : 'Reject Fix'}
                      </button>

                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={isApproving || isRejecting}
                        className="flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 text-xs font-bold text-[#141512] transition hover:brightness-105 disabled:opacity-50 shadow-md shadow-lime/20"
                      >
                        {isApproving ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Approving & Merging...</span>
                          </>
                        ) : (
                          <>
                            <Check size={15} />
                            <span>Approve & Submit / Merge PR</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs for Console, Diff, PR info */}
              <div className="rounded-2xl border border-line bg-[#141512] overflow-hidden">
                <div className="flex border-b border-line bg-[#10110f] px-4">
                  <button
                    onClick={() => setActiveTab('console')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      activeTab === 'console'
                        ? 'border-lime text-lime'
                        : 'border-transparent text-[#92938d] hover:text-white'
                    }`}
                  >
                    <Terminal size={14} />
                    <span>Agent Console</span>
                    {activeRun.logs?.length > 0 && (
                      <span className="rounded-full bg-white/[.08] px-1.5 py-0.2 text-[10px]">
                        {activeRun.logs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('diff')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      activeTab === 'diff'
                        ? 'border-lime text-lime'
                        : 'border-transparent text-[#92938d] hover:text-white'
                    }`}
                  >
                    <Code size={14} />
                    <span>Code Diff</span>
                    {activeRun.diff && (
                      <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('pr')}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
                      activeTab === 'pr'
                        ? 'border-lime text-lime'
                        : 'border-transparent text-[#92938d] hover:text-white'
                    }`}
                  >
                    <GitPullRequest size={14} />
                    <span>PR & Merge Status</span>
                    {activeRun.is_merged && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                </div>

                {/* Tab 1: Terminal Console */}
                {activeTab === 'console' && (
                  <div className="h-[420px] overflow-y-auto bg-[#0d0e0c] p-4 font-mono text-xs">
                    {(activeRun.logs || []).length === 0 ? (
                      <p className="text-[#5a5c54]">Workflow initializing...</p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeRun.logs.map((log, i) => {
                          const isErr = log.level === 'error'
                          const isWarn = log.level === 'warning'
                          const isSucc = log.level === 'success'

                          return (
                            <div key={i} className="flex items-start gap-2.5 leading-relaxed">
                              <span className="text-[#5a5c54] shrink-0">{log.timestamp}</span>
                              <span
                                className={
                                  isErr
                                    ? 'text-red-400 font-semibold'
                                    : isWarn
                                    ? 'text-amber-300'
                                    : isSucc
                                    ? 'text-lime font-semibold'
                                    : 'text-[#d6d6cf]'
                                }
                              >
                                {log.message}
                              </span>
                            </div>
                          )
                        })}
                        <div ref={terminalEndRef} />
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Code Diff */}
                {activeTab === 'diff' && (
                  <div className="h-[420px] overflow-y-auto bg-[#0d0e0c] p-4 font-mono text-xs text-[#d6d6cf]">
                    {activeRun.diff ? (
                      <pre className="whitespace-pre-wrap leading-relaxed">
                        {activeRun.diff.split('\n').map((line, idx) => {
                          let color = 'text-[#d6d6cf]'
                          if (line.startsWith('+') && !line.startsWith('+++'))
                            color = 'text-emerald-400 bg-emerald-950/20'
                          else if (line.startsWith('-') && !line.startsWith('---'))
                            color = 'text-red-400 bg-red-950/20'
                          else if (line.startsWith('@@')) color = 'text-sky-400'
                          return (
                            <div key={idx} className={color}>
                              {line}
                            </div>
                          )
                        })}
                      </pre>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-[#71736b]">
                        <FileCode size={32} className="mb-2 opacity-50" />
                        <p>No staged changes or diff generated yet.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: PR & Merge Status */}
                {activeTab === 'pr' && (
                  <div className="h-[420px] overflow-y-auto p-6 text-xs text-[#d6d6cf] space-y-5">
                    {activeRun.pr_url ? (
                      <>
                        <div className="flex items-center justify-between rounded-xl border border-line bg-[#171815] p-4">
                          <div>
                            <span className="text-[11px] font-semibold text-[#8e9087]">
                              Pull Request Status
                            </span>
                            <div className="mt-1 flex items-center gap-2">
                              <span
                                className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                                  activeRun.is_merged
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-lime/15 text-lime'
                                }`}
                              >
                                {activeRun.is_merged ? 'Merged into Upstream' : 'Open / Active'}
                              </span>
                              {activeRun.merged_at && (
                                <span className="text-[11px] text-[#8e9087]">
                                  Merged on {new Date(activeRun.merged_at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {!activeRun.is_merged && (
                            <button
                              onClick={handleMerge}
                              disabled={isMerging}
                              className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black transition hover:brightness-105 disabled:opacity-50"
                            >
                              {isMerging ? 'Merging...' : 'Merge Pull Request'}
                            </button>
                          )}
                        </div>

                        <div className="rounded-xl border border-line bg-[#171815] p-4">
                          <span className="text-[11px] font-semibold text-[#8e9087]">
                            Pull Request Title
                          </span>
                          <p className="mt-1 text-sm font-bold text-white">
                            {activeRun.pr_title || `Fix #${activeRun.issue_number}: ${activeRun.issue_title}`}
                          </p>
                        </div>

                        <div className="rounded-xl border border-line bg-[#171815] p-4">
                          <span className="text-[11px] font-semibold text-[#8e9087]">
                            Upstream Target & Branch
                          </span>
                          <p className="mt-1 font-mono text-xs text-lime">
                            {activeRun.owner}/{activeRun.repo}:{activeRun.target_default_branch || 'main'} &larr; {activeRun.branch_name || `fix-issue-${activeRun.issue_number}`}
                          </p>
                        </div>

                        <a
                          href={activeRun.pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-lime px-4 py-2.5 font-bold text-[#141512] hover:brightness-105"
                        >
                          <ExternalLink size={14} />
                          <span>View Pull Request #{activeRun.pr_number} on GitHub</span>
                        </a>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-[#71736b]">
                        <GitPullRequest size={32} className="mb-2 opacity-50" />
                        <p>Pull Request will be displayed once Human-in-the-Loop review is approved.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-[450px] flex-col items-center justify-center rounded-2xl border border-line bg-[#141512] p-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime/10 text-lime">
                <Sparkles size={24} />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-white">
                Ready for Open-Source Contributions
              </h3>
              <p className="mt-1 max-w-md text-xs text-[#8e9087]">
                Provide any GitHub issue link on the left to watch the agent fork, clone, inspect, synthesize fixes, run tests, pause for human approval, and merge the Pull Request.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GitHub Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-[#161713] p-6 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/10 text-lime">
                <Key size={16} />
              </span>
              <h3 className="text-base font-bold text-white">Configure GitHub Token</h3>
            </div>
            <p className="mt-2 text-xs text-[#8e9087] leading-relaxed">
              Your Personal Access Token (PAT) with <code className="text-lime">repo</code> scope allows the SWE agent to fork the repo and open Pull Requests directly under your GitHub account.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#b6b7af]">
                Personal Access Token (classic or fine-grained)
              </label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                className="w-full rounded-xl border border-line bg-[#1b1c19] px-3.5 py-2.5 text-xs text-white placeholder-[#5a5c54] outline-none focus:border-lime"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[#8e9087] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveToken(tempToken)}
                className="rounded-xl bg-lime px-4 py-2 text-xs font-bold text-[#141512] hover:brightness-105"
              >
                Save Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
