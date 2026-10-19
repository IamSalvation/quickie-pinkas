import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import {
  createGroup,
  updateGroup,
  type CreateGroupInput,
  type UpdateGroupInput,
} from '../../lib/api/groups'
import type {
  GroupWithParent,
  GroupType,
  GroupLevel,
  AttendanceMode,
} from '../../types/db'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing?: GroupWithParent | null
  parentId?: string | null
  allGroups?: GroupWithParent[]
}

const GROUP_TYPE_OPTIONS: { value: GroupType; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'department', label: 'Department' },
  { value: 'year', label: 'Year' },
  { value: 'cohort', label: 'Cohort' },
  { value: 'house', label: 'House' },
  { value: 'custom', label: 'Custom' },
]

const LEVEL_OPTIONS: { value: GroupLevel; label: string }[] = [
  { value: 'creche', label: 'Creche' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'custom', label: 'Custom' },
]

export default function CreateGroupModal({
  open,
  onClose,
  onSaved,
  editing,
  parentId: initialParentId,
  allGroups = [],
}: Props) {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)
  const isUniversity = account?.preset === 'university'

  const [name, setName] = useState('')
  const [type, setType] = useState<GroupType>('class')
  const [parentId, setParentId] = useState<string | null>(null)
  const [level, setLevel] = useState<GroupLevel | null>(null)
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('subject')
  const [gradingEnabled, setGradingEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when opening
  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setParentId(editing.parent_id)
      setLevel(editing.level)
      setAttendanceMode(editing.attendance_mode)
      setGradingEnabled(editing.grading_enabled)
    } else {
      setName('')
      setType(isUniversity ? 'department' : 'class')
      setParentId(initialParentId ?? null)
      setLevel(isUniversity ? null : 'secondary')
      setAttendanceMode('subject')
      setGradingEnabled(true)
    }
    setError(null)
    setSaving(false)
  }, [open, editing, initialParentId, isUniversity])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!account) return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError(null)

    if (editing) {
      const updates: UpdateGroupInput = {
        name: trimmed,
        type,
        parentId,
        level,
        attendanceMode,
        gradingEnabled,
      }
      const { error: err } = await updateGroup(editing.id, updates)
      setSaving(false)
      if (err) {
        setError(err)
        return
      }
    } else {
      const input: CreateGroupInput = {
        accountId: account.id,
        name: trimmed,
        type,
        parentId,
        level,
        attendanceMode,
        gradingEnabled,
      }
      const { error: err } = await createGroup(input)
      setSaving(false)
      if (err) {
        setError(err)
        return
      }
    }

    onSaved()
    onClose()
  }

  // Filter out editing group + its descendants from parent dropdown (prevent cycles)
  const potentialParents = allGroups.filter((g) => {
    if (!editing) return true
    if (g.id === editing.id) return false
    return true
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit ' + preset.labels.group : 'New ' + preset.labels.group}
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
              isUniversity
                ? 'e.g. Computer Science, CHM Year 2'
                : 'e.g. JSS 1A, Primary 3B'
            }
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as GroupType)}
            className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            {GROUP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isUniversity && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Parent {preset.labels.group} (optional)
            </label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">None (top-level)</option>
              {potentialParents.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Example: CHM Year 2's parent is Chemistry Department.
            </p>
          </div>
        )}

        {!isUniversity && account?.preset === 'school' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Level
            </label>
            <select
              value={level ?? ''}
              onChange={(e) => setLevel((e.target.value || null) as GroupLevel | null)}
              className="block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">Not set</option>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Attendance mode
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="attendance_mode"
                value="subject"
                checked={attendanceMode === 'subject'}
                onChange={() => setAttendanceMode('subject')}
              />
              Subject (per lecture)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="attendance_mode"
                value="daily"
                checked={attendanceMode === 'daily'}
                onChange={() => setAttendanceMode('daily')}
              />
              Daily (check-in/out)
            </label>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Creche/nursery usually use Daily. Primary/secondary/university use Subject.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={gradingEnabled}
              onChange={(e) => setGradingEnabled(e.target.checked)}
            />
            Enable grading (CA + Exam) for this {preset.labels.group.toLowerCase()}
          </label>
          <p className="mt-1 text-[11px] text-slate-400">
            Turn off for creche/nursery where grading is not used.
          </p>
        </div>

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
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create ' + preset.labels.group}
          </button>
        </div>
      </form>
    </Modal>
  )
}