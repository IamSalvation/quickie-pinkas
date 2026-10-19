import { useState, useEffect, useMemo } from 'react'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { addManualAttendance } from '../../lib/api/presence'
import type { Participant } from '../../types/db'
import type { ContextWithProgram } from '../../lib/api/contexts'
import type { ContextOccurrence } from '../../lib/api/occurrences'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  context: ContextWithProgram
  occurrence: ContextOccurrence
  existingParticipantIds: string[]
}

export default function ManualAttendanceModal({
  open,
  onClose,
  onSaved,
  context,
  occurrence,
  existingParticipantIds,
}: Props) {
  const { account, operator } = useAuth()

  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('Forgot Badge')
  const [customReason, setCustomReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !account) return
    setLoading(true)
    setSelectedIds(new Set())
    setSearch('')
    setReason('Forgot Badge')
    setCustomReason('')
    setError(null)

    async function loadRoster() {
      // 1. Try to fetch participants in the group that owns this program
      if (context.program?.group_id) {
        const { data } = await supabase
          .from('participants')
          .select('*')
          .eq('account_id', account!.id)
          .eq('group_id', context.program.group_id)
          .order('full_name')

        if (data && data.length > 0) {
          setParticipants(data as Participant[])
          setLoading(false)
          return
        }
      }

      // 2. Fallback: fetch all participants in the account
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('account_id', account!.id)
        .order('full_name')

      setParticipants((data ?? []) as Participant[])
      setLoading(false)
    }

    loadRoster()
  }, [open, account, context.program])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return participants.filter((p) => {
      // Don't show people who are already present
      if (existingParticipantIds.includes(p.id)) return false
      if (!q) return true
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.system_id.toLowerCase().includes(q) ||
        (p.external_id?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [participants, search, existingParticipantIds])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!account || !operator) return
    if (selectedIds.size === 0) return

    setSaving(true)
    setError(null)

    const finalReason = reason === 'Other' ? customReason.trim() || 'Other' : reason

    let hasError = false
    for (const participantId of Array.from(selectedIds)) {
      const { error: err } = await addManualAttendance(
        account.id,
        participantId,
        context.id,
        occurrence.id,
        operator.id,
        finalReason
      )
      if (err) {
        hasError = true
      }
    }

    setSaving(false)

    if (hasError) {
      setError('Some students could not be added. Please try again.')
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manually add students to ${context.label} - Session ${occurrence.session_number}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
          These students did not scan their badges for this session. Adding them here will mark them as Present.
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Search students
          </label>
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Select students ({selectedIds.size} selected)
          </label>
          <div className="max-h-60 overflow-y-auto rounded border border-slate-200 bg-white divide-y divide-slate-100">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">Loading roster...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No students found. (Everyone might already be marked present).
              </div>
            ) : (
              filtered.map((p) => {
                const checked = selectedIds.has(p.id)
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-slate-50 ${checked ? 'bg-slate-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-slate-900 font-medium">{p.full_name}</span>
                    <span className="text-xs text-slate-500 font-mono">{p.system_id}</span>
                    {p.external_id && <span className="text-xs text-slate-400">({p.external_id})</span>}
                  </label>
                )
              })
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reason
          </label>
          <div className="flex flex-wrap gap-2">
            {['Forgot Badge', 'Kiosk Offline', 'Other'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-3 py-1.5 text-sm rounded border ${reason === r ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === 'Other' && (
            <input
              type="text"
              placeholder="Type a reason..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="mt-2 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || selectedIds.size === 0}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Mark ${selectedIds.size} as Present`}
          </button>
        </div>
      </div>
    </Modal>
  )
}