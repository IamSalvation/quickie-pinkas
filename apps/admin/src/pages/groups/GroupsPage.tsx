import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import {
  listGroups,
  deleteGroup,
} from '../../lib/api/groups'
import type { GroupWithParent } from '../../types/db'
import CreateGroupModal from './CreateGroupModal'
import AssignParticipantsModal from './AssignParticipantsModal'

interface TreeNode extends GroupWithParent {
  children: TreeNode[]
}

function buildTree(groups: GroupWithParent[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const g of groups) {
    byId.set(g.id, { ...g, children: [] })
  }

  for (const g of groups) {
    const node = byId.get(g.id)!
    if (g.parent_id && byId.has(g.parent_id)) {
      byId.get(g.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort alphabetically
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    for (const n of nodes) sortNodes(n.children)
  }
  sortNodes(roots)

  return roots
}

export default function GroupsPage() {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)
  const isUniversity = account?.preset === 'university'

  const [groups, setGroups] = useState<GroupWithParent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<GroupWithParent | null>(null)
  const [parentForCreate, setParentForCreate] = useState<string | null>(null)

  const [assigning, setAssigning] = useState<GroupWithParent | null>(null)

  const load = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await listGroups(account.id)
    setGroups(data)
    setError(err)
    setLoading(false)
  }, [account])

  useEffect(() => {
    load()
  }, [load])

  function handleCreate() {
    setEditing(null)
    setParentForCreate(null)
    setShowCreate(true)
  }

  function handleAddChild(parent: GroupWithParent) {
    setEditing(null)
    setParentForCreate(parent.id)
    setShowCreate(true)
  }

  function handleEdit(g: GroupWithParent) {
    setEditing(g)
    setParentForCreate(null)
    setShowCreate(true)
  }

  async function handleDelete(g: GroupWithParent) {
    const hasParticipants = g.participant_count > 0
    const hasChildren = g.child_count > 0

    let message = 'Delete "' + g.name + '"?'
    if (hasParticipants && hasChildren) {
      message =
        'Delete "' +
        g.name +
        '"?\n\nThis ' +
        preset.labels.group.toLowerCase() +
        ' has ' +
        g.participant_count +
        ' ' +
        preset.labels.participants.toLowerCase() +
        ' and ' +
        g.child_count +
        ' sub-' +
        preset.labels.groups.toLowerCase() +
        '. Participants will be unassigned, and child ' +
        preset.labels.groups.toLowerCase() +
        ' will become top-level.'
    } else if (hasParticipants) {
      message =
        'Delete "' +
        g.name +
        '"?\n\n' +
        g.participant_count +
        ' ' +
        preset.labels.participants.toLowerCase() +
        ' will be unassigned from this ' +
        preset.labels.group.toLowerCase() +
        '.'
    } else if (hasChildren) {
      message =
        'Delete "' +
        g.name +
        '"?\n\n' +
        g.child_count +
        ' sub-' +
        preset.labels.groups.toLowerCase() +
        ' will become top-level.'
    }

    if (!confirm(message)) return

    const { error: err } = await deleteGroup(g.id)
    if (err) {
      alert(err)
      return
    }
    load()
  }

  const tree = isUniversity ? buildTree(groups) : []
  const flat = !isUniversity ? groups : []

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {preset.labels.groups}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {groups.length}{' '}
              {groups.length === 1
                ? preset.labels.group.toLowerCase()
                : preset.labels.groups.toLowerCase()}
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New {preset.labels.group}
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
          ) : groups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-500">
                No {preset.labels.groups.toLowerCase()} yet.
              </p>
              <button
                onClick={handleCreate}
                className="mt-4 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Create your first {preset.labels.group.toLowerCase()}
              </button>
            </div>
          ) : isUniversity ? (
            <div className="divide-y divide-slate-100">
              {tree.map((node) => (
                <TreeNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  onAssign={(g) => setAssigning(g)}
                  groupLabel={preset.labels.group}
                  groupLabelPlural={preset.labels.groups}
                  participantLabelPlural={preset.labels.participants}
                />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">
                    {preset.labels.participants}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flat.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{g.name}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {g.type}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {g.level ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {g.participant_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-3 text-xs">
                        <button
                          onClick={() => setAssigning(g)}
                          className="text-slate-600 hover:underline"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => handleEdit(g)}
                          className="text-slate-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateGroupModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={load}
        editing={editing}
        parentId={parentForCreate}
        allGroups={groups}
      />

      {assigning && (
        <AssignParticipantsModal
          open={!!assigning}
          onClose={() => setAssigning(null)}
          onSaved={load}
          group={assigning}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Tree row for university preset
// ----------------------------------------------------------------
function TreeNodeRow({
  node,
  depth,
  onEdit,
  onDelete,
  onAddChild,
  onAssign,
  groupLabel,
  groupLabelPlural,
  participantLabelPlural,
}: {
  node: TreeNode
  depth: number
  onEdit: (g: GroupWithParent) => void
  onDelete: (g: GroupWithParent) => void
  onAddChild: (g: GroupWithParent) => void
  onAssign: (g: GroupWithParent) => void
  groupLabel: string
  groupLabelPlural: string
  participantLabelPlural: string
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
        style={{ paddingLeft: 16 + depth * 24 + 'px' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {node.children.length > 0 ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-slate-400 hover:text-slate-600 text-xs"
              aria-label="Toggle"
            >
              {expanded ? 'v' : '>'}
            </button>
          ) : (
            <span className="text-slate-300 text-xs w-3" />
          )}
          <span className="font-medium text-slate-900">{node.name}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 capitalize">
            {node.type}
          </span>
          <span className="text-xs text-slate-400">
            {node.participant_count} {participantLabelPlural.toLowerCase()}
          </span>
        </div>
        <div className="inline-flex gap-3 text-xs shrink-0">
          <button
            onClick={() => onAssign(node)}
            className="text-slate-600 hover:underline"
          >
            Assign
          </button>
          <button
            onClick={() => onAddChild(node)}
            className="text-slate-600 hover:underline"
          >
            + Sub
          </button>
          <button
            onClick={() => onEdit(node)}
            className="text-slate-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(node)}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
      {expanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            onAssign={onAssign}
            groupLabel={groupLabel}
            groupLabelPlural={groupLabelPlural}
            participantLabelPlural={participantLabelPlural}
          />
        ))}
    </>
  )
}