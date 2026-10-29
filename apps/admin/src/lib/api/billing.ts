import { supabase } from '../supabase'

export type PurchaseType = 'v1' | 'v2' | 'event_pass'

export interface BillingStatus {
  tier: string
  billing_type: 'trial' | 'subscription' | 'one_time' | 'expired'
  subscription_status: 'none' | 'active' | 'past_due' | 'canceled' | 'incomplete'
  access_expires_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  paid_at: string | null
  preset: string
}

export interface InitializeResult {
  authorization_url: string
  access_code: string
  reference: string
}

/**
 * Initialize a Paystack checkout for the given purchase type.
 * Returns { authorization_url } on success. Redirect the user there.
 */
export async function initializeCheckout(
  accountId: string,
  purchaseType: PurchaseType,
  eventEndDate?: string
): Promise<{ data: InitializeResult | null; error: string | null }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return { data: null, error: 'Missing Supabase config' }
  }

  // Get current session for auth header
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    return { data: null, error: 'Not signed in' }
  }

  const body: Record<string, unknown> = {
    account_id: accountId,
    purchase_type: purchaseType,
  }
  if (purchaseType === 'event_pass' && eventEndDate) {
    body.event_end_date = eventEndDate
  }

  // Explicitly get a fresh session to avoid stale tokens after downgrade
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    return { data: null, error: 'Your session expired. Please sign out and sign back in.' }
  }

  const res = await fetch(supabaseUrl + '/functions/v1/paystack-initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.access_token,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let msg = 'Checkout failed'
    try {
      const j = await res.json()
      msg = j.error ?? msg
    } catch {
      // ignore
    }
    return { data: null, error: msg }
  }

  const data = (await res.json()) as InitializeResult
  return { data, error: null }
}

/**
 * Read billing status from the current account.
 */
export function readBillingStatus(account: {
  tier: string
  billing_type: string
  subscription_status: string
  access_expires_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  paid_at: string | null
  preset: string
}): BillingStatus {
  return {
    tier: account.tier,
    billing_type: (account.billing_type as BillingStatus['billing_type']) ?? 'trial',
    subscription_status:
      (account.subscription_status as BillingStatus['subscription_status']) ?? 'none',
    access_expires_at: account.access_expires_at,
    current_period_end: account.current_period_end,
    cancel_at_period_end: account.cancel_at_period_end,
    paid_at: account.paid_at,
    preset: account.preset,
  }
}

/**
 * Which purchase options should be shown for a given preset?
 * School/hotel -> V1 and V2 subscriptions
 * Others -> Event Pass one-time
 */
export function purchaseOptionsForPreset(preset: string): PurchaseType[] {
  if (preset === 'school' || preset === 'hotel') {
    return ['v1', 'v2']
  }
  return ['event_pass']
}

/**
 * Format a date for display.
 */
export function formatBillingDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Days remaining until a date. Negative if past.
 */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}