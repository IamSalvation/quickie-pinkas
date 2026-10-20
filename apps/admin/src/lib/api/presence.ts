import { supabase } from '../supabase'

export type PresenceMethod =
  | 'qr_kiosk_inperson'
  | 'qr_kiosk_online'
  | 'id_entry_online'
  | 'manual'
  | 'face_verified'

export type PresenceMode = 'in_person' | 'online'
export type PresenceStatus = 'present' | 'absent'

export type FaceMatchResult = 'match' | 'no_match' | 'not_attempted'
export type FaceAttemptReason =
  | 'no_enrollment'
  | 'no_face_detected'
  | 'low_quality'
  | 'rpc_error'
  | null
export type FaceReviewStatus = 'pending' | 'approved' | 'rejected' | null

export interface PresenceRecord {
  id: string
  account_id: string
  participant_id: string
  context_id: string
  occurrence_id: string | null
  manually_added: boolean
  added_reason: string | null
  kiosk_id: string | null
  checked_in_at: string
  checked_out_at: string | null
  method: PresenceMethod
  mode: PresenceMode
  verified: boolean
  face_score: number | null
  face_match_result: FaceMatchResult | null
  face_verification_method: string | null
  face_attempt_reason: FaceAttemptReason
  face_review_status: FaceReviewStatus
  photo_url: string | null
  needs_review: boolean
  status: PresenceStatus
  resolved_by: string | null
  resolved_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PresenceWithParticipant extends PresenceRecord {
  participant: {
    id: string
    full_name: string
    system_id: string
    external_id: string | null
    photo_url: string | null
  } | null
}

export async function listPresenceForContext(
  contextId: string,
  opts: { limit?: number } = {}
): Promise<{
  data: PresenceWithParticipant[]
  count: number
  error: string | null
}> {
  const limit = opts.limit ?? 500

  const { data, count, error } = await supabase
    .from('presence_records')
    .select(
      '*, participant:participants(id, full_name, system_id, external_id, photo_url)',
      { count: 'exact' }
    )
    .eq('context_id', contextId)
    .order('checked_in_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], count: 0, error: error.message }

  const rows = (data ?? []).map((row) => {
    const participant = Array.isArray(row.participant)
      ? row.participant[0]
      : row.participant
    return {
      ...row,
      participant: participant ?? null,
    } as PresenceWithParticipant
  })

  return { data: rows, count: count ?? 0, error: null }
}

export interface KioskCheckinResult {
  ok: boolean
  code:
    | 'checked_in'
    | 'checked_out'
    | 'already_checked_in'
    | 'not_checked_in'
    | 'marked_absent'
    | 'unknown_device'
    | 'device_revoked'
    | 'no_open_context'
    | 'unknown_participant'
  message: string
  participant?: {
    id: string
    full_name: string
    system_id: string
    photo_url: string | null
  }
  record?: {
    id: string
    checked_in_at: string
    checked_out_at?: string | null
  }
  context?: {
    id: string
    label: string
  }
  checked_in_at?: string
}

export async function kioskCheckin(
  deviceToken: string,
  systemId: string
): Promise<{ data: KioskCheckinResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kiosk_checkin', {
    p_device_token: deviceToken,
    p_system_id: systemId,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as KioskCheckinResult, error: null }
}

export interface KioskContextResult {
  ok: boolean
  code: 'ok' | 'unknown_device' | 'device_revoked' | 'no_open_context'
  message: string
  kiosk?: { id: string; label: string }
  context?: {
    id: string
    label: string
    checkout_enabled: boolean
    phase?: 'in' | 'out'
  }
}

export async function kioskLookupContext(
  deviceToken: string
): Promise<{ data: KioskContextResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kiosk_lookup_context', {
    p_device_token: deviceToken,
  })

  if (error) return { data: null, error: error.message }
  return { data: data as KioskContextResult, error: null }
}

export async function updatePresencePhoto(
  recordId: string,
  photoUrl: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('presence_records')
    .update({ photo_url: photoUrl })
    .eq('id', recordId)
  return { error: error?.message ?? null }
}

export interface KioskVerifyResult {
  ok: boolean
  distance: number | null
  score: number | null
  result: FaceMatchResult
  reason?: FaceAttemptReason
  message?: string
}

export async function kioskVerifyFace(
  deviceToken: string,
  recordId: string,
  embedding: number[] | null
): Promise<{ data: KioskVerifyResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('kiosk_verify_face', {
    p_device_token: deviceToken,
    p_record_id: recordId,
    p_live_embedding: embedding,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as KioskVerifyResult, error: null }
}

export async function resolveCheckout(
  presenceId: string,
  checkedOutAt: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('resolve_checkout', {
    p_presence_id: presenceId,
    p_checked_out_at: checkedOutAt,
  })

  if (error) return { error: error.message }

  const result = data as { ok: boolean; message?: string }
  if (!result.ok) return { error: result.message ?? 'Could not resolve' }
  return { error: null }
}

export async function resolveAbsent(
  presenceId: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('resolve_absent', {
    p_presence_id: presenceId,
  })

  if (error) return { error: error.message }

  const result = data as { ok: boolean; message?: string }
  if (!result.ok) return { error: result.message ?? 'Could not resolve' }
  return { error: null }
}

export async function approveFaceCheckin(
  recordId: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('approve_face_checkin', {
    p_record_id: recordId,
  })
  if (error) return { error: error.message }
  const result = data as { ok: boolean; message?: string }
  if (!result.ok) return { error: result.message ?? 'Could not approve' }
  return { error: null }
}

export async function rejectFaceCheckin(
  recordId: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('reject_face_checkin', {
    p_record_id: recordId,
  })
  if (error) return { error: error.message }
  const result = data as { ok: boolean; message?: string }
  if (!result.ok) return { error: result.message ?? 'Could not reject' }
  return { error: null }
}

export async function addManualAttendance(
  accountId: string,
  participantId: string,
  contextId: string,
  occurrenceId: string,
  operatorId: string,
  reason: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('presence_records')
    .insert({
      account_id: accountId,
      participant_id: participantId,
      context_id: contextId,
      occurrence_id: occurrenceId,
      method: 'manual',
      mode: 'in_person',
      status: 'present',
      checked_in_at: new Date().toISOString(),
      checked_out_at: new Date().toISOString(), // Auto-checkout for manual overrides
      verified: true,
      manually_added: true,
      added_by: operatorId,
      added_reason: reason,
    })

  if (error) return { error: error.message }
  return { error: null }
}

export interface ManualOverrideRecord {
  id: string
  checked_in_at: string
  added_reason: string | null
  participant: {
    full_name: string
    system_id: string
  } | null
  context: {
    label: string
  } | null
  occurrence: {
    session_number: number
  } | null
}

export async function listManualOverrides(
  accountId: string,
  limit = 50
): Promise<{ data: ManualOverrideRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from('presence_records')
    .select(`
      id,
      checked_in_at,
      added_reason,
      participant:participants(full_name, system_id),
      context:contexts(label),
      occurrence:context_occurrences(session_number)
    `)
    .eq('account_id', accountId)
    .eq('manually_added', true)
    .order('checked_in_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  
  // Flatten the joins (Supabase returns arrays for joins sometimes)
  const rows = (data ?? []).map((row) => {
    const p = Array.isArray(row.participant) ? row.participant[0] : row.participant
    const c = Array.isArray(row.context) ? row.context[0] : row.context
    const o = Array.isArray(row.occurrence) ? row.occurrence[0] : row.occurrence
    return {
      ...row,
      participant: p ?? null,
      context: c ?? null,
      occurrence: o ?? null,
    } as ManualOverrideRecord
  })

  return { data: rows, error: null }
}

export async function deleteManualOverride(
  recordId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('presence_records')
    .delete()
    .eq('id', recordId)
    .eq('manually_added', true) // Safety: only allow deleting manual records

  if (error) return { error: error.message }
  return { error: null }
}