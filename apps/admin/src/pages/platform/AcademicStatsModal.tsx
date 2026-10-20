import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import { getAccountTerms, platformOverrideActiveTerm } from '../../lib/api/platform'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  accountId: string
  currentActiveTermId: string | null
}

export default function AcademicStatsModal({ open, onClose, onSaved, accountId, currentActiveTermId }: Props) {
  const [terms, setTerms] = useState<{id: string, name: string}[]>([])
  const [selectedTermId, setSelectedTermId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    async function load() {
      setLoading(true)
      const { data } = await getAccountTerms(accountId)
      setTerms(data ?? [])
      setSelectedTermId(currentActiveTermId || '')
      setLoading(false)
    }
    load()
  }, [open, accountId, currentActiveTermId])

  async function handleSave() {
    setSaving(true)
    await platformOverrideActiveTerm(accountId, selectedTermId || null)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Override Academic Structure">
      <div className="space-y-4">
        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <strong>Platform Admin Action:</strong> You are about to change the active term for this school. This will affect their dashboards and what they see as "current".
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading terms...</p>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Force Active Term
            </label>
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">None (Force all terms to end)</option>
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Selecting a term will automatically end any other active term.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button onClick={onClose} disabled={saving} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
          <button onClick={handleSave} disabled={saving || loading} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}