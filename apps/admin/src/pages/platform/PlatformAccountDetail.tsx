import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
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
      <div className="p-6">
        <div className="mx-auto max-w-5xl text-sm text-slate-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/platform/customers" className="text-xs text-slate-500 hover:underline">
          &lt;- Back to Customers
        </Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {detail?.account.name ?? 'Loading...'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{detail?.account.slug}</span>
              {detail?.account.status && (
                <span className={`rounded px-1.5 py-0.5 ${accountStatusClass(detail.account.status)}`}>
                  {detail.account.status}
                </span>
              )}
              {detail?.account.tier && (
                <span className={`rounded px-1.5 py-0.5 ${accountTierClass(detail.account.tier)}`}>
                  {detail.account.tier.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {detail && (
          <>
            {/* Status Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              {detail.account.status === 'pending' && (
                <button
                  onClick={() => runAction(() => approveAccount(detail.account.id), 'Approve this account?')}
                  disabled={working}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {detail.account.status === 'active' && (
                <button
                  onClick={() => runAction(() => pauseAccount(detail.account.id), 'Pause this account?')}
                  disabled={working}
                  className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Pause
                </button>
              )}
              {(detail.account.status === 'paused' || detail.account.status === 'deleted') && (
                <button
                  onClick={() => runAction(() => restoreAccount(detail.account.id), 'Restore this account?')}
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
                Toggle Tier
              </button>
              {detail.account.status !== 'deleted' && (
                <button
                  onClick={() => runAction(() => softDeleteAccount(detail.account.id), 'Soft delete this account?')}
                  disabled={working}
                  className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Soft Delete
                </button>
              )}
              <button
                onClick={handleHardDelete}
                disabled={working}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Hard Delete
              </button>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-4 shadow">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Operators</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{detail.operators.length}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Participants</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{detail.stats.participants}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Contexts</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{detail.stats.contexts}</div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Kiosks</div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">{detail.stats.kiosks}</div>
              </div>
            </div>

            {/* Access Limits */}
            <div className="mt-6">
              <AccessLimitsCard
                accountId={detail.account.id}
                accountName={detail.account.name}
                onEdit={() => setShowLimitsEdit(true)}
              />
            </div>

            {/* Academic Structure - ONLY FOR SCHOOL/UNIVERSITY */}
            {(detail.account.preset === 'school' || detail.account.preset === 'university') && (
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
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                          {getPreset(detail.account.preset).labels.groups}
                        </div>
                        <div className="mt-1 text-2xl font-semibold text-slate-900">{academicStats.groups_count}</div>
                        <div className="mt-0.5 text-xs text-slate-500">Total</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">
                          {detail.account.preset === 'university' ? 'Semesters' : 'Terms'}
                        </div>
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
            )}

            {/* Program Structure - FOR ALL NON-SCHOOL PRESETS */}
            {(detail.account.preset !== 'school' && detail.account.preset !== 'university') && (
              <div className="mt-6 rounded-lg bg-white shadow">
                <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-medium text-slate-900">Program Structure</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Read-only view of this {getPreset(detail.account.preset).label} setup.
                    </p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">
                        {getPreset(detail.account.preset).labels.contexts}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {detail.stats.contexts}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">Created</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">
                        {getPreset(detail.account.preset).labels.participants}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {detail.stats.participants}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">Registered</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Check-ins</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {detail.stats.presence_records}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">Total scans</div>
                    </div>
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Active Kiosks</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">
                        {detail.stats.kiosks}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">Devices</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Storage */}
            <div className="mt-6">
              <StorageCleanupCard accountId={detail.account.id} isPlatformAdmin />
            </div>

            {/* Manual Attendance Audit */}
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
                            <span className="text-slate-400 group-open:-rotate-180 transition-transform">v</span>
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

            {/* Operators */}
            <div className="mt-6 rounded-lg bg-white shadow">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-medium text-slate-900">Operators</h2>
              </div>
              <div className="p-4">
                <ul className="divide-y divide-slate-100">
                  {detail.operators.map((op) => (
                    <li key={op.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-slate-900">{op.full_name ?? '-'}</div>
                        <div className="text-xs text-slate-500">{op.email}</div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {op.role} {op.is_owner && '(Owner)'}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <AcademicStatsModal
              open={showAcademicEdit}
              onClose={() => setShowAcademicEdit(false)}
              onSaved={() => {
                loadAcademicStats()
                load()
              }}
              accountId={detail.account.id}
              currentActiveTermId={academicStats?.active_term_id ?? null}
            />

            <AccessLimitsEditModal
              open={showLimitsEdit}
              onClose={() => setShowLimitsEdit(false)}
              onSaved={() => {
                load()
              }}
              accountId={detail.account.id}
              accountName={detail.account.name}
            />
          </>
        )}
      </div>
    </div>
  )
}