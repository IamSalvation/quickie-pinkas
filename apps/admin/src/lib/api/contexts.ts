import { supabase } from '../supabase'
import type { AccountPreset } from '../../types/db'

export type ContextType =
  | 'lecture'
  | 'talk'
  | 'module'
  | 'stay'
  | 'meeting'
  | 'checkpoint'
  | 'session'
  | 'custom'

export type ContextStatus = 'scheduled' | 'open' | 'closed' | 'cancelled'
export type ContextPhase = 'in' | 'out'

export interface ContextRow {
  id: string
  account_id: string
  program_id: string | null
  type: ContextType
  label: string
  location: string | null
  starts_at: string | null
  ends_at: string | null
  status: ContextStatus
  phase: ContextPhase
  public_checkin_code: string | null
  public_checkin_open: boolean
  public_checkin_expires: string | null
  id_entry_enabled: boolean
  is_recurring: boolean
  checkout_enabled: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function contextTypesForPreset(
  preset: AccountPreset | undefined | null
): ContextType[] {
  switch (preset) {
    case 'school':
      return ['lecture', 'session']
    case 'symposium':
      return ['talk', 'session']
    case 'bootcamp':
      return ['module', 'session']
    case 'conference':
      return ['session']
    case 'hotel':
      return ['stay']
    case 'event':
      return ['checkpoint']
    default:
      return [
        'lecture',
        'talk',
        'module',
        'stay',
        'meeting',
        'checkpoint',
        'session',
        'custom',
      ]
  }
}

export const CONTEXT_TYPE_LABELS: Record<ContextType, string> = {
  lecture: 'Lecture',
  talk: 'Talk',
  module: 'Module',
  stay: 'Stay',
  meeting: 'Meeting',
  checkpoint: 'Checkpoint',
  session: 'Session',
  custom: 'Custom',
}

export interface ListContextsOptions {
  search?: string
  programId?: string | 'all'
  status?: ContextStatus | 'all'
  limit?: number
  offset?: number
}

export interface ContextWithProgram extends ContextRow {
  program: { id: string; name: string; code: string | null } | null
}

export async function listContexts(
  accountId: string,
  opts: ListContextsOptions = {}
): Promise<{
  data: ContextWithProgram[]
  count: number
  error: string | null
}> {
  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  let query = supabase
    .from('contexts')
    .select('*, program:programs(id, name, code)', { count: 'exact' })
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.programId && opts.programId !== 'all') {
    query = query.eq('program_id', opts.programId)
  }
  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status)
  }
  if (opts.search && opts.search.trim()) {
    query = query.ilike('label', `%${opts.search.trim()}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return { data: [], count: 0, error: error.message }
  }

  const rows = (data ?? []).map((row) => {
    const program = Array.isArray(row.program) ? row.program[0] : row.program
    return { ...row, program: program ?? null } as ContextWithProgram
  })

  return { data: rows, count: count ?? 0, error: null }
}

export async function getContext(
  id: string
): Promise<{ data: ContextWithProgram | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contexts')
    .select('*, program:programs(id, name, code)')
    .eq('id', id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'Not found' }

  const program = Array.isArray(data.program) ? data.program[0] : data.program
  return { data: { ...data, program: program ?? null } as ContextWithProgram, error: null }
}

export interface CreateContextInput {
  accountId: string
  label: string
  type: ContextType
  programId?: string | null
  location?: string | null
  startsAt?: string | null
  endsAt?: string | null
  checkoutEnabled?: boolean
  idEntryEnabled?: boolean
  isRecurring?: boolean
}

export async function createContext(
  input: CreateContextInput
): Promise<{ data: ContextRow | null; error: string | null }> {
  const label = input.label.trim()
  if (!label) return { data: null, error: 'Label is required' }

  const { data, error } = await supabase
    .from('contexts')
    .insert({
      account_id: input.accountId,
      label,
      type: input.type,
      program_id: input.programId || null,
      location: input.location?.trim() || null,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      checkout_enabled: input.checkoutEnabled ?? false,
      id_entry_enabled: input.idEntryEnabled ?? false,
      is_recurring: input.isRecurring ?? false,
      status: 'scheduled',
      phase: 'in',
    })
    .select('*')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ContextRow, error: null }
}

export async function updateContext(
  id: string,
  updates: {
    label?: string
    type?: ContextType
    program_id?: string | null
    location?: string | null
    starts_at?: string | null
    ends_at?: string | null
    checkout_enabled?: boolean
    id_entry_enabled?: boolean
  }
): Promise<{ data: ContextRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('contexts')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ContextRow, error: null }
}

// Open a context and bind the selected kiosks to it.
// Falls back to direct update if the RPC isn't ready.
export async function openContextWithKiosks(
  contextId: string,
  kioskIds: string[]
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('open_context_with_kiosks', {
    p_context_id: contextId,
    p_kiosk_ids: kioskIds,
  })

  if (error) return { error: error.message }
  return { error: null }
}

// Simple open without kiosk binding (backward compat)
export async function openContext(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contexts')
    .update({ status: 'open', phase: 'in' })
    .eq('id', id)
  return { error: error?.message ?? null }
}

// Flip phase in <-> out
export async function switchContextPhase(
  id: string
): Promise<{ error: string | null; phase: ContextPhase | null }> {
  const { data, error } = await supabase.rpc('switch_context_phase', {
    p_context_id: id,
  })

  if (error) return { error: error.message, phase: null }

  const result = data as { ok: boolean; phase?: ContextPhase; message?: string }
  if (!result.ok) {
    return { error: result.message ?? 'Could not switch phase', phase: null }
  }
  return { error: null, phase: result.phase ?? null }
}

// Close a context: flags open records for review + unbinds kiosks
export async function closeContext(
  id: string
): Promise<{ error: string | null; flagged: number }> {
  const { data, error } = await supabase.rpc('close_context', {
    p_context_id: id,
  })

  if (error) return { error: error.message, flagged: 0 }

  const result = data as { ok: boolean; flagged?: number; message?: string }
  if (!result.ok) {
    return { error: result.message ?? 'Could not close', flagged: 0 }
  }
  return { error: null, flagged: result.flagged ?? 0 }
}

export async function deleteContext(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('contexts').delete().eq('id', id)
  return { error: error?.message ?? null }
}