import { ShieldAlert } from 'lucide-react'
import Button from '../common/Button'
import Modal from '../common/Modal'
import StatusBadge from '../common/StatusBadge'

export default function ApprovalModal({ step, open, onApprove, onReject }) {
  return (
    <Modal open={open} title="Review this action" dismissible={false}>
      {step && <>
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[.05] p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><ShieldAlert size={19} /></span>
          <div><p className="text-sm font-semibold text-[#f2eee2]">Your approval is required</p><p className="mt-0.5 text-xs text-[#aaa59a]">This step can make changes outside this workflow.</p></div>
        </div>
        <div className="rounded-xl border border-line bg-[#11120f] p-4">
          <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-bold tracking-widest text-[#85867f]">ACTION PREVIEW</span><StatusBadge status="HIGH" /></div>
          <p className="mb-2 text-sm font-medium text-white">{step.description}</p>
          <p className="text-xs leading-5 text-[#969790]">Agent <span className="text-[#d3d3cc]">{step.role}</span> will use <span className="text-[#d3d3cc]">{step.tool}</span> to complete this action.</p>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="danger" className="flex-1" onClick={onReject}>Reject action</Button>
          <Button className="flex-1" onClick={onApprove}>Approve action</Button>
        </div>
        <p className="mt-3 text-center text-[10px] text-[#73746d]">The workflow will pause until you choose an action.</p>
      </>}
    </Modal>
  )
}
