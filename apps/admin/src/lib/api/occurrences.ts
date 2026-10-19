import { supabase } from '../supabase'

export interface ContextOccurrence {
  id: string
  context_id: string
  session_number: number
  opened_at: string
  closed_at: string | null
  opened_by: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export async function listOccurrences(
  contextId: string
): Promise<{ data: ContextOccurrence[]; error: string | null }> {
  const { data, error } = await supabase
    .from('context_occurrences')
    .select('*')
    .eq('context_id', contextId)
    .order('session_number', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ContextOccurrence[], error: null }
}

// Wraps the RPC that gets or creates the current open occurrence
export async function getOrOpenOccurrence(
  contextId: string,
  operatorId: string
): Promise<{ data: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_or_open_occurrence', {
    p_context_id: contextId,
    p_operator_id: operatorId,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as string, error: null }
}

export async function closeCurrentOccurrence(
  contextId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('close_current_occurrence', {
    p_context_id: contextId,
  })

  if (error) return { error: error.message }
  return { error: null }
}