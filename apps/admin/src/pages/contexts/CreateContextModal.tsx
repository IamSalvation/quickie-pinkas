import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/ui/Modal'
import {
  createContext,
  contextTypesForPreset,
  CONTEXT_TYPE_LABELS,
  type ContextRow,
  type ContextType,
} from '../../lib/api/contexts'
import { listPrograms, type Program } from '../../lib/api/programs'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (c: ContextRow) => void
}

export default function CreateContextModal({ open, onClose, onCreated }: Props) {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)
  const availableTypes = contextTypesForPreset(account?.preset)

  const [label, setLabel] = useState('')
  const [type, setType] = useState<ContextType>(availableTypes[0] ?? 'lecture')
  const [programId, setProgramId] = useState<string>('')
  const [location, setLocation] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [checkoutEnabled, setCheckoutEnabled] = useState(
    preset.features.checkout
  )
  const [idEntryEnabled, setIdEntryEnabled] = useState(false)
  const [isRecurring, setIsRecurring] = useState(true)
  const [programs, setPrograms] = useState<Program[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !account) return
    listPrograms(account.id, { status: 'active', limit: 200 }).then(
      ({ data }) => setPrograms(data)
    )
  }, [open, account])

  function reset() {
    setLabel('')
    setType(availableTypes[0] ?? 'lecture')
    setProgramId('')
    setLocation('')
    setStartsAt('')
    setEndsAt('')
    setCheckoutEnabled(preset.features.checkout)
    setIdEntryEnabled(false)
    setIsRecurring(true)
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

    const { data, error: err } = await createContext({
      accountId: account.id,
      label,
      type,
      programId: programId || null,
      location: location || null,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      checkoutEnabled,
      idEntryEnabled,
      isRecurring,
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
      title={`Add ${preset.labels.context}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Label
          </label>
          <input
            type="text"
            required
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={
              preset.value === 'school' ? 'MTH101 Week 3 - Tue 8am' : 'Name'
            }
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ContextType)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {CONTEXT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {preset.labels.program}{' '}
            <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="">- None -</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.code ? ` (${p.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Location <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Lecture Hall A"
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Starts <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Ends <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              Recurring session
              <span className="block text-xs text-slate-500">
                Open and close this session multiple times (e.g. Week 1, Week 2, Week 3). Each open/close creates a new occurrence.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={checkoutEnabled}
              onChange={(e) => setCheckoutEnabled(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              Require check-out
              <span className="block text-xs text-slate-500">
                Participants scan out at the end. Unresolved records are flagged
                for review.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={idEntryEnabled}
              onChange={(e) => setIdEntryEnabled(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              Allow ID entry (online fallback)
              <span className="block text-xs text-slate-500">
                Students can type their ID instead of scanning a QR.
              </span>
            </span>
          </label>
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
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}