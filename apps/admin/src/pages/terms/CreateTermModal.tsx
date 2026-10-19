import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../contexts/AuthContext'
import {
  createTerm,
  updateTerm,
  type CreateTermInput,
  type UpdateTermInput,
  type Term,
} from '../../lib/api/terms'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing?: Term | null
}

function toLocalDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export default function CreateTermModal({
  open,
  onClose,
  onSaved,
  editing,
}: Props) {
  const { account } = useAuth()
  const isUniversity = account?.preset === 'university'
  const label = isUniversity ? 'Semester' : 'Term'

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setStartDate(toLocalDate(editing.start_date))
      setEndDate(toLocalDate(editing.end_date))
    } else {
      setName('')
      setStartDate('')
      setEndDate('')
    }
    setError(null)
    setSaving(false)
  }, [open, editing])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!account) return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date')
      return
    }

    setSaving(true)
    setError(null)

    if (editing) {
      const updates: UpdateTermInput = {
        name: trimmed,
        startDate: startDate || null,
        endDate: endDate || null,
      }
      const { error: err } = await updateTerm(editing.id, updates)
      setSaving(false)
      if (err) {
        setError(err)
        return
      }
    } else {
      const input: CreateTermInput = {
        accountId: account.id,
        name: trimmed,
        startDate: startDate || null,
        endDate: endDate || null,
      }
      const { error: err } = await createTerm(input)
      setSaving(false)
      if (err) {
        setError(err)
        return
      }
    }

    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit ' + label : 'New ' + label}
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
            placeholder={
              isUniversity ? 'e.g. First Semester 2026/2027' : 'e.g. First Term 2026/2027'
            }
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Dates are optional but recommended. They can be extended later for strikes
          or unexpected circumstances.
        </p>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create ' + label}
          </button>
        </div>
      </form>
    </Modal>
  )
}