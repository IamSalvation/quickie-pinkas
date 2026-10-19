import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/ui/Modal'
import {
  createProgram,
  type Program,
  type ProgramType,
  type ProgramScope,
} from '../../lib/api/programs'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import { listTerms, type Term } from '../../lib/api/terms'
import { listGroups } from '../../lib/api/groups'
import type { GroupWithParent } from '../../types/db'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (p: Program) => void
}

const TYPE_OPTIONS: { value: ProgramType; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'track', label: 'Track' },
  { value: 'cohort', label: 'Cohort' },
  { value: 'room', label: 'Room' },
  { value: 'service', label: 'Service' },
  { value: 'group', label: 'Group' },
  { value: 'custom', label: 'Custom' },
]

export default function CreateProgramModal({ open, onClose, onCreated }: Props) {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)
  const hasTerms = preset.features.terms
  const isUniversity = account?.preset === 'university'

  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [type, setType] = useState<ProgramType>('course')
  const [description, setDescription] = useState('')
  
  const [termId, setTermId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [scope, setScope] = useState<ProgramScope>('group')

  const [terms, setTerms] = useState<Term[]>([])
  const [groups, setGroups] = useState<GroupWithParent[]>([])

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Load terms and groups when opening
  useEffect(() => {
    if (!open || !account) return
    
    async function loadData() {
      if (hasTerms) {
        const { data: t } = await listTerms(account!.id)
        setTerms(t)
        // Auto-select active term if there is one
        const active = t.find((x) => x.status === 'active')
        if (active) setTermId(active.id)
        else if (t.length > 0) setTermId(t[0].id)
      }
      
      const { data: g } = await listGroups(account!.id)
      setGroups(g)
    }
    
    loadData()
  }, [open, account, hasTerms])

  function reset() {
    setName('')
    setCode('')
    setType('course')
    setDescription('')
    setTermId('')
    setGroupId('')
    setScope('group')
    setError(null)
    setSubmitting(false)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!account) return

    setError(null)
    setSubmitting(true)

    const { data, error: err } = await createProgram({
      accountId: account.id,
      name,
      code: code || null,
      type,
      description: description || null,
      termId: hasTerms && termId ? termId : null,
      groupId: scope === 'group' && groupId ? groupId : null,
      scope: groupId ? scope : (scope === 'general' ? 'general' : null),
    })

    setSubmitting(false)

    if (err || !data) {
      setError(err ?? 'Could not create')
      return
    }

    onCreated(data)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={'New ' + preset.labels.program}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isUniversity ? 'e.g. CHM 101' : 'e.g. Mathematics'}
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. MTH101"
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProgramType)}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasTerms && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isUniversity ? 'Semester' : 'Term'} <span className="text-red-500">*</span>
            </label>
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              required
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">Select a {isUniversity ? 'semester' : 'term'}...</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.status === 'active' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Who is this for?
          </label>
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === 'general'}
                onChange={() => { setScope('general'); setGroupId('') }}
              />
              Everyone (General)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === 'group'}
                onChange={() => setScope('group')}
              />
              Specific {preset.labels.group}
            </label>
          </div>

          {scope === 'group' && (
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              className="mt-2 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">Select a {preset.labels.group.toLowerCase()}...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create ' + preset.labels.program}
          </button>
        </div>
      </form>
    </Modal>
  )
}