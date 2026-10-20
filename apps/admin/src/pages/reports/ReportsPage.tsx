import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import { listPrograms, type Program } from '../../lib/api/programs'
import { listContexts, type ContextWithProgram } from '../../lib/api/contexts'
import { listParticipants, type Participant } from '../../lib/api/participants'
import { supabase } from '../../lib/supabase'
import {
  fetchMasterSheet,
  fetchSessionRegister,
  masterSheetToCsv,
  sessionRegisterToCsv,
  downloadCsv,
  type MasterSheet,
  type SessionRegisterRow,
} from '../../lib/api/reports'
import {
  fetchGradedReport,
  gradedReportToCsv,
  type GradedReport,
} from '../../lib/api/gradedReport'

type Tab = 'master' | 'register' | 'grades' | 'custom'

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function shortContextLabel(label: string): string {
  const stripped = label.replace(/^[A-Z]{2,}\d{2,}\s*[-:]?\s*/, '')
  const short = stripped
    .replace(/\bWeeks\b/gi, 'Wks')
    .replace(/\bWeek\b/gi, 'Wk')
  return short.trim() || label
}

function gradeBadgeClass(grade: string | null): string {
  if (!grade) return 'bg-slate-100 text-slate-500'
  if (grade === 'A') return 'bg-emerald-50 text-emerald-700'
  if (grade === 'B') return 'bg-green-50 text-green-700'
  if (grade === 'C') return 'bg-yellow-50 text-yellow-700'
  if (grade === 'D') return 'bg-orange-50 text-orange-700'
  if (grade === 'E') return 'bg-orange-50 text-orange-800'
  if (grade === 'F') return 'bg-red-50 text-red-700'
  return 'bg-slate-100 text-slate-500'
}

function programLabel(program: Program | undefined): string | undefined {
  if (!program) return undefined
  return program.code ? program.name + ' (' + program.code + ')' : program.name
}

interface PrintHeaderProps {
  title: string
  subtitle?: string
}

function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  const now = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return (
    <div className="hidden print:block mb-4">
      <div className="text-lg font-bold text-slate-900">{title}</div>
      {subtitle && (
        <div className="text-xs text-slate-700">{subtitle}</div>
      )}
      <div className="text-xs text-slate-500">
        Quickie Pinkas - Generated {now}
      </div>
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = {
  qr_kiosk_inperson: 'QR (kiosk)',
  qr_kiosk_online: 'QR (online)',
  id_entry_online: 'ID entry',
  manual: 'Manual',
  face_verified: 'Face',
}

interface CustomCourseData {
  course_id: string
  course_name: string
  course_code: string | null
  attendance_pct: number
  ca_total: number | null
  exam: number | null
  total: number | null
  grade: string | null
}

interface CustomRow {
  student_id: string
  student_name: string
  system_id: string
  external_id: string | null
  courses: Record<string, CustomCourseData>
}

export default function ReportsPage() {
  const { account } = useAuth()
  const preset = getPreset(account?.preset)

  const [tab, setTab] = useState<Tab>('master')

  const [programs, setPrograms] = useState<Program[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])

  // Master State
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [masterSheet, setMasterSheet] = useState<MasterSheet | null>(null)
  const [masterLoading, setMasterLoading] = useState(false)
  const [masterError, setMasterError] = useState<string | null>(null)

  // Register State
  const [contexts, setContexts] = useState<ContextWithProgram[]>([])
  const [selectedContextId, setSelectedContextId] = useState<string>('')
  const [registerRows, setRegisterRows] = useState<SessionRegisterRow[]>([])
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  // Grades State
  const [gradesProgramId, setGradesProgramId] = useState<string>('')
  const [gradedReport, setGradedReport] = useState<GradedReport | null>(null)
  const [gradesLoading, setGradesLoading] = useState(false)
  const [gradesError, setGradesError] = useState<string | null>(null)

  // Custom Master Sheet State
  const [customStudentIds, setCustomStudentIds] = useState<string[]>([])
  const [customData, setCustomData] = useState<CustomRow[]>([])
  const [customLoading, setCustomLoading] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

  useEffect(() => {
    document.body.classList.remove('printing-badge')
  }, [])

  useEffect(() => {
    if (!account) return
    listPrograms(account.id, { status: 'all', limit: 200 }).then(({ data }) => setPrograms(data))
    listContexts(account.id, { status: 'all', limit: 200 }).then(({ data }) => setContexts(data))
    listParticipants(account.id, { limit: 500 }).then(({ data }) => setParticipants(data))
  }, [account])

  const loadMasterSheet = useCallback(async () => {
    if (!account || !selectedProgramId) return
    setMasterLoading(true)
    setMasterError(null)
    const { data, error: err } = await fetchMasterSheet(account.id, {
      programId: selectedProgramId,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
      dateTo: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : null,
    })
    setMasterLoading(false)
    if (err) {
      setMasterError(err)
      setMasterSheet(null)
      return
    }
    setMasterSheet(data)
  }, [account, selectedProgramId, dateFrom, dateTo])

  const loadRegister = useCallback(async () => {
    if (!selectedContextId) return
    setRegisterLoading(true)
    setRegisterError(null)
    const { data, error: err } = await fetchSessionRegister(selectedContextId)
    setRegisterLoading(false)
    if (err) {
      setRegisterError(err)
      setRegisterRows([])
      return
    }
    setRegisterRows(data ?? [])
  }, [selectedContextId])

  const loadGradedReport = useCallback(async () => {
    if (!account || !gradesProgramId) return
    setGradesLoading(true)
    setGradesError(null)
    const { data, error: err } = await fetchGradedReport({
      accountId: account.id,
      programId: gradesProgramId,
    })
    setGradesLoading(false)
    if (err) {
      setGradesError(err)
      setGradedReport(null)
      return
    }
    setGradedReport(data)
  }, [account, gradesProgramId])

  useEffect(() => {
    if (tab === 'master' && selectedProgramId) loadMasterSheet()
  }, [tab, selectedProgramId, loadMasterSheet])

  useEffect(() => {
    if (tab === 'register' && selectedContextId) loadRegister()
  }, [tab, selectedContextId, loadRegister])

  useEffect(() => {
    if (tab === 'grades' && gradesProgramId) loadGradedReport()
  }, [tab, gradesProgramId, loadGradedReport])

  // --- CUSTOM SHEET LOGIC ---
  async function generateCustomSheet() {
    if (customStudentIds.length === 0) {
      setCustomError('Select at least one student.')
      return
    }
    setCustomLoading(true)
    setCustomError(null)

    // Call the new V2 function that doesn't require course IDs
    const { data, error: err } = await supabase.rpc('get_custom_master_sheet_v2', {
      p_student_ids: customStudentIds,
    })

    if (err) {
      setCustomError(err.message)
      setCustomLoading(false)
      return
    }

    setCustomData(data as CustomRow[])
    setCustomLoading(false)
  }

  function toggleStudent(id: string) {
    setCustomStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Gather all unique courses across all students for the columns
  const customCourseColumns = customData.reduce((acc, row) => {
    Object.values(row.courses || {}).forEach(course => {
      if (!acc.find(c => c.course_id === course.course_id)) {
        acc.push(course)
      }
    })
    return acc
  }, [] as CustomCourseData[]).sort((a, b) => (a.course_name || '').localeCompare(b.course_name || ''))

  function handleCustomCsv() {
    if (customData.length === 0) return

    // Build headers
    const headers = ['Student', 'System ID']
    customCourseColumns.forEach(c => {
      headers.push(`${c.course_name} - Att`)
      headers.push(`${c.course_name} - Total`)
    })

    // Build rows
    const rows = customData.map(s => {
      const rowData = [s.student_name, s.system_id]
      customCourseColumns.forEach(c => {
        const cd = s.courses[c.course_id]
        rowData.push(cd ? `${cd.attendance_pct}%` : '-')
        rowData.push(cd && cd.total !== null ? `${cd.total} (${cd.grade})` : '-')
      })
      return rowData
    })

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    downloadCsv('custom-master-sheet.csv', csvContent)
  }

  function handleMasterCsv() {
    if (!masterSheet) return
    const csv = masterSheetToCsv(masterSheet)
    const label = programs.find((p) => p.id === selectedProgramId)?.name ?? 'report'
    downloadCsv(label + '-master-sheet.csv', csv)
  }

  function handleRegisterCsv() {
    if (registerRows.length === 0) return
    const csv = sessionRegisterToCsv(registerRows)
    const label = contexts.find((c) => c.id === selectedContextId)?.label ?? 'session'
    downloadCsv(label + '-register.csv', csv)
  }

  function handleGradedCsv() {
    if (!gradedReport) return
    const csv = gradedReportToCsv(gradedReport)
    const label = programs.find((p) => p.id === gradesProgramId)?.name ?? 'report'
    downloadCsv(label + '-graded-sheet.csv', csv)
  }

  const selectedProgram = programs.find((p) => p.id === selectedProgramId)
  const gradesProgram = programs.find((p) => p.id === gradesProgramId)
  const selectedContext = contexts.find((c) => c.id === selectedContextId)

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Attendance reports and exports.
        </p>

        <div className="mt-6 flex gap-2 border-b border-slate-200 overflow-x-auto print:hidden">
          <button
            onClick={() => setTab('master')}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ' +
              (tab === 'master'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            Master Sheet
          </button>
          <button
            onClick={() => setTab('register')}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ' +
              (tab === 'register'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            Session Register
          </button>
          <button
            onClick={() => setTab('grades')}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ' +
              (tab === 'grades'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            Grades
          </button>
          <button
            onClick={() => setTab('custom')}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ' +
              (tab === 'custom'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            Custom Master Sheet
          </button>
        </div>

        {/* Master Sheet tab */}
        {tab === 'master' && (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 print:hidden">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {preset.labels.program}
                </label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="">- Select -</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.code ? ' (' + p.code + ')' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button
                onClick={loadMasterSheet}
                disabled={!selectedProgramId || masterLoading}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {masterLoading ? 'Loading...' : 'Run report'}
              </button>
              {masterSheet && masterSheet.rows.length > 0 && (
                <>
                  <button
                    onClick={handleMasterCsv}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Print
                  </button>
                </>
              )}
            </div>

            {masterError && (
              <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {masterError}
              </div>
            )}

            {masterSheet && masterSheet.contexts.length === 0 && (
              <div className="mt-6 rounded border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">
                  No {preset.labels.contexts.toLowerCase()} found for this{' '}
                  {preset.labels.program.toLowerCase()} in this date range.
                </p>
              </div>
            )}

            {masterSheet && masterSheet.contexts.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow print:overflow-visible print:shadow-none print:rounded-none">
                <PrintHeader
                  title={'Master Sheet - ' + preset.labels.program}
                  subtitle={programLabel(selectedProgram)}
                />
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium">
                        Participant
                      </th>
                      <th className="px-3 py-2 font-medium">System ID</th>
                      {masterSheet.contexts.map((c) => (
                        <th
                          key={c.id}
                          className="px-2 py-2 font-medium text-center align-bottom"
                          title={c.label}
                          style={{ maxWidth: '100px', minWidth: '80px' }}
                        >
                          <div className="whitespace-pre-line break-words leading-tight">
                            {shortContextLabel(c.label)}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium text-right">%</th>
                      <th className="px-2 py-2 font-medium text-center">On</th>
                      <th className="px-2 py-2 font-medium text-center">In</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterSheet.rows.map((row) => (
                      <tr key={row.participant.id} className="hover:bg-slate-50">
                        <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                          {row.participant.full_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {row.participant.system_id}
                        </td>
                        {masterSheet.contexts.map((c) => {
                          const v = row.cells[c.id] ?? '-'
                          const cellCls =
                            v === 'P'
                              ? 'text-emerald-700 font-semibold'
                              : v === 'A'
                                ? 'text-red-600 font-semibold'
                                : 'text-slate-300'
                          return (
                            <td
                              key={c.id}
                              className={'px-2 py-2 text-center ' + cellCls}
                            >
                              {v}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right font-medium text-slate-900">
                          {row.attendancePct}%
                        </td>
                        <td className="px-2 py-2 text-center text-xs text-blue-700">
                          {row.onlineCount || '-'}
                        </td>
                        <td className="px-2 py-2 text-center text-xs text-slate-600">
                          {row.inPersonCount || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Session Register tab */}
        {tab === 'register' && (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 print:hidden">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {preset.labels.context}
                </label>
                <select
                  value={selectedContextId}
                  onChange={(e) => setSelectedContextId(e.target.value)}
                  className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                >
                  <option value="">- Select -</option>
                  {contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                      {c.starts_at
                        ? ' - ' + new Date(c.starts_at).toLocaleDateString()
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button
                onClick={loadRegister}
                disabled={!selectedContextId || registerLoading}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {registerLoading ? 'Loading...' : 'Run report'}
              </button>
              {registerRows.length > 0 && (
                <>
                  <button
                    onClick={handleRegisterCsv}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Print
                  </button>
                </>
              )}
            </div>

            {registerError && (
              <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {registerError}
              </div>
            )}

            {registerRows.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow print:overflow-visible print:shadow-none print:rounded-none">
                <PrintHeader
                  title={preset.labels.context + ' Register'}
                  subtitle={selectedContext?.label}
                />
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Participant</th>
                      <th className="px-3 py-2 font-medium">System ID</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Method</th>
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 font-medium">Checked In</th>
                      <th className="px-3 py-2 font-medium">Checked Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registerRows.map((row) => (
                      <tr key={row.participant.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-900">
                          {row.participant.full_name}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">
                          {row.participant.system_id}
                        </td>
                        <td className="px-3 py-2">
                          {row.status === 'present' && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Present
                            </span>
                          )}
                          {row.status === 'absent' && (
                            <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                              Absent
                            </span>
                          )}
                          {row.status === 'no_record' && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              No record
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.method ? METHOD_LABELS[row.method] ?? row.method : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.mode ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {formatDateTime(row.checked_in_at)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {formatDateTime(row.checked_out_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Grades tab */}
        {tab === 'grades' && (
          <>
            <div className="mt-5 print:hidden">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {preset.labels.program}
              </label>
              <select
                value={gradesProgramId}
                onChange={(e) => setGradesProgramId(e.target.value)}
                className="block w-full sm:max-w-md rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value="">- Select -</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.code ? ' (' + p.code + ')' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button
                onClick={loadGradedReport}
                disabled={!gradesProgramId || gradesLoading}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {gradesLoading ? 'Loading...' : 'Run report'}
              </button>
              {gradedReport && gradedReport.rows.length > 0 && (
                <>
                  <button
                    onClick={handleGradedCsv}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Print
                  </button>
                </>
              )}
            </div>

            {gradesError && (
              <div className="mt-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {gradesError}
              </div>
            )}

            {gradedReport && gradedReport.rows.length === 0 && (
              <div className="mt-6 rounded border border-dashed border-slate-300 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">
                  No participants to show for this{' '}
                  {preset.labels.program.toLowerCase()}.
                </p>
              </div>
            )}

            {gradedReport && gradedReport.rows.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow print:overflow-visible print:shadow-none print:rounded-none">
                <PrintHeader
                  title={'Grades - ' + preset.labels.program}
                  subtitle={programLabel(gradesProgram)}
                />
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium">
                        Name
                      </th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">
                        System ID
                      </th>
                      <th className="px-2 py-2 font-medium text-center">
                        <div className="leading-tight">Attendance</div>
                        <div className="text-[10px] font-normal normal-case text-slate-400">
                          %
                        </div>
                      </th>
                      {gradedReport.components.map((c) => (
                        <th
                          key={c.id}
                          className="px-2 py-2 font-medium text-center"
                        >
                          <div className="leading-tight whitespace-nowrap">
                            {c.name}
                          </div>
                          <div className="text-[10px] font-normal normal-case text-slate-400">
                            /{c.max_score}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 font-medium text-right">CA</th>
                      <th className="px-3 py-2 font-medium text-right">
                        <div className="leading-tight">Exam</div>
                        <div className="text-[10px] font-normal normal-case text-slate-400">
                          /{gradedReport.examMax}
                        </div>
                      </th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                      <th className="px-3 py-2 font-medium text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gradedReport.rows.map((row) => {
                      const displayGrade =
                        row.gradeOverride ?? row.grade ?? '-'
                      return (
                        <tr key={row.participant.id} className="hover:bg-slate-50">
                          <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                            {row.participant.full_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {row.participant.system_id}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-700">
                            {row.attendancePct}%
                          </td>
                          {gradedReport.components.map((c) => {
                            const v = row.componentScores[c.id]
                            return (
                              <td
                                key={c.id}
                                className="px-2 py-2 text-center text-slate-700"
                              >
                                {v === null || v === undefined ? '-' : v}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right text-slate-700">
                            {row.caTotal ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {row.exam ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                            {row.total ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={
                                'inline-block min-w-[2rem] rounded px-2 py-0.5 text-sm font-semibold ' +
                                gradeBadgeClass(displayGrade)
                              }
                            >
                              {displayGrade}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-slate-50 font-medium">
                      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-slate-700">
                        Average
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-2 py-2 text-center text-slate-700">
                        {gradedReport.averages.attendancePct}%
                      </td>
                      {gradedReport.components.map((c) => (
                        <td key={c.id} className="px-2 py-2"></td>
                      ))}
                      <td className="px-3 py-2 text-right text-slate-700">
                        {gradedReport.averages.caTotal}
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {gradedReport.averages.total}
                      </td>
                      <td className="px-3 py-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Custom Master Sheet tab */}
        {tab === 'custom' && (
          <div>
            <div className="mt-5 bg-white p-5 rounded-lg shadow mb-6 space-y-4 print:hidden">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Select {preset.labels.participants}
                  </label>
                  <button
                    onClick={() => setCustomStudentIds(participants.map(p => p.id))}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded bg-white divide-y divide-slate-100">
                  {participants.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={customStudentIds.includes(p.id)}
                        onChange={() => toggleStudent(p.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-900">{p.full_name}</span>
                      <span className="text-xs text-slate-400 font-mono ml-auto">{p.system_id}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateCustomSheet}
                  disabled={customLoading}
                  className="rounded bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {customLoading ? 'Generating...' : 'Generate Custom Sheet'}
                </button>
                {customData.length > 0 && (
                  <>
                    <button
                      onClick={handleCustomCsv}
                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Print
                    </button>
                  </>
                )}
              </div>

              {customError && (
                <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {customError}
                </div>
              )}
            </div>

            {customData.length > 0 && customCourseColumns.length > 0 && (
              <div className="overflow-x-auto bg-white shadow rounded-lg print:overflow-visible print:shadow-none print:rounded-none">
                <PrintHeader title={'Custom Master Sheet'} />
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 print:bg-transparent print:border-b print:border-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-medium min-w-[200px] border-r border-slate-200">Student</th>
                      {customCourseColumns.map(c => (
                        <th key={c.course_id} className="px-4 py-3 font-medium text-center border-r border-slate-200 min-w-[130px]">
                          {c.course_name}
                          {c.course_code && <div className="text-[10px] text-slate-400 font-normal">{c.course_code}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customData.map(s => (
                      <tr key={s.student_id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 border-r border-slate-100 align-top">
                          <div className="font-medium text-slate-900">{s.student_name}</div>
                          <div className="text-xs text-slate-500">{s.system_id}</div>
                          {s.external_id && <div className="text-[10px] text-slate-400">{s.external_id}</div>}
                        </td>
                        {customCourseColumns.map(c => {
                          const cd = s.courses[c.course_id]
                          return (
                            <td key={c.course_id} className="px-4 py-4 border-r border-slate-100 align-top">
                              {cd ? (
                                <div className="flex flex-col text-xs space-y-0.5">
                                  <div><span className="text-slate-500">Att:</span> <span className="font-medium text-slate-900">{cd.attendance_pct}%</span></div>
                                  <div><span className="text-slate-500">CA:</span> <span className="text-slate-900">{cd.ca_total ?? '-'}</span></div>
                                  <div><span className="text-slate-500">Exam:</span> <span className="text-slate-900">{cd.exam ?? '-'}</span></div>
                                  <div className="pt-1"><span className="text-slate-500">Total:</span> <span className="font-bold text-slate-900">{cd.total ?? '-'} ({cd.grade ?? '-'})</span></div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400">-</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}