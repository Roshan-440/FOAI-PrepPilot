import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Fields'

/** Destructive-action confirmation. Stays open (with a spinner) until the action settles. */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="danger" onClick={() => void run()} loading={busy}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
