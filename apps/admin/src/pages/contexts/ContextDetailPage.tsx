import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import {
  getContext,
  switchContextPhase,
  closeContext,
  deleteContext,
  CONTEXT_TYPE_LABELS,
  type ContextWithProgram,
  type ContextStatus,
  type ContextPhase,
} from '../../lib/api/contexts'
import {
  listPresenceForContext,
  resolveCheckout,
  resolveAbsent,
  approveFaceCheckin,
  rejectFaceCheckin,
  type PresenceWithParticipant,
} from '../../lib/api/presence'
import { listKiosks, type Kiosk } from '../../lib/api/kiosks'
import {
  openOnlineCheckin,
  closeOnlineCheckin,
  buildOnlineUrl,
} from '../../lib/api/onlineCheckin'
import OpenContextModal from './OpenContextModal'
import { getOrOpenOccurrence, closeCurrentOccurrence } from '../../lib/api/occurrences'

function StatusBadge({ status }: { status: ContextStatus }) {
  const styles: Record<ContextStatus, string> = {
    scheduled: 'bg-slate-100 text-slate-700',
    open: 'bg-emerald-50 text-emerald-700',
    closed: 'bg-slate-100 text-slate-500',
    cancelled: 'bg-red-50 text-red-700',
  }
  const labels: Record<ContextStatus, string> = {
    scheduled: 'Scheduled',
    open: 'Open',
    closed: 'Closed',
    cancelled: 'Cancelled',
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function PhaseBadge({ phase }: { phase: ContextPhase }) {
  return (
    <span
      className={[
        'rounded px-2 py-0.5 text-xs font-medium',
        phase === 'in'
          ? 'bg-blue-50 text-blue-700'
          : 'bg-amber-50 text-amber-700',
      ].join(' ')}
    >
      {phase === 'in' ? 'Check-in phase' : 'Check-out phase'}
    </span>
  )
}

function FaceBadge({ record }: { record: PresenceWithParticipant }) {
  if (record.face_match_result === 'match') {
    return (
      <span
        className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
        title={
          record.face_score !== null
            ? 'Face match score: ' + Math.round(record.face_score * 100) + '%'
            : 'Face matched'
        }
      >
        Verified
        {record.face_score !== null &&
          ' ' + Math.round(record.face_score * 100) + '%'}
      </span>
    )
  }

  if (record.face_match_result === 'no_match') {
    if (record.face_review_status === 'approved') {
      return (
        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          Verified (approved)
        </span>
      )
    }
    if (record.face_review_status === 'rejected') {
      return (
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
          Face rejected
        </span>
      )
    }
    return (
      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        Face mismatch
      </span>
    )
  }

  if (record.face_match_result === 'not_attempted') {
    if (record.face_attempt_reason === 'no_enrollment') {
      return (
        <span
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
          title="Participant has no enrolled face"
        >
          Not enrolled
        </span>
      )
    }
    if (record.face_attempt_reason === 'no_face_detected') {
      return (
        <span
          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
          title="Participant is enrolled, but no face was detected in the scan"
        >
          No face
        </span>
      )
    }
    if (record.face_attempt_reason === 'rpc_error') {
      return (
        <span
          className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600"
          title="Face verification encountered an error"
        >
          Error
        </span>
      )
    }
    return (
      <span
        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
        title={record.face_attempt_reason ?? ''}
      >
        Not verified
      </span>
    )
  }

  return null
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const METHOD_LABELS: Record<string, string> = {
  qr_kiosk_inperson: 'QR (kiosk)',
  qr_kiosk_online: 'QR (online)',
  id_entry_online: 'ID entry',
  manual: 'Manual',
  face_verified: 'Face verified',
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ContextDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { account, operator } = useAuth()
  const preset = getPreset(account?.preset)

  const [context, setContext] = useState<ContextWithProgram | null>(null)
  const [attendance, setAttendance] = useState<PresenceWithParticipant[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [loading, setLoading] = useState(true)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const [onlineWorking, setOnlineWorking] = useState(false)
  const [onlineError, setOnlineError] = useState<string | null>(null)
  const [showOnlineExpiryPicker, setShowOnlineExpiryPicker] = useState(false)

  const loadContext = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await getContext(id)
    setContext(data)
    setError(err)
    setLoading(false)
  }, [id])

  const loadAttendance = useCallback(async () => {
    if (!id) return
    setAttendanceLoading(true)
    const { data } = await listPresenceForContext(id, { limit: 500 })
    setAttendance(data)
    setAttendanceLoading(false)
  }, [id])

  const loadKiosks = useCallback(async () => {
    if (!account || !id) return
    const { data } = await listKiosks(account.id, { status: 'active' })
    setKiosks(data.filter((k) => k.context_id === id))
  }, [account, id])

  useEffect(() => {
    loadContext()
    loadAttendance()
    loadKiosks()
  }, [loadContext, loadAttendance, loadKiosks])

  useEffect(() => {
    if (!context || context.status !== 'open') return
    const iv = setInterval(() => {
      loadAttendance()
    }, 5000)
    return () => clearInterval(iv)
  }, [context, loadAttendance])

  async function handleSwitchPhase() {
    if (!context) return
    setWorking(true)
    const { error: err } = await switchContextPhase(context.id)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    loadContext()
  }

  async function handleClose() {
    if (!context) return

    if (context.is_recurring) {
      await closeCurrentOccurrence(context.id)
    }

    const openCount = attendance.filter(
      (r) => r.checked_out_at === null && r.status === 'present'
    ).length

    const msg = context.checkout_enabled
      ? `Close "${context.label}"?\n\n${openCount} participant${openCount === 1 ? '' : 's'} still checked in will be flagged for review.`
      : `Close "${context.label}"?`

    if (!confirm(msg)) return

    setWorking(true)
    const { error: err } = await closeContext(context.id)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    loadContext()
    loadAttendance()
  }

  async function handleDelete() {
    if (!context) return
    if (
      !confirm(
        `Permanently delete "${context.label}"? Attendance records will also be deleted.`
      )
    )
      return
    setWorking(true)
    const { error: err } = await deleteContext(context.id)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    navigate('/contexts')
  }

  async function handleResolveCheckout(rec: PresenceWithParticipant) {
    const defaultTime = toLocalInput(new Date().toISOString())
    const picked = prompt(
      `Check-out time for ${rec.participant?.full_name}?\n(YYYY-MM-DDTHH:MM)`,
      defaultTime
    )
    if (!picked) return

    const iso = new Date(picked).toISOString()
    if (isNaN(new Date(picked).getTime())) {
      alert('Invalid date/time')
      return
    }

    setResolvingId(rec.id)
    const { error: err } = await resolveCheckout(rec.id, iso)
    setResolvingId(null)
    if (err) {
      alert(err)
      return
    }
    loadAttendance()
  }

  async function handleResolveAbsent(rec: PresenceWithParticipant) {
    if (
      !confirm(
        `Mark ${rec.participant?.full_name} as absent? Their check-in will not count toward attendance.`
      )
    )
      return
    setResolvingId(rec.id)
    const { error: err } = await resolveAbsent(rec.id)
    setResolvingId(null)
    if (err) {
      alert(err)
      return
    }
    loadAttendance()
  }

  async function handleApproveFace(rec: PresenceWithParticipant) {
    setResolvingId(rec.id)
    const { error: err } = await approveFaceCheckin(rec.id)
    setResolvingId(null)
    if (err) {
      alert(err)
      return
    }
    loadAttendance()
  }

  async function handleRejectFace(rec: PresenceWithParticipant) {
    if (
      !confirm(
        `Reject ${rec.participant?.full_name}'s check-in? They will be marked absent.`
      )
    )
      return
    setResolvingId(rec.id)
    const { error: err } = await rejectFaceCheckin(rec.id)
    setResolvingId(null)
    if (err) {
      alert(err)
      return
    }
    loadAttendance()
  }

  async function handleOpenOnline(minutes: number | null) {
    if (!context) return
    setOnlineError(null)
    setOnlineWorking(true)
    const { data, error: err } = await openOnlineCheckin(context.id, minutes)
    setOnlineWorking(false)
    setShowOnlineExpiryPicker(false)

    if (err || !data?.ok) {
      setOnlineError(err ?? data?.message ?? 'Could not open')
      return
    }

    loadContext()
  }

  async function handleCloseOnline() {
    if (!context) return
    if (
      !confirm(
        'Close online check-in? Students with the link will not be able to check in.'
      )
    )
      return

    setOnlineError(null)
    setOnlineWorking(true)
    const { error: err } = await closeOnlineCheckin(context.id)
    setOnlineWorking(false)

    if (err) {
      setOnlineError(err)
      return
    }
    loadContext()
  }

  function copyOnlineUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => alert('URL copied'),
      () => alert('Copy failed')
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-5xl text-sm text-slate-500">Loading...</div>
      </div>
    )
  }

  if (error || !context) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-5xl">
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error ?? 'Not found'}
          </div>
          <Link
            to="/contexts"
            className="mt-4 inline-block text-sm text-slate-600 hover:underline"
          >
            &lt;- Back to {preset.labels.contexts}
          </Link>
        </div>
      </div>
    )
  }

  const flagged = attendance.filter(
    (r) =>
      r.needs_review &&
      r.status === 'present' &&
      r.face_review_status !== 'pending'
  )

  const facePending = attendance.filter(
    (r) => r.face_review_status === 'pending'
  )

  const presentCount = attendance.filter((r) => r.status === 'present').length
  const absentCount = attendance.filter((r) => r.status === 'absent').length
  const checkedOutCount = attendance.filter(
    (r) => r.checked_out_at !== null && r.status === 'present'
  ).length
  const onlineCount = attendance.filter((r) => r.mode === 'online').length
  const inPersonCount = attendance.filter((r) => r.mode === 'in_person').length

  const onlineIsLive =
    context.status === 'open' &&
    context.public_checkin_open &&
    context.public_checkin_code &&
    (context.public_checkin_expires === null ||
      new Date(context.public_checkin_expires) > new Date())

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        <Link to="/contexts" className="text-xs text-slate-500 hover:underline">
          &lt;- Back to {preset.labels.contexts}
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {context.label}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={context.status} />
              {context.status === 'open' && <PhaseBadge phase={context.phase} />}
              <span className="text-xs text-slate-500">
                {CONTEXT_TYPE_LABELS[context.type]}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {context.status === 'scheduled' && (
              <button
                onClick={() => setShowOpenModal(true)}
                disabled={working}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Open for check-in
              </button>
            )}

            {context.status === 'open' && (
              <>
                <button
                  onClick={handleSwitchPhase}
                  disabled={working}
                  className={[
                    'rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                    context.phase === 'in'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700',
                  ].join(' ')}
                >
                  {context.phase === 'in'
                    ? 'Switch to check-out'
                    : 'Switch to check-in'}
                </button>
                <button
                  onClick={handleClose}
                  disabled={working}
                  className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Close session
                </button>
              </>
            )}

            {context.status === 'closed' && (
              <button
                onClick={() => setShowOpenModal(true)}
                disabled={working}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Re-open
              </button>
            )}
          </div>
        </div>

        {context.status === 'open' && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-slate-900">
                  Online check-in
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Share this link so students can check in from their phones.
                </p>
              </div>
              {onlineIsLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              )}
            </div>

            {onlineError && (
              <div className="mt-3 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {onlineError}
              </div>
            )}

            {onlineIsLive ? (
              <div className="mt-4 space-y-3">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Link
                  </div>
                  <code className="mt-1 block break-all font-mono text-xs text-slate-800">
                    {buildOnlineUrl(context.public_checkin_code ?? '')}
                  </code>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <button
                      onClick={() =>
                        copyOnlineUrl(
                          buildOnlineUrl(context.public_checkin_code ?? '')
                        )
                      }
                      className="text-slate-700 hover:underline"
                    >
                      Copy link
                    </button>
                    <a
                      href={buildOnlineUrl(context.public_checkin_code ?? '')}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-700 hover:underline"
                    >
                      Open
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div>
                    <span className="font-mono font-semibold text-slate-900 text-base">
                      {context.public_checkin_code}
                    </span>
                    <span className="ml-2 text-slate-400">
                      {context.public_checkin_expires
                        ? 'expires ' +
                          new Date(
                            context.public_checkin_expires
                          ).toLocaleTimeString()
                        : 'manual close'}
                    </span>
                  </div>
                  <button
                    onClick={handleCloseOnline}
                    disabled={onlineWorking}
                    className="rounded border border-red-300 bg-white px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Close online
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                {!showOnlineExpiryPicker ? (
                  <button
                    onClick={() => setShowOnlineExpiryPicker(true)}
                    disabled={onlineWorking}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Open online check-in
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-700">
                      How long should it stay open?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleOpenOnline(15)}
                        disabled={onlineWorking}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        15 min
                      </button>
                      <button
                        onClick={() => handleOpenOnline(30)}
                        disabled={onlineWorking}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        30 min
                      </button>
                      <button
                        onClick={() => handleOpenOnline(60)}
                        disabled={onlineWorking}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        60 min
                      </button>
                      <button
                        onClick={() => handleOpenOnline(null)}
                        disabled={onlineWorking}
                        className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Manual
                      </button>
                      <button
                        onClick={() => setShowOnlineExpiryPicker(false)}
                        disabled={onlineWorking}
                        className="rounded px-3 py-2 text-sm text-slate-500 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {facePending.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-700">!</span>
              <h2 className="text-sm font-semibold text-amber-900">
                Face review ({facePending.length} pending)
              </h2>
            </div>
            <p className="mt-1 text-xs text-amber-800">
              These check-ins failed face verification. Compare the enrolled
              photo with the live selfie and decide: approve the check-in or
              reject it (mark the participant absent).
            </p>

            <ul className="mt-4 space-y-3">
              {facePending.map((r) => (
                <li
                  key={r.id}
                  className="rounded border border-amber-200 bg-white p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3 items-center">
                      {r.participant?.photo_url ? (
                        <div className="text-center">
                          <img
                            src={r.participant.photo_url}
                            alt="Enrolled"
                            className="h-16 w-16 rounded border-2 border-slate-300 object-cover"
                          />
                          <div className="mt-1 text-[9px] text-slate-500">
                            Enrolled
                          </div>
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                          No enroll
                        </div>
                      )}

                      {r.photo_url ? (
                        <div className="text-center">
                          <img
                            src={r.photo_url}
                            alt="Live"
                            className="h-16 w-16 rounded border-2 border-amber-400 object-cover"
                          />
                          <div className="mt-1 text-[9px] text-slate-500">
                            Live
                          </div>
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                          No selfie
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {r.participant?.full_name ?? '-'}
                        </div>
                        <div className="text-xs text-slate-600">
                          Checked in {formatTime(r.checked_in_at)}
                        </div>
                        <div className="text-xs text-amber-700 mt-1">
                          {r.face_attempt_reason === 'no_face_detected' ? (
                            'No face detected in selfie'
                          ) : r.face_attempt_reason === 'no_enrollment' ? (
                            'Not enrolled'
                          ) : r.face_score !== null ? (
                            'Score: ' +
                            Math.round(r.face_score * 100) +
                            '% (need >= 45% for match)'
                          ) : (
                            'No score'
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 sm:flex-col">
                      <button
                        onClick={() => handleApproveFace(r)}
                        disabled={resolvingId === r.id}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectFace(r)}
                        disabled={resolvingId === r.id}
                        className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject (mark absent)
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-5 shadow lg:col-span-1">
            <h2 className="text-sm font-medium text-slate-900">Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">{preset.labels.program}</dt>
                <dd className="mt-0.5 text-slate-900">
                  {context.program ? (
                    <>
                      {context.program.name}
                      {context.program.code && (
                        <span className="ml-1 text-xs text-slate-500">
                          ({context.program.code})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Location</dt>
                <dd className="mt-0.5 text-slate-900">
                  {context.location ?? (
                    <span className="text-slate-400">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Starts</dt>
                <dd className="mt-0.5 text-slate-900">
                  {formatDateTime(context.starts_at)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Ends</dt>
                <dd className="mt-0.5 text-slate-900">
                  {formatDateTime(context.ends_at)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Check-out required</dt>
                <dd className="mt-0.5 text-slate-900">
                  {context.checkout_enabled ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Bound kiosks</dt>
                <dd className="mt-0.5 text-slate-900">
                  {kiosks.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {kiosks.map((k) => (
                        <li key={k.id} className="text-sm">
                          {k.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg bg-white p-5 shadow lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-900">Attendance</h2>
              <div className="flex items-center gap-3">
                {context.status === 'open' && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                )}
                <button
                  onClick={loadAttendance}
                  disabled={attendanceLoading}
                  className="text-xs text-slate-500 hover:underline disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {presentCount} present
              {absentCount > 0 && ` - ${absentCount} absent`}
              {checkedOutCount > 0 && ` - ${checkedOutCount} checked out`}
              {onlineCount > 0 && ` - ${onlineCount} online`}
              {inPersonCount > 0 && ` - ${inPersonCount} in-person`}
            </p>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {attendanceLoading && attendance.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  Loading...
                </div>
              ) : attendance.length === 0 ? (
                <div className="rounded border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-500">No check-ins yet.</p>
                  {context.status === 'open' && (
                    <p className="mt-1 text-xs text-slate-400">
                      Kiosk and online check-ins will appear here automatically.
                    </p>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">In</th>
                      <th className="pb-2 font-medium">Out</th>
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium">Face</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map((r) => (
                      <tr
                        key={r.id}
                        className={r.status === 'absent' ? 'opacity-50' : ''}
                      >
                        <td className="py-2 text-slate-900">
                          <div className="flex items-center gap-2">
                            {r.participant?.photo_url ? (
                              <img
                                src={r.participant.photo_url}
                                alt=""
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-slate-100 text-[10px] flex items-center justify-center text-slate-500">
                                {r.participant?.full_name.charAt(0) ?? '?'}
                              </div>
                            )}
                            <span>{r.participant?.full_name ?? '-'}</span>
                            {r.status === 'absent' && (
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                                Absent
                              </span>
                            )}
                            {r.needs_review &&
                              r.face_review_status !== 'pending' && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                  Review
                                </span>
                              )}
                            {r.mode === 'online' && (
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                Online
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-slate-600">
                          {formatTime(r.checked_in_at)}
                        </td>
                        <td className="py-2 text-slate-600">
                          {r.checked_out_at
                            ? formatTime(r.checked_out_at)
                            : '-'}
                        </td>
                        <td className="py-2 text-slate-600">
                          {METHOD_LABELS[r.method] ?? r.method}
                        </td>
                        <td className="py-2">
                          <FaceBadge record={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {flagged.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-700">!</span>
              <h2 className="text-sm font-semibold text-amber-900">
                {flagged.length} participant
                {flagged.length === 1 ? '' : 's'} need review
              </h2>
            </div>
            <p className="mt-1 text-xs text-amber-800">
              These participants checked in but never checked out. Mark them out
              with a time, or mark them absent if they weren't actually present.
            </p>

            <ul className="mt-4 divide-y divide-amber-200">
              {flagged.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {r.participant?.full_name ?? '-'}
                    </div>
                    <div className="text-xs text-slate-600">
                      in {formatTime(r.checked_in_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolveCheckout(r)}
                      disabled={resolvingId === r.id}
                      className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Mark out
                    </button>
                    <button
                      onClick={() => handleResolveAbsent(r)}
                      disabled={resolvingId === r.id}
                      className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Mark absent
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleDelete}
            disabled={working}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Delete this {preset.labels.context.toLowerCase()}
          </button>
        </div>
      </div>

      <OpenContextModal
        open={showOpenModal}
        context={context}
        onClose={() => setShowOpenModal(false)}
        onOpened={async () => {
          if (context?.is_recurring && operator?.id) {
            await getOrOpenOccurrence(context.id, operator.id)
          }
          loadContext()
          loadKiosks()
          loadAttendance()
        }}
      />
    </div>
  )
}