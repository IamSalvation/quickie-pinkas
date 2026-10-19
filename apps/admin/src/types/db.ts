export type AccountStatus = 'pending' | 'active' | 'paused' | 'deleted'
export type AccountTier = 'v1' | 'v2'
export type AccountPreset =
  | 'school'
  | 'university'
  | 'symposium'
  | 'bootcamp'
  | 'conference'
  | 'hotel'
  | 'event'
  | 'custom'

export type OperatorRole = 'admin' | 'lecturer' | 'staff'
export type OperatorStatus = 'active' | 'invited' | 'disabled'

export type GroupType = 'class' | 'department' | 'year' | 'cohort' | 'house' | 'custom'
export type GroupLevel = 'creche' | 'nursery' | 'primary' | 'secondary' | 'custom'
export type AttendanceMode = 'daily' | 'subject'

export interface Account {
  id: string
  name: string
  slug: string
  id_prefix: string
  status: AccountStatus
  tier: AccountTier
  preset: AccountPreset
  grading_scale: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string

  // Access limits & time (migration 030)
  max_participants: number
  max_programs: number
  max_contexts: number
  max_kiosks: number
  access_expires_at: string | null
  lockout_grace_days: number
  trial_started_at: string | null
  limits_overridden: boolean

  // Billing (migration 033)
  paystack_customer_code: string | null
  paystack_subscription_code: string | null
  paystack_plan_code: string | null
  billing_type: 'trial' | 'subscription' | 'one_time' | 'expired'
  subscription_status: 'none' | 'active' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end: string | null
  cancel_at_period_end: boolean
  paid_at: string | null
}

export interface Operator {
  id: string
  account_id: string
  email: string
  full_name: string | null
  role: OperatorRole
  is_owner: boolean
  is_platform_admin: boolean
  status: OperatorStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  account_id: string
  group_id: string | null
  system_id: string
  external_id: string | null
  full_name: string
  photo_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  account_id: string
  name: string
  type: GroupType
  parent_id: string | null
  level: GroupLevel | null
  attendance_mode: AttendanceMode
  grading_enabled: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface GroupWithParent extends Group {
  parent: { id: string; name: string } | null
  participant_count: number
  child_count: number
}