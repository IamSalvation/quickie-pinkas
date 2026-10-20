import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { listPrograms, type Program } from '../../lib/api/programs'
import { listParticipants, type Participant } from '../../lib/api/participants'

interface CourseData {
  course_id: string
  course_name: string
  course_code: string | null
  attendance_pct: number
  ca_total: number | null
  exam: number | null
  total: number | null
  grade: string | null
}

interface StudentRow {
  student_id: string
  student_name: string
  system_id: string
  external_id: string | null
  courses: Record<string, CourseData>
}

export default function CustomMasterSheetPage() {
  const { account } = useAuth()

  const [programs, setPrograms] = useState<Program[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])

  const [sheetData, setSheetData] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!account) return
    listPrograms(account.id, { limit: 200 }).then(r => setPrograms(r.data))
    listParticipants(account.id, { limit: 500 }).then(r => setParticipants(r.data))
  }, [account])

  async function generateSheet() {
    if (selectedStudentIds.length === 0 || selectedCourseIds.length === 0) {
      setError('Select at least one student and one course.')
      return
    }
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase.rpc('get_custom_master_sheet', {
      p_student_ids: selectedStudentIds,
      p_course_ids: selectedCourseIds,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSheetData(data as StudentRow[])
    setLoading(false)
  }

  function toggleStudent(id: string) {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleCourse(id: string) {
    setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const activeCourses = programs.filter(p => selectedCourseIds.includes(p.id))

  function computeGrade(total: number): string {
    if (total >= 70) return 'A'
    if (total >= 60) return 'B'
    if (total >= 50) return 'C'
    if (total >= 45) return 'D'
    if (total >= 40) return 'E'
    return 'F'
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        <img src="/logo.png" alt="Quickie Pinkas" className="h-8 w-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Custom Master Sheet</h1>
        <p className="text-sm text-slate-600 mb-6">Pick students and courses to build your own report.</p>

        {/* Setup Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-5 rounded-lg shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-900">1. Select Courses ({selectedCourseIds.length})</h2>
              <button
                onClick={() => setSelectedCourseIds(programs.map(p => p.id))}
                className="text-xs text-slate-500 hover:underline"
              >
                Select all
              </button>
            </div>
            <div className="h-56 overflow-y-auto border border-slate-200 rounded p-2 text-sm">
              {programs.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">No courses yet.</p>
              ) : (
                programs.map(p => (
                  <label key={p.id} className="flex items-center gap-2 mb-1 cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={selectedCourseIds.includes(p.id)} onChange={() => toggleCourse(p.id)} />
                    <span>{p.name}{p.code ? ' (' + p.code + ')' : ''}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-900">2. Select Students ({selectedStudentIds.length})</h2>
              <button
                onClick={() => setSelectedStudentIds(participants.map(p => p.id))}
                className="text-xs text-slate-500 hover:underline"
              >
                Select all
              </button>
            </div>
            <div className="h-56 overflow-y-auto border border-slate-200 rounded p-2 text-sm">
              {participants.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">No students yet.</p>
              ) : (
                participants.map(p => (
                  <label key={p.id} className="flex items-center gap-2 mb-1 cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={selectedStudentIds.includes(p.id)} onChange={() => toggleStudent(p.id)} />
                    <span>{p.full_name}</span>
                    <span className="text-xs text-slate-400 font-mono">{p.system_id}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={generateSheet}
            disabled={loading}
            className="rounded bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Master Sheet'}
          </button>
          {sheetData.length > 0 && (
            <button
              onClick={() => window.print()}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Print
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Master Sheet */}
        {sheetData.length > 0 && (
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium min-w-[200px] border-r border-slate-200">Student</th>
                  {activeCourses.map(c => (
                    <th key={c.id} className="px-4 py-3 font-medium text-center border-r border-slate-200 min-w-[130px]">
                      {c.name}
                      {c.code && <div className="text-[10px] text-slate-400 font-normal">{c.code}</div>}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium text-center bg-slate-100 min-w-[130px]">
                    Overall
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheetData.map(s => {
                  // Compute overall
                  let attSum = 0, attCount = 0
                  let gradeSum = 0, gradeCount = 0
                  activeCourses.forEach(c => {
                    const cd = s.courses[c.id]
                    if (cd) {
                      attSum += cd.attendance_pct
                      attCount++
                      if (cd.total !== null) {
                        gradeSum += cd.total
                        gradeCount++
                      }
                    }
                  })
                  const overallAtt = attCount > 0 ? (attSum / attCount).toFixed(1) + '%' : '-'
                  const overallAvg = gradeCount > 0 ? gradeSum / gradeCount : null
                  const overallTotal = overallAvg !== null ? overallAvg.toFixed(1) + ' (' + computeGrade(overallAvg) + ')' : '-'

                  return (
                    <tr key={s.student_id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 border-r border-slate-100 align-top">
                        <div className="font-medium text-slate-900">{s.student_name}</div>
                        <div className="text-xs text-slate-500">{s.system_id}</div>
                        {s.external_id && <div className="text-[10px] text-slate-400">{s.external_id}</div>}
                      </td>

                      {activeCourses.map(c => {
                        const cd = s.courses[c.id]
                        if (!cd) {
                          return (
                            <td key={c.id} className="px-4 py-4 border-r border-slate-100 align-top">
                              <div className="flex flex-col text-xs space-y-0.5 text-slate-400">
                                <div>Att: -</div>
                                <div>CA: -</div>
                                <div>Exam: -</div>
                                <div>Total: -</div>
                              </div>
                            </td>
                          )
                        }
                        return (
                          <td key={c.id} className="px-4 py-4 border-r border-slate-100 align-top">
                            <div className="flex flex-col text-xs space-y-0.5">
                              <div><span className="text-slate-500">Att:</span> <span className="font-medium text-slate-900">{cd.attendance_pct}%</span></div>
                              <div><span className="text-slate-500">CA:</span> <span className="text-slate-900">{cd.ca_total ?? '-'}</span></div>
                              <div><span className="text-slate-500">Exam:</span> <span className="text-slate-900">{cd.exam ?? '-'}</span></div>
                              <div className="pt-1"><span className="text-slate-500">Total:</span> <span className="font-bold text-slate-900">{cd.total ?? '-'} ({cd.grade ?? '-'})</span></div>
                            </div>
                          </td>
                        )
                      })}

                      <td className="px-4 py-4 bg-slate-50 align-top">
                        <div className="flex flex-col text-xs space-y-0.5">
                          <div><span className="text-slate-500">Att:</span> <span className="font-medium text-slate-900">{overallAtt}</span></div>
                          <div className="pt-1"><span className="text-slate-500">Total:</span> <span className="font-bold text-slate-900">{overallTotal}</span></div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}