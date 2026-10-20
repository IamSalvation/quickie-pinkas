import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import {
  getAccountDetail,
  approveAccount,
  pauseAccount,
  restoreAccount,
  softDeleteAccount,
  upgradeTier,
  hardDeleteAccount,
  accountStatusClass,
  accountTierClass,
  type AccountDetail,
} from '../../lib/api/platform'
import AccessLimitsCard from './AccessLimitsCard'
import AccessLimitsEditModal from './AccessLimitsEditModal'
import StorageCleanupCard from '../../components/storage/StorageCleanupCard'
import AcademicStatsModal from './AcademicStatsModal'
import { getAccountAcademicStats, type AccountAcademicStats } from '../../lib/api/platform'
import { listManualOverrides, deleteManualOverride, type ManualOverrideRecord } from '../../lib/api/presence'

export default function PlatformAccountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { account: ownAccount } = useAuth()

  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [showLimitsEdit, setShowLimitsEdit] = useState(false)
  const [showAcademicEdit, setShowAcademicEdit] = useState(false)
  const [academicStats, setAcademicStats] = useState<AccountAcademicStats | null>(null)
  const [manualOverrides, setManualOverrides] = useState<ManualOverrideRecord[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await getAccountDetail(id)
    setDetail(data)
    setError(err)
    setLoading(false)
  }, [id])

  const loadAcademicStats = useCallback(async () => {
    if (!id) return
    const { data } = await getAccountAcademicStats(id)
    setAcademicStats(data)
  }, [id])

  const loadManualOverrides = useCallback(async () => {
    if (!id) return
    const { data } = await listManualOverrides(id, 50)
    setManualOverrides(data)
  }, [id])

  useEffect(() => {
    load()
    loadAcademicStats()
    loadManualOverrides()
  }, [load, loadAcademicStats, loadManualOverrides])

  async function handleDeleteManual(recordId: string) {
    if (!confirm('Delete this manual override record? The student will be marked Absent.')) return
    setDeletingId(recordId)
    const { error: err } = await deleteManualOverride(recordId)
    setDeletingId(null)
    if (err) {
      alert(err)
      return
    }
    loadManualOverrides()
  }

  async function runAction(
    fn: () => Promise<{ error: string | null }>,
    label: string
  ) {
    if (!confirm(label)) return
    setWorking(true)
    const { error: err } = await fn()
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleToggleTier() {
    if (!detail) return
    const next = detail.account.tier === 'v1' ? 'v2' : 'v1'
    if (!confirm('Change tier from ' + detail.account.tier + ' to ' + next + '?'))
      return
    setWorking(true)
    const { error: err } = await upgradeTier(detail.account.id, next)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  async function handleHardDelete() {
    if (!detail) return
    const typed = prompt(
      'Type the exact account name to confirm PERMANENT deletion:\n\n' +
        detail.account.name +
        '\n\nThis will delete ALL participants, contexts, kiosks, presence records, and face embeddings for this account. This cannot be undone.'
    )
    if (typed !== detail.account.name) {
      alert('Name did not match. Deletion cancelled.')
      return
    }
    setWorking(true)
    const { error: err } = await hardDeleteAccount(detail.account.id)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    navigate('/platform/customers')
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-500">Loading...</div>
    )
  }

  if (error || !detail) {
    return (
      <div>
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error ?? 'Account not found'}
        </div>
        <Link
          to="/platform/customers"
          className="mt-4 inline-block text-sm text-slate-600 hover:underline"
        >
          &lt;- Back to customers
        </Link>
      </div>
    )
  }

  const { account, operators, stats } = detail
  const isOwn = account.id === ownAccount?.id

  return (
    <div>
      <Link
        to="/platform/customers"
        className="text-xs text-slate-500 hover:underline"
      >
        &lt;- Back to customers
      </Link>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{account.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={
                'rounded px-2 py-0.5 text-xs font-medium ' +
                accountStatusClass(account.status)
              }
            >
              {account.status}
            </span>
            <span
              className={
                'rounded px-2 py-0.5 text-xs font-medium ' +
                accountTierClass(account.tier)
              }
            >
              {account.tier}
            </span>
            <span className="font-mono text-xs text-slate-500">
              {account.slug}
            </span>
            {isOwn && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                You
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {account.status === 'pending' && (
            <button
              onClick={() =>
                runAction(() => approveAccount(account.id), 'Approve ' + account.name + '?')
              }
              disabled={working}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {account.status === 'active' && !isOwn && (
            <button
              onClick={() =>
                runAction(() => pauseAccount(account.id), 'Pause ' + account.name + '?')
              }
              disabled={working}
              className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Pause
            </button>
          )}
          {account.status === 'paused' && (
            <button
              onClick={() =>
                runAction(() => restoreAccount(account.id), 'Restore ' + account.name + '?')
              }
              disabled={working}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Restore
            </button>
          )}
          <button
            onClick={handleToggleTier}
            disabled={working}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Switch to {account.tier === 'v1' ? 'V2' : 'V1'}
          </button>
          {account.status !== 'deleted' && !isOwn && (
            <button
              onClick={() =>
                runAction(
                  () => softDeleteAccount(account.id),
                  'Soft delete ' + account.name + '? Data is preserved but the account cannot log in.'
                )
              }
              disabled={working}
              className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Soft delete
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Participants
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {stats.participants}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Contexts
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {stats.contexts}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Kiosks
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {stats.kiosks}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Presence records
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {stats.presence_records}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Face enrollments
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {stats.face_enrollments}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AccessLimitsCard
          accountId={account.id}
          accountName={account.name}
          onEdit={() => setShowLimitsEdit(true)}
        />
      </div>

      <div className="mt-6 rounded-lg bg-white shadow">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-900">Academic Structure</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Read-only view. Click Edit to override the active term.
            </p>
          </div>
          <button
            onClick={() => setShowAcademicEdit(true)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Edit
          </button>
        </div>
        <div className="p-4">
          {academicStats ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{getPreset(detail.account.preset).labels.groups}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{academicStats.groups_count}</div>
                <div className="mt-0.5 text-xs text-slate-500">{getPreset(detail.account.preset).label}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Terms</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{academicStats.terms_count}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {academicStats.active_term_name ? 'Active: ' + academicStats.active_term_name : 'No active term'}
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Sessions / Occurrences</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {academicStats.sessions_count} / {academicStats.occurrences_count}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {academicStats.sessions_count > 0
                    ? 'Avg ' + (academicStats.occurrences_count / academicStats.sessions_count).toFixed(1) + ' per session'
                    : 'No sessions yet'}
                </div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Manual Overrides</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{academicStats.manual_overrides_count}</div>
                <div className="mt-0.5 text-xs text-slate-500">Manually added check-ins</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading academic stats...</p>
          )}
        </div>
      </div>

      <AcademicStatsModal
        open={showAcademicEdit}
        onClose={() => setShowAcademicEdit(false)}
        onSaved={() => {
          loadAcademicStats()
          load()
        }}
        accountId={account.id}
        currentActiveTermId={academicStats?.active_term_id ?? null}
      />

      <div className="mt-6">
        <StorageCleanupCard accountId={account.id} isPlatformAdmin />
      </div>

      {/* Manual Attendance Audit Card */}
      <div className="mt-6 rounded-lg bg-white shadow">
        <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-900">Manual Attendance Audit</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manual check-ins grouped by session.
            </p>
          </div>
          <button
            onClick={loadManualOverrides}
            className="text-xs text-slate-500 hover:underline"
          >
            Refresh
          </button>
        </div>
        <div className="p-4">
          {manualOverrides.length === 0 ? (
            <p className="text-sm text-slate-500">No manual overrides found.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                manualOverrides.reduce((acc, r) => {
                  const sessionName = r.context?.label || 'Unknown Session';
                  const week = r.occurrence?.session_number ? `Week ${r.occurrence.session_number}` : 'Unknown Week';
                  const key = `${sessionName} - ${week}`;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(r);
                  return acc;
                }, {} as Record<string, typeof manualOverrides>)
              ).map(([groupKey, records]) => (
                <details key={groupKey} className="group border border-slate-200 rounded-md bg-white open:bg-slate-50">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
                    <div className="font-medium text-sm text-slate-900">
                      {groupKey}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">{records.length} record{records.length !== 1 ? 's' : ''}</span>
                      <span className="text-slate-400 group-open:-rotate-180 transition-transform">Ã¢â€“Â¼</span>
                    </div>
                  </summary>
                  <div className="border-t border-slate-200 p-4 bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <tr>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Student</th>
                          <th className="pb-2 font-medium">Reason</th>
                          <th className="pb-2 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 text-slate-600">{new Date(r.checked_in_at).toLocaleDateString()}</td>
                            <td className="py-2 text-slate-900">
                              {r.participant?.full_name ?? '-'}
                              <span className="ml-1 text-xs text-slate-400">({r.participant?.system_id})</span>
                            </td>
                            <td className="py-2 text-slate-600">{r.added_reason ?? '-'}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleDeleteManual(r.id)}
                                disabled={deletingId === r.id}
                                className="text-xs text-red-600 hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-900">
            Operators ({operators.length})
          </h2>
        </div>
        {operators.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No operators.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operators.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{o.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {o.full_name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{o.role}</td>
                    <td className="px-4 py-3 text-slate-600">{o.status}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1 text-[10px]">
                        {o.is_owner && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
                            Owner
                          </span>
                        )}
                        {o.is_platform_admin && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                            Platform admin
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg bg-white p-5 shadow">
        <h2 className="text-sm font-medium text-slate-900">Account details</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="mt-0.5 text-slate-900">
              {new Date(account.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">ID prefix</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-700">
              {account.id_prefix}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Preset</dt>
            <dd className="mt-0.5 text-slate-900">{account.preset}</dd>
          </div>
        </dl>
      </div>

      {!isOwn && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-sm font-semibold text-red-900">
            Danger zone
          </h2>
          <p className="mt-1 text-xs text-red-800">
            Hard delete removes the account and ALL associated data (operators,
            participants, contexts, kiosks, presence records, face embeddings).
            This cannot be undone.
          </p>
          <button
            onClick={handleHardDelete}
            disabled={working}
            className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Permanently delete account
          </button>
        </div>
      )}

      <div className="mt-6 rounded-lg bg-white p-5 shadow">
        <h2 className="text-sm font-medium text-slate-900">Raw metadata</h2>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-50 p-3 font-mono text-xs text-slate-700">
          {JSON.stringify(account.metadata ?? {}, null, 2)}
        </pre>
      </div>
      <AccessLimitsEditModal
        open={showLimitsEdit}
        onClose={() => setShowLimitsEdit(false)}
        onSaved={() => load()}
        accountId={account.id}
        accountName={account.name}
      />
    </div>
  )
}