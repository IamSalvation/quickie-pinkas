import { supabase } from '../supabase'

export type TermStatus = 'upcoming' | 'active' | 'ended' | 'archived'

export interface Term {
  id: string
  account_id: string
  name: string
  start_date: string | null
  end_date: string | null
  status: TermStatus
  order_index: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateTermInput {
  accountId: string
  name: string
  startDate: string | null
  endDate: string | null
}

export interface UpdateTermInput {
  name?: string
  startDate?: string | null
  endDate?: string | null
}

// ----------------------------------------------------------------
// List terms
// ----------------------------------------------------------------
export async function listTerms(
  accountId: string
): Promise<{ data: Term[]; error: string | null }> {
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('account_id', accountId)
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('order_index', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Term[], error: null }
}

// ----------------------------------------------------------------
// Get current active term
// ----------------------------------------------------------------
export async function getActiveTerm(
  accountId: string
): Promise<{ data: Term | null; error: string | null }> {
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data as Term | null, error: null }
}

// ----------------------------------------------------------------
// Create term
// ----------------------------------------------------------------
export async function createTerm(
  input: CreateTermInput
): Promise<{ data: Term | null; error: string | null }> {
  const { count } = await supabase
    .from('terms')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', input.accountId)

  const nextOrder = (count ?? 0) + 1

  const { data, error } = await supabase
    .from('terms')
    .insert({
      account_id: input.accountId,
      name: input.name.trim(),
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      status: 'upcoming',
      order_index: nextOrder,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Term, error: null }
}

// ----------------------------------------------------------------
// Update term
// ----------------------------------------------------------------
export async function updateTerm(
  termId: string,
  input: UpdateTermInput
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.startDate !== undefined) updates.start_date = input.startDate || null
  if (input.endDate !== undefined) updates.end_date = input.endDate || null

  if (Object.keys(updates).length === 0) return { error: null }

  const { error } = await supabase.from('terms').update(updates).eq('id', termId)
  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// Activate term (auto-ends current active term)
// ----------------------------------------------------------------
export async function activateTerm(
  accountId: string,
  termId: string
): Promise<{ error: string | null }> {
  // 1. Auto-end current active
  const { data: currentActive } = await supabase
    .from('terms')
    .select('id')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle()

  if (currentActive && currentActive.id !== termId) {
    await supabase
      .from('terms')
      .update({ status: 'ended' })
      .eq('id', currentActive.id)
  }

  // 2. Activate the target
  const { error } = await supabase
    .from('terms')
    .update({ status: 'active' })
    .eq('id', termId)

  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// End term
// ----------------------------------------------------------------
export async function endTerm(
  termId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('terms')
    .update({ status: 'ended' })
    .eq('id', termId)

  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// Archive term
// ----------------------------------------------------------------
export async function archiveTerm(
  termId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('terms')
    .update({ status: 'archived' })
    .eq('id', termId)

  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// Delete term
// ----------------------------------------------------------------
export async function deleteTerm(
  termId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('terms').delete().eq('id', termId)
  if (error) return { error: error.message }
  return { error: null }
}

// ----------------------------------------------------------------
// Count courses/contexts attached to a term (for delete warning)
// ----------------------------------------------------------------
export async function countTermUsage(
  termId: string
): Promise<{ programs: number; contexts: number; error: string | null }> {
  const [p, c] = await Promise.all([
    supabase
      .from('programs')
      .select('*', { count: 'exact', head: true })
      .eq('term_id', termId),
    supabase
      .from('contexts')
      .select('*', { count: 'exact', head: true })
      .eq('term_id', termId),
  ])

  return {
    programs: p.count ?? 0,
    contexts: c.count ?? 0,
    error: p.error?.message ?? c.error?.message ?? null,
  }
}