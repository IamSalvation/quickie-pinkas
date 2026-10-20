import { supabase } from '../supabase'
import type { Account, AccountTier } from '../../types/db'

export interface AccountWithCounts extends Account {
  operator_count: number
  participant_count: number
  context_count: number
}

export interface AccountOperator {
  id: string
  email: string
  full_name: string | null
  role: string
  is_owner: boolean
  is_platform_admin: boolean
  status: string
  created_at: string
}

export interface AccountStats {
  participants: number
  contexts: number
  kiosks: number
  presence_records: number
  face_enrollments: number
}

export interface AccountDetail {
  account: Account
  operators: AccountOperator[]
  stats: AccountStats
}

export async function listAllAccounts(): Promise<{
  data: AccountWithCounts[]
  error: string | null
}> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  if (!accounts) return { data: [], error: null }

  const withCounts: AccountWithCounts[] = []
  for (const a of accounts as Account[]) {
    const [ops, parts, ctxs] = await Promise.all([
      supabase
        .from('operators')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', a.id),
      supabase
        .from('participants')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', a.id),
      supabase
        .from('contexts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', a.id),
    ])

    withCounts.push({
      ...a,
      operator_count: ops.count ?? 0,
      participant_count: parts.count ?? 0,
      context_count: ctxs.count ?? 0,
    })
  }

  return { data: withCounts, error: null }
}

export async function getAccountDetail(id: string): Promise<{
  data: AccountDetail | null
  error: string | null
}> {
  const { data: account, error: acctErr } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (acctErr || !account) {
    return { data: null, error: acctErr?.message ?? 'Account not found' }
  }

  const { data: operators } = await supabase
    .from('operators')
    .select(
      'id, email, full_name, role, is_owner, is_platform_admin, status, created_at'
    )
    .eq('account_id', id)
    .order('created_at', { ascending: true })

  const [parts, ctxs, kiosks, records, faceEnrolls] = await Promise.all([
    supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id),
    supabase
      .from('contexts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id),
    supabase
      .from('kiosks')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id),
    supabase
      .from('presence_records')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id),
    supabase
      .from('participant_face_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id),
  ])

  return {
    data: {
      account: account as Account,
      operators: (operators ?? []) as AccountOperator[],
      stats: {
        participants: parts.count ?? 0,
        contexts: ctxs.count ?? 0,
        kiosks: kiosks.count ?? 0,
        presence_records: records.count ?? 0,
        face_enrollments: faceEnrolls.count ?? 0,
      },
    },
    error: null,
  }
}

async function setAccountStatus(
  id: string,
  status: 'pending' | 'active' | 'paused' | 'deleted'
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('accounts')
    .update({ status })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function approveAccount(id: string) {
  return setAccountStatus(id, 'active')
}

export async function pauseAccount(id: string) {
  return setAccountStatus(id, 'paused')
}

export async function restoreAccount(id: string) {
  return setAccountStatus(id, 'active')
}

export async function softDeleteAccount(id: string) {
  return setAccountStatus(id, 'deleted')
}

export async function upgradeTier(
  id: string,
  tier: AccountTier
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('accounts')
    .update({ tier })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function hardDeleteAccount(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export function accountStatusClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700'
    case 'pending':
      return 'bg-amber-50 text-amber-700'
    case 'paused':
      return 'bg-orange-50 text-orange-700'
    case 'deleted':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

export function accountTierClass(tier: string): string {
  switch (tier) {
    case 'v2':
      return 'bg-violet-50 text-violet-700'
    case 'v1':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

// ---------------- Account access & limits ----------------

export interface AccountLimitsUpdate {
  max_participants?: number
  max_programs?: number
  max_contexts?: number
  max_kiosks?: number
  access_expires_at?: string | null
  lockout_grace_days?: number
}

export interface AccountUsageFull {
  state: 'active' | 'grace' | 'locked'
  participants: number
  programs: number
  contexts_this_month: number
  kiosks: number
  max_participants: number
  max_programs: number
  max_contexts: number
  max_kiosks: number
  access_expires_at: string | null
  lockout_grace_days: number
}

export interface LimitChangeRow {
  id: string
  account_id: string
  changed_by: string | null
  field: string
  old_value: string | null
  new_value: string | null
  changed_at: string
}

export async function getAccountUsageFull(
  accountId: string
): Promise<{ data: AccountUsageFull | null; error: string | null }> {
  const { data, error } = await supabase.rpc('account_usage', {
    p_account_id: accountId,
  })
  if (error || !data) {
    return { data: null, error: error?.message ?? null }
  }
  return { data: data as AccountUsageFull, error: null }
}

export async function listLimitChanges(
  accountId: string,
  limit = 20
): Promise<{ data: LimitChangeRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('account_limit_changes')
    .select('*')
    .eq('account_id', accountId)
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as LimitChangeRow[], error: null }
}

/**
 * Update account limits + expiry, and log every changed field to the audit table.
 * Reads current values first so the audit log records old -> new for each field.
 */
export async function updateAccountLimits(
  accountId: string,
  updates: AccountLimitsUpdate,
  changedBy: string
): Promise<{ error: string | null }> {
  // 1. Read current values for audit log
  const { data: current, error: readErr } = await supabase
    .from('accounts')
    .select(
      'max_participants, max_programs, max_contexts, max_kiosks, access_expires_at, lockout_grace_days'
    )
    .eq('id', accountId)
    .maybeSingle()

  if (readErr || !current) {
    return { error: readErr?.message ?? 'Account not found' }
  }

  // 2. Compute diffs (normalize dates so identical timestamps in different formats are not flagged)
  const auditRows: {
    account_id: string
    changed_by: string
    field: string
    old_value: string | null
    new_value: string | null
  }[] = []

  const normalize = (v: unknown): string | null => {
    if (v === null || v === undefined) return null
    if (v instanceof Date) return v.toISOString()
    const s = String(v)
    // Only try to parse as date if the string looks ISO-like
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString()
    return s
  }

  const fields: (keyof AccountLimitsUpdate)[] = [
    'max_participants',
    'max_programs',
    'max_contexts',
    'max_kiosks',
    'access_expires_at',
    'lockout_grace_days',
  ]

  for (const f of fields) {
    if (updates[f] === undefined) continue
    const oldVal = (current as Record<string, unknown>)[f]
    const newVal = updates[f]
    const oldStr = normalize(oldVal)
    const newStr = normalize(newVal)
    if (oldStr !== newStr) {
      auditRows.push({
        account_id: accountId,
        changed_by: changedBy,
        field: f,
        old_value: oldStr,
        new_value: newStr,
      })
    }
  }

  if (auditRows.length === 0) {
    return { error: null } // nothing to do
  }

  // 3. Update the account
  const patch: Record<string, unknown> = {}
  for (const f of fields) {
    if (updates[f] !== undefined) patch[f] = updates[f]
  }
  // Mark overridden if any cap changed
  const capFields: (keyof AccountLimitsUpdate)[] = [
    'max_participants',
    'max_programs',
    'max_contexts',
    'max_kiosks',
  ]
  if (capFields.some((f) => updates[f] !== undefined)) {
    patch.limits_overridden = true
  }

  const { error: updErr } = await supabase
    .from('accounts')
    .update(patch)
    .eq('id', accountId)

  if (updErr) return { error: updErr.message }

  // 4. Write audit rows
  const { error: auditErr } = await supabase
    .from('account_limit_changes')
    .insert(auditRows)

  if (auditErr) return { error: auditErr.message }

  return { error: null }
}

export interface AccountAcademicStats {
  groups_count: number
  group_type: string
  terms_count: number
  active_term_name: string | null
  active_term_id: string | null
  sessions_count: number
  occurrences_count: number
  manual_overrides_count: number
}

export async function getAccountAcademicStats(accountId: string): Promise<{ data: AccountAcademicStats | null; error: string | null }> {
  // Fetch context IDs first (needed for occurrences count)
  const { data: contextRows } = await supabase
    .from('contexts')
    .select('id')
    .eq('account_id', accountId)
  const contextIds = (contextRows ?? []).map((c: { id: string }) => c.id)

  const [groups, terms, contexts, occurrences, manual] = await Promise.all([
    supabase.from('groups').select('*', { count: 'exact', head: true }).eq('account_id', accountId),
    supabase.from('terms').select('*').eq('account_id', accountId),
    supabase.from('contexts').select('*', { count: 'exact', head: true }).eq('account_id', accountId),
    contextIds.length > 0
      ? supabase.from('context_occurrences').select('*', { count: 'exact', head: true }).in('context_id', contextIds)
      : Promise.resolve({ count: 0, error: null }),
    supabase.from('presence_records').select('*', { count: 'exact', head: true }).eq('account_id', accountId).eq('manually_added', true)
  ])

  if (groups.error || terms.error || contexts.error || occurrences.error || manual.error) {
    return { data: null, error: 'Failed to load stats' }
  }

  const activeTerm = (terms.data ?? []).find(t => t.status === 'active')
  const groupType = groups.count && groups.count > 0 ? 'Groups' : 'Groups'

  return {
    data: {
      groups_count: groups.count ?? 0,
      group_type: groupType,
      terms_count: (terms.data ?? []).length,
      active_term_name: activeTerm ? activeTerm.name : null,
      active_term_id: activeTerm ? activeTerm.id : null,
      sessions_count: contexts.count ?? 0,
      occurrences_count: occurrences.count ?? 0,
      manual_overrides_count: manual.count ?? 0,
    },
    error: null,
  }
}

export async function platformOverrideActiveTerm(accountId: string, termId: string | null): Promise<{ error: string | null }> {
  // 1. End all currently active terms for this account
  const { error: endErr } = await supabase
    .from('terms')
    .update({ status: 'ended' })
    .eq('account_id', accountId)
    .eq('status', 'active')
  
  if (endErr) return { error: endErr.message }

  // 2. If a new term is selected, activate it
  if (termId) {
    const { error: actErr } = await supabase
      .from('terms')
      .update({ status: 'active' })
      .eq('id', termId)
    if (actErr) return { error: actErr.message }
  }

  return { error: null }
}

export async function getAccountTerms(accountId: string) {
  return await supabase.from('terms').select('id, name, status').eq('account_id', accountId).order('order_index')
}
