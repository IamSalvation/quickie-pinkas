import { useEffect, useState, useCallback } from 'react'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import { supabase } from '../../lib/supabase'
import { listGroupParticipants, bulkAssignToGroup } from '../../lib/api/groups'
import type { GroupWithParent, Participant } from '../../types/db'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  group: GroupWithParent
}

export default function AssignParticipantsModal({
  open,
  onClose,
  onSaved,
  group,
}: Props) {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentlyInGroup, setCurrentlyInGroup] = useState<Participant[]>([])
  const [available, setAvailable] = useState<Participant[]>([])
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)

    // Participants already in this group
    const { data: inGroup, error: err1 } = await listGroupParticipants(group.id)
    if (err1) {
      setError(err1)
      setLoading(false)
      return
    }
    setCurrentlyInGroup(inGroup)

    // Participants available to assign (not in this group)
    const { data: all, error: err2 } = await supabase
      .from('participants')
      .select('*')
      .eq('account_id', account.id)
      .order('full_name')

    if (err2) {
      setError(err2.message)
      setLoading(false)
      return
    }

    const inGroupIds = new Set(inGroup.map((p) => p.id))
    const avail = (all ?? []).filter((p) => !inGroupIds.has(p.id))
    setAvailable(avail as Participant[])
    setSelectedToAdd(new Set())
    setLoading(false)
  }, [account, group.id])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  function toggleSelect(id: string) {
    setSelectedToAdd((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAdd() {
    if (selectedToAdd.size === 0) return
    setSaving(true)
    setError(null)

    const { error: err } = await bulkAssignToGroup(
      Array.from(selectedToAdd),
      group.id
    )

    setSaving(false)

    if (err) {
      setError(err)
      return
    }

    onSaved()
    onClose()
  }

  async function handleRemove(participantId: string) {
    setSaving(true)
    setError(null)

    const { error: err } = await bulkAssignToGroup([participantId], null)

    setSaving(false)

    if (err) {
      setError(err)
      return
    }

    onSaved()
    load()
  }

  const filteredAvailable = available.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.system_id.toLowerCase().includes(q) ||
      (p.external_id?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={'Assign ' + preset.labels.participants + ' to ' + group.name}
      size="lg"
    >
      {loading ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Currently in group */}
          <div>
            <h3 className="text-sm font-medium text-slate-900 mb-2">
              Currently in {group.name} ({currentlyInGroup.length})
            </h3>
            {currentlyInGroup.length === 0 ? (
              <p className="text-xs text-slate-500">
                No {preset.labels.participants.toLowerCase()} in this{' '}
                {preset.labels.group.toLowerCase()} yet.
              </p>
            ) : (
              <ul className="max-h-40 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
                {currentlyInGroup.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-slate-800">{p.full_name}</span>
                    <button
                      onClick={() => handleRemove(p.id)}
                      disabled={saving}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add new */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-medium text-slate-900 mb-2">
              Add {preset.labels.participants.toLowerCase()} ({selectedToAdd.size} selected)
            </h3>

            <input
              type="text"
              placeholder={
                'Search ' + preset.labels.participants.toLowerCase() + '...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />

            {filteredAvailable.length === 0 ? (
              <p className="text-xs text-slate-500">
                {search
                  ? 'No matches.'
                  : 'All ' +
                    preset.labels.participants.toLowerCase() +
                    ' are already in this ' +
                    preset.labels.group.toLowerCase() +
                    '.'}
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto rounded border border-slate-200 divide-y divide-slate-100">
                {filteredAvailable.map((p) => {
                  const checked = selectedToAdd.has(p.id)
                  return (
                    <li
                      key={p.id}
                      className={
                        'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ' +
                        (checked ? 'bg-slate-50' : '')
                      }
                      onClick={() => toggleSelect(p.id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(p.id)}
                        className="shrink-0"
                      />
                      <span className="text-slate-800 flex-1 truncate">
                        {p.full_name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {p.system_id}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || selectedToAdd.size === 0}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving
                ? 'Adding...'
                : 'Add ' + selectedToAdd.size + ' ' + (selectedToAdd.size === 1 ? preset.labels.participant.toLowerCase() : preset.labels.participants.toLowerCase())}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}