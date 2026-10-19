import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import { getAccountUsage, capStatus, type AccountUsage } from '../../lib/api/access'
import UpgradePrompt from '../../components/layout/UpgradePrompt'
import {
  listPrograms,
  archiveProgram,
  restoreProgram,
  deleteProgram,
  type Program,
  type ProgramType,
  type ProgramStatus,
} from '../../lib/api/programs'
import { listTerms, type Term } from '../../lib/api/terms'
import { listGroups } from '../../lib/api/groups'
import type { GroupWithParent } from '../../types/db'
import CreateProgramModal from './CreateProgramModal'

const TYPE_LABELS: Record<ProgramType, string> = {
  course: 'Course',
  track: 'Track',
  cohort: 'Cohort',
  room: 'Room',
  service: 'Service',
  group: 'Group',
  custom: 'Custom',
}

export default function ProgramsPage() {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)
  const hasTerms = preset.features.terms
  const isUniversity = account?.preset === 'university'
  const termLabel = isUniversity ? 'Semester' : 'Term'

  const [programs, setPrograms] = useState<Program[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ProgramType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<ProgramStatus | 'all'>('active')
  const [termFilter, setTermFilter] = useState<string>('all')

  const [terms, setTerms] = useState<Term[]>([])
  const [groups, setGroups] = useState<GroupWithParent[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [usage, setUsage] = useState<AccountUsage | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Load terms and groups for display and filtering
  useEffect(() => {
    if (!account) return
    async function loadMeta() {
      if (hasTerms) {
        const { data: t } = await listTerms(account!.id)
        setTerms(t)
      }
      const { data: g } = await listGroups(account!.id)
      setGroups(g)
    }
    loadMeta()
  }, [account, hasTerms])

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)

    const opts: Parameters<typeof listPrograms>[1] = {
      search,
      type: typeFilter,
      status: statusFilter,
    }
    if (termFilter !== 'all') opts.termId = termFilter

    const { data, count: total, error: err } = await listPrograms(account.id, opts)

    setPrograms(data)
    setCount(total)
    setError(err)
    setLoading(false)
  }, [account, search, typeFilter, statusFilter, termFilter])

  useEffect(() => {
    load()
  }, [load])

  const loadUsage = useCallback(async () => {
    if (!account) return
    const { data } = await getAccountUsage(account.id)
    setUsage(data)
  }, [account])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  function handleCreateClick() {
    if (!usage) {
      setShowCreate(true)
      return
    }
    if (usage.state === 'grace') {
      alert('Read-only mode: your account access has expired. Contact support to renew.')
      return
    }
    if (capStatus(usage).programs) {
      setShowUpgrade(true)
      return
    }
    setShowCreate(true)
  }

  async function handleArchive(p: Program) {
    if (!confirm(`Archive "${p.name}"? It will be hidden from active lists.`)) return
    const { error: err } = await archiveProgram(p.id)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleRestore(p: Program) {
    const { error: err } = await restoreProgram(p.id)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleDelete(p: Program) {
    if (
      !confirm(
        `Permanently delete "${p.name}"? This cannot be undone. Archived items are safer.`
      )
    )
      return
    const { error: err } = await deleteProgram(p.id)
    if (err) {
      alert(err)
      return
    }
    setPrograms((prev) => prev.filter((x) => x.id !== p.id))
    setCount((c) => Math.max(0, c - 1))
  }

  const termById = new Map(terms.map((t) => [t.id, t]))
  const groupById = new Map(groups.map((g) => [g.id, g]))

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {preset.labels.programs}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {count}{' '}
              {count === 1
                ? preset.labels.program.toLowerCase()
                : preset.labels.programs.toLowerCase()}
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add {preset.labels.program}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            type="text"
            placeholder={`Search by name or code...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ProgramType | 'all')}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="all">All types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {hasTerms && (
            <select
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="all">All {termLabel}s</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.status === 'active' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ProgramStatus | 'all')
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>

        {error && (
          <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-lg bg-white shadow">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading...</div>
          ) : programs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                {search || typeFilter !== 'all' || statusFilter !== 'active' || termFilter !== 'all'
                  ? 'No matches.'
                  : `No ${preset.labels.programs.toLowerCase()} yet.`}
              </p>
              {!search && typeFilter === 'all' && statusFilter === 'active' && termFilter === 'all' && (
                <button
                  onClick={handleCreateClick}
                  className="mt-4 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Add your first {preset.labels.program.toLowerCase()}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  {hasTerms && <th className="px-4 py-3 font-medium">{termLabel}</th>}
                  <th className="px-4 py-3 font-medium">{preset.labels.group}</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs.map((p) => {
                  const t = p.term_id ? termById.get(p.term_id) : null
                  const g = p.group_id ? groupById.get(p.group_id) : null
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {p.code ?? <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {TYPE_LABELS[p.type]}
                      </td>
                      {hasTerms && (
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {t ? t.name : <span className="text-slate-300">-</span>}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {p.scope === 'general' ? (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 uppercase tracking-wide">
                            General
                          </span>
                        ) : g ? (
                          <span className="text-slate-700 text-xs">{g.name}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'active' ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-3 text-xs">
                          {p.status === 'active' ? (
                            <button
                              onClick={() => handleArchive(p)}
                              className="text-slate-600 hover:underline"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(p)}
                              className="text-emerald-700 hover:underline"
                            >
                              Restore
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(p)}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateProgramModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => load()}
      />

      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        resource="programs"
        used={usage?.programs ?? 0}
        cap={usage?.max_programs ?? 0}
        accountName={account?.name ?? ''}
      />
    </div>
  )
}