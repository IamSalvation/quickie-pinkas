import { supabase } from '../supabase'
import type {
  Group,
  GroupWithParent,
  GroupType,
  GroupLevel,
  AttendanceMode,
  Participant,
} from '../../types/db'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface CreateGroupInput {
  accountId: string
  name: string
  type: GroupType
  parentId?: string | null
  level?: GroupLevel | null
  attendanceMode?: AttendanceMode
  gradingEnabled?: boolean
}

export interface UpdateGroupInput {
  name?: string
  type?: GroupType
  parentId?: string | null
  level?: GroupLevel | null
  attendanceMode?: AttendanceMode
  gradingEnabled?: boolean
}

// ----------------------------------------------------------------
// List groups
// ----------------------------------------------------------------

export async function listGroups(
  accountId: string
): Promise<{ data: GroupWithParent[]; error: string | null }> {
  const { data: groups, error } = await supabase
    .from('groups')
    .select('*')
    .eq('account_id', accountId)
    .order('name')

  if (error) return { data: [], error: error.message }
  if (!groups) return { data: [], error: null }

  // Fetch participant counts and child counts per group
  const ids = groups.map((g) => g.id)

  const [participantCounts, childCounts] = await Promise.all([
    supabase
      .from('participants')
      .select('group_id')
      .eq('account_id', accountId)
      .in('group_id', ids),
    supabase
      .from('groups')
      .select('parent_id')
      .eq('account_id', accountId)
      .in('parent_id', ids),
  ])

  const participantMap = new Map<string, number>()
  for (const row of participantCounts.data ?? []) {
    if (row.group_id) {
      participantMap.set(row.group_id, (participantMap.get(row.group_id) ?? 0) + 1)
    }
  }

  const childMap = new Map<string, number>()
  for (const row of childCounts.data ?? []) {
    if (row.parent_id) {
      childMap.set(row.parent_id, (childMap.get(row.parent_id) ?? 0) + 1)
    }
  }

  // Attach parent info + counts
  const groupById = new Map(groups.map((g) => [g.id, g]))
  const enriched: GroupWithParent[] = groups.map((g) => {
    const parent = g.parent_id ? groupById.get(g.parent_id) : null
    return {
      ...(g as Group),
      parent: parent ? { id: parent.id, name: parent.name } : null,
      participant_count: participantMap.get(g.id) ?? 0,
      child_count: childMap.get(g.id) ?? 0,
    }
  })

  return { data: enriched, error: null }
}

// ----------------------------------------------------------------
// Get single group
// ----------------------------------------------------------------

export async function getGroup(
  groupId: string
): Promise<{ data: Group | null; error: string | null }> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as Group | null, error: null }
}

// ----------------------------------------------------------------
// Create group
// ----------------------------------------------------------------

export async function createGroup(
  input: CreateGroupInput
): Promise<{ data: Group | null; error: string | null }> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      account_id: input.accountId,
      name: input.name.trim(),
      type: input.type,
      parent_id: input.parentId ?? null,
      level: input.level ?? null,
      attendance_mode: input.attendanceMode ?? 'subject',
      grading_enabled: input.gradingEnabled ?? true,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Group, error: null }
}

// ----------------------------------------------------------------
// Update group
// ----------------------------------------------------------------

export async function updateGroup(
  groupId: string,
  input: UpdateGroupInput
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.type !== undefined) updates.type = input.type
  if (input.parentId !== undefined) updates.parent_id = input.parentId
  if (input.level !== undefined) updates.level = input.level
  if (input.attendanceMode !== undefined) updates.attendance_mode = input.attendanceMode
  if (input.gradingEnabled !== undefined) updates.grading_enabled = input.gradingEnabled

  if (Object.keys(updates).length === 0) {
    return { error: null }
  }

  const { error } = await supabase.from('groups').update(updates).eq('id', groupId)
  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// Delete group (nullifies participants' group_id via FK on delete set null)
// ----------------------------------------------------------------

export async function deleteGroup(
  groupId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// List participants in a group
// ----------------------------------------------------------------

export async function listGroupParticipants(
  groupId: string
): Promise<{ data: Participant[]; error: string | null }> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('group_id', groupId)
    .order('full_name')

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Participant[], error: null }
}

// ----------------------------------------------------------------
// Assign single participant to group
// ----------------------------------------------------------------

export async function assignParticipantToGroup(
  participantId: string,
  groupId: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('participants')
    .update({ group_id: groupId })
    .eq('id', participantId)

  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// Bulk assign participants to group
// ----------------------------------------------------------------

export async function bulkAssignToGroup(
  participantIds: string[],
  groupId: string | null
): Promise<{ updated: number; error: string | null }> {
  if (participantIds.length === 0) {
    return { updated: 0, error: null }
  }

  const { error } = await supabase
    .from('participants')
    .update({ group_id: groupId })
    .in('id', participantIds)

  if (error) return { updated: 0, error: error.message }
  return { updated: participantIds.length, error: null }
}

// ----------------------------------------------------------------
// Get descendant group IDs (for department -> year rollup filtering)
// ----------------------------------------------------------------

export async function getGroupDescendants(
  groupId: string
): Promise<{ data: string[]; error: string | null }> {
  const { data, error } = await supabase.rpc('group_descendants', {
    p_group_id: groupId,
  })

  if (error) return { data: [], error: error.message }

  // The RPC returns rows of { group_descendants: uuid } or similar
  const ids = (data ?? []).map((row: unknown) => {
    if (typeof row === 'string') return row
    if (row && typeof row === 'object' && 'group_descendants' in row) {
      return (row as { group_descendants: string }).group_descendants
    }
    return null
  }).filter((id: unknown): id is string => typeof id === 'string')

  return { data: ids, error: null }
}