import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listTerms,
  activateTerm,
  endTerm,
  archiveTerm,
  deleteTerm,
  countTermUsage,
  type Term,
  type TermStatus,
} from '../../lib/api/terms'
import CreateTermModal from './CreateTermModal'

function StatusBadge({ status }: { status: TermStatus }) {
  const styles: Record<TermStatus, string> = {
    upcoming: 'bg-slate-100 text-slate-700',
    active: 'bg-emerald-50 text-emerald-700',
    ended: 'bg-amber-50 text-amber-700',
    archived: 'bg-slate-200 text-slate-500',
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function TermsPage() {
  const { account } = useAuth()
  const isUniversity = account?.preset === 'university'
  const label = isUniversity ? 'Semester' : 'Term'
  const labelPlural = isUniversity ? 'Semesters' : 'Terms'

  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Term | null>(null)

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await listTerms(account.id)
    setTerms(data)
    setError(err)
    setLoading(false)
  }, [account])

  useEffect(() => {
    load()
  }, [load])

  function handleCreate() {
    setEditing(null)
    setShowCreate(true)
  }

  function handleEdit(t: Term) {
    setEditing(t)
    setShowCreate(true)
  }

  async function handleActivate(t: Term) {
    if (!account) return
    if (!confirm('Activate "' + t.name + '"?\n\nAny currently active ' + label.toLowerCase() + ' will be automatically ended.')) return

    setWorking(t.id)
    const { error: err } = await activateTerm(account.id, t.id)
    setWorking(null)

    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleEnd(t: Term) {
    if (!confirm('End "' + t.name + '"?\n\nIt will become read-only until you archive it.')) return
    setWorking(t.id)
    const { error: err } = await endTerm(t.id)
    setWorking(null)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleArchive(t: Term) {
    if (!confirm('Archive "' + t.name + '"?\n\nIt will be hidden from active views but preserved.')) return
    setWorking(t.id)
    const { error: err } = await archiveTerm(t.id)
    setWorking(null)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleDelete(t: Term) {
    if (t.status === 'active') {
      alert('Cannot delete an active ' + label.toLowerCase() + '. End it first, then archive it.')
      return
    }

    const usage = await countTermUsage(t.id)
    let msg = 'Delete "' + t.name + '"?'
    if (usage.programs > 0 || usage.contexts > 0) {
      msg += '\n\nThis ' + label.toLowerCase() + ' has ' +
        usage.programs + ' course' + (usage.programs === 1 ? '' : 's') + ' and ' +
        usage.contexts + ' session' + (usage.contexts === 1 ? '' : 's') +
        '. They will lose their ' + label.toLowerCase() + ' assignment but keep working.'
    }

    if (!confirm(msg)) return

    setWorking(t.id)
    const { error: err } = await deleteTerm(t.id)
    setWorking(null)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{labelPlural}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {terms.length} {terms.length === 1 ? label.toLowerCase() : labelPlural.toLowerCase()}
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New {label}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-lg bg-white shadow">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading...</div>
          ) : terms.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                No {labelPlural.toLowerCase()} yet.
              </p>
              <button
                onClick={handleCreate}
                className="mt-4 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Create your first {label.toLowerCase()}
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Start</th>
                  <th className="px-4 py-3 font-medium">End</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terms.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.start_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.end_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-3 text-xs">
                        {t.status === 'upcoming' && (
                          <button
                            onClick={() => handleActivate(t)}
                            disabled={working === t.id}
                            className="text-emerald-700 hover:underline disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {t.status === 'active' && (
                          <button
                            onClick={() => handleEnd(t)}
                            disabled={working === t.id}
                            className="text-amber-700 hover:underline disabled:opacity-50"
                          >
                            End
                          </button>
                        )}
                        {t.status === 'ended' && (
                          <button
                            onClick={() => handleArchive(t)}
                            disabled={working === t.id}
                            className="text-slate-600 hover:underline disabled:opacity-50"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(t)}
                          disabled={working === t.id || t.status === 'archived'}
                          className="text-slate-600 hover:underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                        {t.status !== 'active' && (
                          <button
                            onClick={() => handleDelete(t)}
                            disabled={working === t.id}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Only one {label.toLowerCase()} can be active at a time. Activating a new one will automatically end the current active one.
        </p>
      </div>

      <CreateTermModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={load}
        editing={editing}
      />
    </div>
  )
}