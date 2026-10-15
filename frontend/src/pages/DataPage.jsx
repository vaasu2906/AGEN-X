import { useEffect, useState } from 'react'
import { Database, FileSpreadsheet, FolderKanban, Mail, RefreshCw, Users } from 'lucide-react'
import api from '../lib/api'

const TABS = [
  { key: 'invoices', label: 'SQLite Invoices', icon: Database, source: 'data/agentic.db' },
  { key: 'crm', label: 'CRM Contacts & Deals', icon: Users, source: 'data/crm.json' },
  { key: 'outbox', label: 'Email Outbox', icon: Mail, source: 'data/outbox.jsonl' },
  { key: 'workbook', label: 'Excel Workbook', icon: FileSpreadsheet, source: 'data/workbook.xlsx' },
]

function Table({ rows, columns }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="py-12 text-center font-mono text-xs text-[#70716b]">
        No rows found in this data source yet.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="border-b border-line bg-[#141512] text-left text-[#7e7f78]">
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-4 py-2.5 font-medium uppercase tracking-wider">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {rows.map((row, i) => (
            <tr key={i} className="text-[#deded7] transition hover:bg-white/[.02]">
              {columns.map((col) => (
                <td key={col} className="whitespace-nowrap px-4 py-2.5">
                  {row[col] === null || row[col] === undefined ? (
                    <span className="text-[#555]">—</span>
                  ) : typeof row[col] === 'object' ? (
                    JSON.stringify(row[col])
                  ) : (
                    String(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DataPage() {
  const [tab, setTab] = useState('invoices')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)

  async function loadData(tabKey = tab) {
    setLoading(true)
    try {
      if (tabKey === 'invoices') {
        const res = await api.getInvoices()
        setData((d) => ({ ...d, invoices: res }))
      } else if (tabKey === 'crm') {
        const res = await api.getCrm()
        setData((d) => ({ ...d, crm: res }))
      } else if (tabKey === 'outbox') {
        const res = await api.getOutbox()
        setData((d) => ({ ...d, outbox: res }))
      } else if (tabKey === 'workbook') {
        const res = await api.getWorkbook()
        setData((d) => ({ ...d, workbook: res }))
      }
    } catch {
      // Backend not running
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(tab)
  }, [tab])

  const current = data[tab]

  return (
    <div className="mx-auto max-w-[1160px] px-5 pb-16 pt-10 sm:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[.16em] text-lime">
            <FolderKanban size={13} />CONNECTOR PERSISTENCE
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[#eee]">Data Explorer</h1>
          <p className="mt-2 text-sm text-[#85867f]">
            Inspect real state persisted by the connectors (SQLite invoices, CRM JSON, Outbox messages, and Excel sheets).
          </p>
        </div>
        <button
          onClick={() => loadData(tab)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-[#171815] px-3.5 py-2 text-xs font-medium text-[#ccc] transition hover:border-lime/30 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-lime' : ''} />
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-[#171815]">
        <div className="flex flex-wrap items-center justify-between border-b border-line bg-[#1a1b18] px-4 pt-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 rounded-t-lg border-t border-x px-3.5 py-2.5 text-xs font-medium transition ${
                    active
                      ? 'border-line bg-[#171815] text-lime font-semibold'
                      : 'border-transparent text-[#888] hover:text-[#ddd]'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </div>
          <span className="py-2 font-mono text-[10px] text-[#6b6c65]">
            Source: {TABS.find((t) => t.key === tab)?.source}
          </span>
        </div>

        <div className="p-1">
          {tab === 'invoices' && (
            <Table
              rows={current?.rows}
              columns={current?.rows?.[0] ? Object.keys(current.rows[0]) : ['id', 'client', 'amount', 'status']}
            />
          )}

          {tab === 'crm' && (
            <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="p-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-lime">Contacts ({current?.contact?.length || 0})</p>
                <Table
                  rows={current?.contact}
                  columns={current?.contact?.[0] ? Object.keys(current.contact[0]) : ['id', 'name', 'email']}
                />
              </div>
              <div className="p-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-lime">Deals ({current?.deal?.length || 0})</p>
                <Table
                  rows={current?.deal}
                  columns={current?.deal?.[0] ? Object.keys(current.deal[0]) : ['id', 'name', 'stage']}
                />
              </div>
            </div>
          )}

          {tab === 'outbox' && (
            <div className="divide-y divide-line p-3">
              {(!current?.messages || current.messages.length === 0) ? (
                <p className="py-12 text-center font-mono text-xs text-[#70716b]">No messages in outbox.jsonl yet.</p>
              ) : (
                current.messages.map((m, idx) => (
                  <div key={idx} className="p-3">
                    <div className="flex flex-wrap items-center justify-between font-mono text-[11px] text-[#888]">
                      <span>To: <strong className="text-white">{m.to || m.recipient || '—'}</strong></span>
                      <span>{m.sent_at || m.timestamp || ''}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#eee]">{m.subject || '(no subject)'}</p>
                    <p className="mt-1 font-mono text-[11px] text-[#aaa]">{m.body || ''}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'workbook' && (
            <div className="space-y-6 p-4">
              {current?.sheets && Object.keys(current.sheets).length > 0 ? (
                Object.entries(current.sheets).map(([sheetName, rows]) => (
                  <div key={sheetName}>
                    <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-lime">{sheetName}</p>
                    <div className="overflow-x-auto rounded-lg border border-line">
                      <table className="w-full border-collapse font-mono text-[11px]">
                        <tbody>
                          {rows.map((row, ri) => (
                            <tr key={ri} className="border-b border-line/50 last:border-0 hover:bg-white/[.02]">
                              {row.map((cell, ci) => (
                                <td key={ci} className="whitespace-nowrap px-3 py-1.5 text-[#ccc]">
                                  {cell === null ? <span className="text-[#555]">—</span> : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center font-mono text-xs text-[#70716b]">Workbook is empty or not created yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
