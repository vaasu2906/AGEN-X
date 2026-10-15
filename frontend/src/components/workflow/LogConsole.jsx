import { Activity, CheckCircle2, CircleAlert, Terminal } from 'lucide-react'

const tones = {
  system: 'text-[#a6a79f]',
  agent: 'text-blue-200',
  success: 'text-emerald-300',
  approval: 'text-amber-200',
  error: 'text-red-300',
}
const icons = { system: Terminal, agent: Activity, success: CheckCircle2, approval: CircleAlert, error: CircleAlert }

export default function LogConsole({ logs = [], running }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-[#171815]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#e8e8e1]"><Terminal size={15} className="text-lime" />Agent console</div>
        <span className="flex items-center gap-1.5 text-[10px] text-[#777871]"><span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-lime' : 'bg-[#666]'}`} />{running ? 'LIVE STREAM' : 'RUN LOG'}</span>
      </div>
      <div className="max-h-[340px] space-y-4 overflow-y-auto p-4">
        {logs.map((log, index) => {
          const Icon = icons[log.type] || Terminal
          return <div key={`${log.time}-${index}`} className="flex gap-3">
            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-[#62635e]">{log.time}</span>
            <Icon size={13} className={`mt-0.5 shrink-0 ${tones[log.type] || tones.system}`} />
            <p className={`text-[12px] leading-[1.65] ${tones[log.type] || tones.system}`}>{log.text}</p>
          </div>
        })}
        {running && <div className="ml-[78px] flex items-center gap-1"><i className="h-1 w-1 animate-bounce rounded-full bg-lime [animation-delay:-.2s]" /><i className="h-1 w-1 animate-bounce rounded-full bg-lime [animation-delay:-.1s]" /><i className="h-1 w-1 animate-bounce rounded-full bg-lime" /></div>}
      </div>
    </section>
  )
}
