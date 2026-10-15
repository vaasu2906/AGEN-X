import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, Code2, Database, FileSpreadsheet, Globe2, Mail, Shield, Table2, Terminal, Users, Zap } from 'lucide-react'
import StatusBadge from '../components/common/StatusBadge'
import api from '../lib/api'

const icons = {
  database: Database,
  email: Mail,
  crm: Users,
  spreadsheet: FileSpreadsheet,
  coder: Code2,
  extractor: Terminal,
  table: Table2,
  search: Globe2,
}

const defaultTools = [
  {
    name: 'SQLite Database',
    backendId: 'database',
    category: 'Persistence',
    type: 'Read / Write',
    status: 'CONNECTED',
    description: 'Runs real SQL queries against local tables (data/agentic.db) with contract verification.',
    icon: 'database',
    limit: 'Unlimited (Local)',
    sandbox: 'Auto-seeded invoices schema',
  },
  {
    name: 'Local Outbox & SMTP',
    backendId: 'email',
    category: 'Communication',
    type: 'Write',
    status: 'CONNECTED',
    description: 'Writes verifiable messages to data/outbox.jsonl; auto-switches to SMTP if configured.',
    icon: 'email',
    limit: 'Unlimited (Local)',
    sandbox: 'Audit logging for all sent mail',
  },
  {
    name: 'CRM Store',
    backendId: 'crm',
    category: 'Business Operations',
    type: 'Read / Write',
    status: 'CONNECTED',
    description: 'Persistent contact and deal CRUD operations backed by data/crm.json store.',
    icon: 'crm',
    limit: 'Unlimited (Local)',
    sandbox: 'Guarded write operations',
  },
  {
    name: 'Excel / Spreadsheet',
    backendId: 'spreadsheet',
    category: 'Productivity',
    type: 'Read / Write',
    status: 'CONNECTED',
    description: 'Direct reading and manipulation of Excel workbooks (.xlsx) via openpyxl.',
    icon: 'spreadsheet',
    limit: 'Unlimited (Local)',
    sandbox: 'Gated on high-risk modifications',
  },
  {
    name: 'Sovereign Coder (LLM)',
    backendId: 'coder',
    category: 'Code Generation',
    type: 'Exec',
    status: 'CONNECTED',
    description: 'Generates SQL, formulas, and scripts via Qwen2.5-Coder / DeepSeek-Coder-V2 with fallback.',
    icon: 'coder',
    limit: 'Role-routed gateway',
    sandbox: 'Local model execution',
  },
  {
    name: 'Structured Extractor',
    backendId: 'extractor',
    category: 'NLP & Parsing',
    type: 'Exec',
    status: 'CONNECTED',
    description: 'Extracts structured fields from raw textual documents via Hermes 3 sovereign model.',
    icon: 'extractor',
    limit: 'Role-routed gateway',
    sandbox: 'Deterministic contract checks',
  },
]

export default function ToolsPage() {
  const [activeBackendTools, setActiveBackendTools] = useState([])
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    api.listTools()
      .then((res) => {
        if (res?.tools) {
          setActiveBackendTools(res.tools)
          setIsLive(true)
        }
      })
      .catch(() => {
        setIsLive(false)
      })
  }, [])

  const toolsList = defaultTools.map((t) => ({
    ...t,
    status: isLive && activeBackendTools.includes(t.backendId) ? 'CONNECTED' : (isLive ? 'STANDBY' : 'MOCK'),
  }))

  return (
    <div className="mx-auto max-w-[1160px] px-5 pb-16 pt-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-lime">
            <Zap size={13} />INTEGRATIONS & CONNECTORS
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#eee]">Tools & Pluggable Connectors</h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#85867f]">
            The real local connectors and sovereign model roles available to your ExecutorAgents. Pluggable, audited, and contract-verified.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-[#171815] px-3 py-2">
          <Activity size={13} className="text-lime" />
          <span className="text-[11px] text-[#aaa]">
            {isLive ? `${activeBackendTools.length} live connectors active` : 'Local preview mode'}
          </span>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between border-b border-line pb-3">
        <h2 className="text-xs font-semibold text-[#d8d8d1]">Registered Connectors</h2>
        <span className="text-[10px] text-[#70716a]">{toolsList.length} TOOLS AVAILABLE</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {toolsList.map((tool) => {
          const Icon = icons[tool.icon] || Zap
          return (
            <article key={tool.name} className="flex flex-col justify-between rounded-2xl border border-line bg-[#171815] p-5 transition hover:border-[#414239]">
              <div>
                <div className="mb-4 flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-[#1d1e1a] text-[#deded7]">
                    <Icon size={19} />
                  </span>
                  <StatusBadge status={tool.status} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-[#e8e8e1]">{tool.name}</p>
                    <p className="mt-0.5 text-[10px] text-[#777871]">{tool.category}</p>
                  </div>
                  <span className="rounded-md border border-line bg-[#11120f] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#aaa]">
                    {tool.type.toUpperCase()}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#93948d]">{tool.description}</p>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <Shield size={13} className="mt-0.5 shrink-0 text-[#888981]" />
                    <span>
                      <span className="block text-[9px] uppercase tracking-wider text-[#666760]">Safety</span>
                      <span className="mt-0.5 block text-[10px] text-[#a2a39b]">{tool.sandbox}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Activity size={13} className="mt-0.5 shrink-0 text-[#888981]" />
                    <span>
                      <span className="block text-[9px] uppercase tracking-wider text-[#666760]">Rate limit</span>
                      <span className="mt-0.5 block text-[10px] text-[#a2a39b]">{tool.limit}</span>
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-xl border border-lime/10 bg-lime/[.035] p-4">
        <span className="mt-0.5 text-lime"><Shield size={15} /></span>
        <p className="text-[11px] leading-5 text-[#999a92]">
          <span className="font-semibold text-[#d0d1c9]">Deterministic Safety & Pluggability.</span> Tools are defined declaratively in{' '}
          <code className="rounded bg-white/[.06] px-1 font-mono text-[10px] text-lime">config/tools_config.json</code>. Swapping local connectors for production APIs (Postgres, SendGrid, Salesforce, Google Sheets) requires zero agent code changes.
        </p>
      </div>
    </div>
  )
}
