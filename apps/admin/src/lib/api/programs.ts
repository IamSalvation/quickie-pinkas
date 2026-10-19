import { supabase } from '../supabase'

export type ProgramType =
  | 'course'
  | 'track'
  | 'cohort'
  | 'room'
  | 'service'
  | 'group'
  | 'custom'

export type ProgramStatus = 'active' | 'archived'
export type ProgramScope = 'general' | 'group'

export interface Program {
  id: string
  account_id: string
  term_id: string | null
  group_id: string | null
  scope: ProgramScope | null
  name: string
  code: string | null
  type: ProgramType
  description: string | null
  status: ProgramStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateProgramInput {
  accountId: string
  name: string
  code: string | null
  type: ProgramType
  description: string | null
  termId?: string | null
  groupId?: string | null
  scope?: ProgramScope | null
}

export interface ListProgramsOptions {
  search?: string
  type?: ProgramType | 'all'
  status?: ProgramStatus | 'all'
  termId?: string
  groupId?: string
  limit?: number
  offset?: number
}

export async function listPrograms(
  accountId: string,
  opts: ListProgramsOptions = {}
): Promise<{ data: Program[]; count: number; error: string | null }> {
  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  let query = supabase
    .from('programs')
    .select('*', { count: 'exact' })
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status)
  }
  if (opts.type && opts.type !== 'all') {
    query = query.eq('type', opts.type)
  }
  if (opts.termId) {
    query = query.eq('term_id', opts.termId)
  }
  if (opts.groupId) {
    query = query.eq('group_id', opts.groupId)
  }
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim()
    query = query.or(`name.ilike.%${s}%,code.ilike.%${s}%`)
  }

  const { data, count, error } = await query

  if (error) return { data: [], count: 0, error: error.message }
  return { data: (data ?? []) as Program[], count: count ?? 0, error: null }
}

export async function getProgram(
  id: string
): Promise<{ data: Program | null; error: string | null }> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data: data as Program | null, error: null }
}

export async function createProgram(
  input: CreateProgramInput
): Promise<{ data: Program | null; error: string | null }> {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      account_id: input.accountId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      type: input.type,
      description: input.description?.trim() || null,
      term_id: input.termId ?? null,
      group_id: input.groupId ?? null,
      scope: input.scope ?? null,
      status: 'active',
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Program, error: null }
}

export async function archiveProgram(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('programs')
    .update({ status: 'archived' })
    .eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function restoreProgram(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('programs')
    .update({ status: 'active' })
    .eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteProgram(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}