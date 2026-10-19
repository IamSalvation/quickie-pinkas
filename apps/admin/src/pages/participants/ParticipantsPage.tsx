import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import { getAccountUsage, type AccountUsage } from '../../lib/api/access'
import UpgradePrompt from '../../components/layout/UpgradePrompt'
import { listGroups } from '../../lib/api/groups'
import type { GroupWithParent } from '../../types/db'
import {
  listParticipants,
  deleteParticipant,
  type Participant,
} from '../../lib/api/participants'
import CreateParticipantModal from './CreateParticipantModal'
import BulkImportModal from './BulkImportModal'

export default function ParticipantsPage() {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)

  const [participants, setParticipants] = useState<Participant[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [groups, setGroups] = useState<GroupWithParent[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [usage, setUsage] = useState<AccountUsage | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const loadGroups = useCallback(async () => {
    if (!account) return
    const { data } = await listGroups(account.id)
    setGroups(data)
  }, [account])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)

    const opts: { search?: string; groupId?: string } = { search }
    if (groupFilter !== 'all') {
      opts.groupId = groupFilter
    }

    const { data, count: total, error: err } = await listParticipants(
      account.id,
      opts
    )

    setParticipants(data)
    setCount(total)
    setError(err)
    setLoading(false)
  }, [account, search, groupFilter])

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
      alert('Account limits are still loading. Please try again in a moment.')
      return
    }
    if (usage.state === 'grace') {
      alert(
        'Read-only mode: your account access has expired. Contact support to renew.'
      )
      return
    }
    if (usage.participants >= usage.max_participants) {
      setShowUpgrade(true)
      return
    }
    setShowCreate(true)
  }

  async function handleDelete(p: Participant) {
    if (!confirm(`Delete ${p.full_name} (${p.system_id})?`)) return
    const { error: err } = await deleteParticipant(p.id)
    if (err) {
      alert(err)
      return
    }
    setParticipants((prev) => prev.filter((x) => x.id !== p.id))
    setCount((c) => Math.max(0, c - 1))
    loadUsage()
  }

  const groupById = new Map(groups.map((g) => [g.id, g]))

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {preset.labels.participants}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {count}{' '}
              {count === 1
                ? preset.labels.participant.toLowerCase()
                : preset.labels.participants.toLowerCase()}{' '}
              {groupFilter !== 'all' ? 'in this ' + preset.labels.group.toLowerCase() : 'registered'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/participants/print"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Print badges
            </Link>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulk(true)}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Bulk import
              </button>
              <button
                onClick={handleCreateClick}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Add {preset.labels.participant}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder={`Search by name or ${preset.labels.participant.toLowerCase()} ID...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-md rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          >
            <option value="all">All {preset.labels.groups.toLowerCase()}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
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
          ) : participants.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                {search || groupFilter !== 'all'
                  ? 'No matches.'
                  : `No ${preset.labels.participants.toLowerCase()} yet.`}
              </p>
              {!search && groupFilter === 'all' && (
                <button
                  onClick={handleCreateClick}
                  className="mt-4 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Add your first {preset.labels.participant.toLowerCase()}
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">
                    {preset.labels.participant} ID
                  </th>
                  <th className="px-4 py-3 font-medium">{preset.labels.group}</th>
                  <th className="px-4 py-3 font-medium">External ID</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((p) => {
                  const g = p.group_id ? groupById.get(p.group_id) : null
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/participants/${p.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {p.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {p.system_id}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {g ? (
                          <button
                            onClick={() => setGroupFilter(g.id)}
                            className="text-slate-600 hover:underline"
                          >
                            {g.name}
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.external_id ?? <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(p)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateParticipantModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(p) => {
          setParticipants((prev) => [p, ...prev])
          setCount((c) => c + 1)
          loadUsage()
        }}
      />

      <BulkImportModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onImported={() => {
          load()
          loadUsage()
        }}
      />

      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        resource="participants"
        used={usage?.participants ?? 0}
        cap={usage?.max_participants ?? 0}
        accountName={account?.name ?? ''}
      />
    </div>
  )
}