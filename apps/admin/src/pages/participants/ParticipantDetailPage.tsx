import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import {
  getParticipant,
  deleteParticipant,
  type Participant,
} from '../../lib/api/participants'
import {
  uploadParticipantPhoto,
  deleteParticipantPhoto,
} from '../../lib/api/photos'
import { supabase } from '../../lib/supabase'
import ParticipantBadge from '../../components/badge/ParticipantBadge'
import PhotoCapture from '../../components/PhotoCapture'
import FaceEnrollmentModal from '../../components/FaceEnrollmentModal'
import { listGroups, getGroup, assignParticipantToGroup } from '../../lib/api/groups'
import type { Group, GroupWithParent } from '../../types/db'

interface FaceEnrollmentInfo {
  enrolled: boolean
  enrolled_at: string | null
}

export default function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { account } = useAuth()
  const preset = getPreset(account?.preset)

  const [participant, setParticipant] = useState<Participant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [faceInfo, setFaceInfo] = useState<FaceEnrollmentInfo>({
    enrolled: false,
    enrolled_at: null,
  })
  const [showFaceModal, setShowFaceModal] = useState(false)

  const [participantGroup, setParticipantGroup] = useState<Group | null>(null)
  const [allGroups, setAllGroups] = useState<GroupWithParent[]>([])
  const [savingGroup, setSavingGroup] = useState(false)

  const isV2 = account?.tier === 'v2'

  useEffect(() => {
    document.body.classList.add('printing-badge')
    return () => {
      document.body.classList.remove('printing-badge')
    }
  }, [])

  const loadGroupAndOptions = useCallback(async () => {
    if (!id || !account) return
    // Fetch participant's current group
    const { data: p } = await supabase
      .from('participants')
      .select('group_id')
      .eq('id', id)
      .maybeSingle()

    if (p?.group_id) {
      const { data: g } = await getGroup(p.group_id)
      setParticipantGroup(g)
    } else {
      setParticipantGroup(null)
    }

    // Fetch all groups for the picker
    const { data: groups } = await listGroups(account.id)
    setAllGroups(groups)
  }, [id, account])

  async function handleChangeGroup(newGroupId: string | null) {
    if (!participant) return
    setSavingGroup(true)
    const { error: err } = await assignParticipantToGroup(participant.id, newGroupId)
    setSavingGroup(false)
    if (err) {
      alert(err)
      return
    }
    loadGroupAndOptions()
  }

  useEffect(() => {
    loadGroupAndOptions()
  }, [loadGroupAndOptions])
  const loadFaceInfo = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('participant_face_embeddings')
      .select('enrolled_at')
      .eq('participant_id', id)
      .maybeSingle()

    if (data) {
      setFaceInfo({
        enrolled: true,
        enrolled_at: data.enrolled_at,
      })
    } else {
      setFaceInfo({ enrolled: false, enrolled_at: null })
    }
  }, [id])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const { data, error: err } = await getParticipant(id)
    setParticipant(data)
    setError(err)
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (isV2) loadFaceInfo()
  }, [isV2, loadFaceInfo])

  async function handleDelete() {
    if (!participant) return
    if (!confirm('Permanently delete ' + participant.full_name + '?')) return
    setWorking(true)
    const { error: err } = await deleteParticipant(participant.id)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    navigate('/participants')
  }

  function handlePrint() {
    window.print()
  }

  function handleCopyLink() {
    if (!participant) return
    const url = window.location.origin + '/s/' + participant.system_id
    navigator.clipboard.writeText(url).then(
      () => alert('Student record link copied:\n\n' + url),
      () => alert('Copy failed. Link:\n\n' + url)
    )
  }

  async function handleRemoveFace() {
    if (!participant) return
    if (
      !confirm('Remove the enrolled face for ' + participant.full_name + '?')
    )
      return
    setWorking(true)
    const { error: err } = await supabase
      .from('participant_face_embeddings')
      .delete()
      .eq('participant_id', participant.id)
    setWorking(false)
    if (err) {
      alert(err)
      return
    }
    setFaceInfo({ enrolled: false, enrolled_at: null })
  }

  async function handleSavePhoto() {
    if (!account || !participant || !photoBlob) return
    setPhotoError(null)
    setWorking(true)

    const { url, error: uploadErr } = await uploadParticipantPhoto(
      account.id,
      participant.id,
      photoBlob
    )

    if (uploadErr || !url) {
      setWorking(false)
      setPhotoError(uploadErr ?? 'Upload failed')
      return
    }

    const { data: updated, error: updateErr } = await supabase
      .from('participants')
      .update({ photo_url: url })
      .eq('id', participant.id)
      .select('*')
      .single()

    setWorking(false)

    if (updateErr || !updated) {
      setPhotoError(updateErr?.message ?? 'Could not save')
      return
    }

    setParticipant(updated as Participant)
    cancelPhotoEdit()
  }

  async function handleRemovePhoto() {
    if (!account || !participant) return
    if (!confirm('Remove this photo?')) return
    setWorking(true)

    await deleteParticipantPhoto(account.id, participant.id)

    const { data: updated } = await supabase
      .from('participants')
      .update({ photo_url: null })
      .eq('id', participant.id)
      .select('*')
      .single()

    setWorking(false)

    if (updated) {
      setParticipant(updated as Participant)
    }
  }

  function cancelPhotoEdit() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoBlob(null)
    setPhotoPreview(null)
    setPhotoError(null)
    setShowPhotoCapture(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl text-sm text-slate-500">Loading...</div>
      </div>
    )
  }

  if (error || !participant) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error ?? 'Not found'}
          </div>
          <Link
            to="/participants"
            className="mt-4 inline-block text-sm text-slate-600 hover:underline"
          >
            &lt;- Back to {preset.labels.participants}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-4 sm:p-6 print:hidden">
        <div className="mx-auto max-w-4xl">
          <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        <Link
            to="/participants"
            className="text-xs text-slate-500 hover:underline"
          >
            &lt;- Back to {preset.labels.participants}
          </Link>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              {participant.photo_url ? (
                <img
                  src={participant.photo_url}
                  alt={participant.full_name}
                  className="h-16 w-16 rounded-full object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400 text-xl font-medium">
                  {participant.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {participant.full_name}
                </h1>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {participant.system_id}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrint}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Print badge
              </button>
              <button
                onClick={handleCopyLink}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Copy record link
              </button>
              <button
                onClick={handleDelete}
                disabled={working}
                className="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-5 shadow">
              <h2 className="text-sm font-medium text-slate-900">Details</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Full name</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {participant.full_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">
                    {preset.labels.participant} ID
                  </dt>
                  <dd className="mt-0.5 font-mono text-xs text-slate-900">
                    {participant.system_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">External ID</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {participant.external_id ?? (
                      <span className="text-slate-400">-</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{preset.labels.group}</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {participantGroup ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{participantGroup.name}</span>
                        {participantGroup.level && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                            {participantGroup.level}
                          </span>
                        )}
                        <select
                          value={participantGroup.id}
                          onChange={(e) => handleChangeGroup(e.target.value || null)}
                          disabled={savingGroup}
                          className="text-xs text-slate-600 border border-slate-300 rounded px-1.5 py-0.5 bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                          <option value="">(Remove from {preset.labels.group.toLowerCase()})</option>
                          {allGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Not assigned</span>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) handleChangeGroup(e.target.value)
                          }}
                          disabled={savingGroup}
                          className="text-xs text-slate-700 border border-slate-300 rounded px-1.5 py-0.5 bg-white hover:bg-slate-50 disabled:opacity-50"
                        >
                          <option value="">Assign {preset.labels.group.toLowerCase()}...</option>
                          {allGroups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Registered</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {new Date(participant.created_at).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg bg-white p-5 shadow">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-900">
                  Enrollment photo
                </h2>
                {!showPhotoCapture && (
                  <button
                    onClick={() => setShowPhotoCapture(true)}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    {participant.photo_url ? 'Replace' : 'Add photo'}
                  </button>
                )}
              </div>

              {!showPhotoCapture ? (
                <>
                  {participant.photo_url ? (
                    <div className="mt-3 space-y-2">
                      <img
                        src={participant.photo_url}
                        alt={participant.full_name}
                        className="w-full max-w-xs rounded-md border border-slate-300"
                      />
                      <button
                        onClick={handleRemovePhoto}
                        disabled={working}
                        className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded border border-dashed border-slate-300 p-6 text-center">
                      <p className="text-sm text-slate-500">No photo yet.</p>
                      <button
                        onClick={() => setShowPhotoCapture(true)}
                        className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Take photo
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3 space-y-3">
                  <PhotoCapture
                    currentPreviewUrl={photoPreview}
                    onCapture={(blob, previewUrl) => {
                      setPhotoBlob(blob)
                      setPhotoPreview(previewUrl)
                    }}
                    onClear={() => {
                      setPhotoBlob(null)
                      setPhotoPreview(null)
                    }}
                    label="New photo"
                    hint="Take a new photo or cancel to keep the existing one."
                  />

                  {photoError && (
                    <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {photoError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={cancelPhotoEdit}
                      disabled={working}
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePhoto}
                      disabled={working || !photoBlob}
                      className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {working ? 'Saving...' : 'Save photo'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isV2 && (
            <div className="mt-6 rounded-lg bg-white p-5 shadow">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium text-slate-900">
                    Face verification
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Enroll this participant face so the kiosk can verify their
                    identity on check-in. The captured photo is also saved as
                    their profile picture.
                  </p>
                </div>
                {faceInfo.enrolled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    Enrolled
                  </span>
                )}
              </div>

              {faceInfo.enrolled ? (
                <div className="mt-4 space-y-3">
                  <div className="text-xs text-slate-600">
                    Enrolled on{' '}
                    {faceInfo.enrolled_at
                      ? new Date(faceInfo.enrolled_at).toLocaleString()
                      : '-'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowFaceModal(true)}
                      className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Re-enroll
                    </button>
                    <button
                      onClick={handleRemoveFace}
                      disabled={working}
                      className="rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove enrollment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-500">
                    No face enrolled yet.
                  </p>
                  <button
                    onClick={() => setShowFaceModal(true)}
                    className="mt-3 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Enroll face
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 rounded-lg bg-white p-5 shadow">
            <h2 className="text-sm font-medium text-slate-900">
              Badge preview
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              This is what will print.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">
                  Front
                </div>
                <ParticipantBadge
                  participant={participant}
                  accountName={account?.name ?? ''}
                  side="front"
                />
              </div>
              <div className="rounded border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">
                  Back
                </div>
                <ParticipantBadge
                  participant={participant}
                  accountName={account?.name ?? ''}
                  side="back"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">
              Attendance history coming in a later phase.
            </p>
          </div>
        </div>
      </div>

      <div className="badge-print-root hidden print:block">
        <div className="badge-row">
          <div className="badge-half badge-half-front">
            <ParticipantBadge
              participant={participant}
              accountName={account?.name ?? ''}
              side="front"
              forPrint
            />
          </div>
          <div className="badge-half badge-half-back">
            <ParticipantBadge
              participant={participant}
              accountName={account?.name ?? ''}
              side="back"
              forPrint
            />
          </div>
        </div>
      </div>

      {isV2 && participant && (
        <FaceEnrollmentModal
          open={showFaceModal}
          onClose={() => setShowFaceModal(false)}
          participantId={participant.id}
          participantName={participant.full_name}
          onEnrolled={async () => {
            loadFaceInfo()
            if (!id) return
            const { data } = await getParticipant(id)
            if (data) setParticipant(data)
          }}
        />
      )}
    </>
  )
}