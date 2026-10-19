import { supabase } from '../supabase'
import type { Account } from '../../types/db'

export interface Participant {
  id: string
  account_id: string
  group_id: string | null
  full_name: string
  system_id: string
  external_id: string | null
  photo_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ListParticipantsOptions {
  search?: string
  limit?: number
  offset?: number
  groupId?: string
}

export async function listParticipants(
  accountId: string,
  opts: ListParticipantsOptions = {}
): Promise<{ data: Participant[]; count: number; error: string | null }> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  let query = supabase
    .from('participants')
    .select('*', { count: 'exact' })
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.groupId) {
    query = query.eq('group_id', opts.groupId)
  }

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim()
    query = query.or(
      `full_name.ilike.%${s}%,system_id.ilike.%${s}%,external_id.ilike.%${s}%`
    )
  }

  const { data, count, error } = await query

  if (error) {
    return { data: [], count: 0, error: error.message }
  }

  return { data: (data ?? []) as Participant[], count: count ?? 0, error: null }
}

export async function getParticipant(
  id: string
): Promise<{ data: Participant | null; error: string | null }> {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: 'Not found' }
  return { data: data as Participant, error: null }
}

export interface CreateParticipantInput {
  accountId: string
  fullName: string
  externalId?: string | null
}

export async function createParticipant(
  input: CreateParticipantInput
): Promise<{ data: Participant | null; error: string | null }> {
  const fullName = input.fullName.trim()
  if (!fullName) {
    return { data: null, error: 'Name is required' }
  }

  const { data: sysId, error: rpcError } = await supabase.rpc(
    'next_participant_system_id',
    { p_account_id: input.accountId }
  )

  if (rpcError || !sysId) {
    return {
      data: null,
      error: rpcError?.message ?? 'Could not generate system_id',
    }
  }

  const externalId = input.externalId?.trim() || null

  const { data, error } = await supabase
    .from('participants')
    .insert({
      account_id: input.accountId,
      full_name: fullName,
      system_id: sysId,
      external_id: externalId,
    })
    .select('*')
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: data as Participant, error: null }
}

export async function updateParticipant(
  id: string,
  updates: { full_name?: string; external_id?: string | null }
): Promise<{ data: Participant | null; error: string | null }> {
  const { data, error } = await supabase
    .from('participants')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data: data as Participant, error: null }
}

export async function deleteParticipant(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('participants').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export function useAccountId(account: Account | null): string | null {
  return account?.id ?? null
}

// ---------------- Bulk create ----------------

export interface BulkRow {
  full_name: string
  external_id: string | null
}

export interface BulkImportResult {
  imported: number
  skipped_duplicate: number
  failed_missing_name: number
  errors: string[]
}

/**
 * Bulk-create participants for an account.
 * - Auto-generates system_id via the existing next_participant_system_id RPC
 * - Skips rows where external_id already exists in this account
 * - Skips rows with a blank full_name
 * - Batches inserts to avoid network timeouts on large imports
 */
export async function bulkCreateParticipants(
  accountId: string,
  rows: BulkRow[],
  onProgress?: (done: number, total: number) => void
): Promise<{ data: BulkImportResult | null; error: string | null }> {
  const result: BulkImportResult = {
    imported: 0,
    skipped_duplicate: 0,
    failed_missing_name: 0,
    errors: [],
  }

  // 1. Load existing external_ids for this account
  const { data: existing, error: existingErr } = await supabase
    .from('participants')
    .select('external_id')
    .eq('account_id', accountId)
    .not('external_id', 'is', null)

  if (existingErr) {
    return { data: null, error: existingErr.message }
  }

  const existingExternalIds = new Set(
    (existing ?? [])
      .map((r) => (r.external_id ?? '').toString().toLowerCase())
      .filter(Boolean)
  )

  const seenInBatch = new Set<string>()
  const validRows: BulkRow[] = []

  // 2. Validate + dedupe
  for (const row of rows) {
    const name = (row.full_name ?? '').trim()
    if (!name) {
      result.failed_missing_name++
      continue
    }

    const ext = row.external_id?.trim() || null
    if (ext) {
      const key = ext.toLowerCase()
      if (existingExternalIds.has(key) || seenInBatch.has(key)) {
        result.skipped_duplicate++
        continue
      }
      seenInBatch.add(key)
    }

    validRows.push({ full_name: name, external_id: ext })
  }

  // 3. Insert in batches
  const BATCH = 100
  const total = validRows.length

  for (let i = 0; i < total; i += BATCH) {
    const batch = validRows.slice(i, i + BATCH)

    // Generate system_ids for the batch in parallel
    const idPromises = batch.map(() =>
      supabase.rpc('next_participant_system_id', {
        p_account_id: accountId,
      })
    )
    const idResults = await Promise.all(idPromises)

    const inserts: {
      account_id: string
      full_name: string
      system_id: string
      external_id: string | null
    }[] = []

    for (let j = 0; j < batch.length; j++) {
      const rpc = idResults[j]
      if (rpc.error || !rpc.data) {
        result.errors.push(
          'Row ' +
            (i + j + 1) +
            ': ' +
            (rpc.error?.message ?? 'no system_id returned')
        )
        continue
      }
      inserts.push({
        account_id: accountId,
        full_name: batch[j].full_name,
        system_id: rpc.data as string,
        external_id: batch[j].external_id,
      })
    }

    if (inserts.length === 0) continue

    const { error: insertErr } = await supabase
      .from('participants')
      .insert(inserts)

    if (insertErr) {
      // Could be a partial-unique-index clash on external_id
      result.errors.push(
        'Batch ' +
          Math.floor(i / BATCH + 1) +
          ': ' +
          insertErr.message
      )
      continue
    }

    result.imported += inserts.length

    if (onProgress) {
      onProgress(Math.min(i + BATCH, total), total)
    }
  }

  return { data: result, error: null }
}