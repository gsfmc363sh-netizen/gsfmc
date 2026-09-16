import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase.js'

const SESSIONS = [
  {
    no: 1,
    date: '2026-10-02',
    dateLabel: '10. 2.(금)',
    program: '광주비엔날레 전시',
    venue: '광주비엔날레전시관(북구 비엔날레로 111)',
  },
  {
    no: 2,
    date: '2026-10-08',
    dateLabel: '10. 8.(목)',
    program: '세계음식 만들기 체험',
    venue: '월곡 고려인마을',
  },
  {
    no: 3,
    date: '2026-10-16',
    dateLabel: '10. 16.(금)',
    program: '광주비엔날레 전시',
    venue: '광주비엔날레전시관',
  },
  {
    no: 4,
    date: '2026-10-23',
    dateLabel: '10. 23.(금)',
    program: '세계음식 만들기 체험',
    venue: '월곡 고려인마을',
  },
  {
    no: 5,
    date: '2026-10-28',
    dateLabel: '10. 28.(수)',
    program: '광주비엔날레 전시',
    venue: '광주비엔날레전시관',
  },
]

const EMPLOYMENT_TYPES = ['일반직', '공무직', '임원', '기타', '환경직(신청 제외)']
const STORAGE_KEY = 'gsfmc-culture-day-applications-v1'

function participantRow() {
  return {
    rowId: globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()),
    participant_name: '',
    employment_type: '',
    session_no: '',
  }
}

function loadLocalRows() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function escapeCsv(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export default function App() {
  const [tab, setTab] = useState('apply')
  const [department, setDepartment] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [participants, setParticipants] = useState([participantRow()])
  const [applications, setApplications] = useState([])
  const [departmentFilter, setDepartmentFilter] = useState('전체')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function refreshApplications() {
    setLoading(true)
    setMessage('')

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('culture_day_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setMessage(`취합 데이터를 불러오지 못했습니다: ${error.message}`)
        setApplications([])
      } else {
        setApplications(data ?? [])
      }
    } else {
      setApplications(loadLocalRows())
    }

    setLoading(false)
  }

  useEffect(() => {
    refreshApplications()
  }, [])

  const departments = useMemo(() => {
    return [...new Set(applications.map((row) => row.department).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'ko'),
    )
  }, [applications])

  const filteredApplications = useMemo(() => {
    if (departmentFilter === '전체') return applications
    return applications.filter((row) => row.department === departmentFilter)
  }, [applications, departmentFilter])

  const sessionCounts = useMemo(() => {
    return SESSIONS.map((session) => ({
      ...session,
      count: applications.filter((row) => Number(row.session_no) === session.no).length,
    }))
  }, [applications])

  const departmentCounts = useMemo(() => {
    return departments.map((name) => ({
      name,
      count: applications.filter((row) => row.department === name).length,
    }))
  }, [applications, departments])

  function updateParticipant(rowId, key, value) {
    setParticipants((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, [key]: value } : row)),
    )
  }

  function addParticipant() {
    setParticipants((rows) => [...rows, participantRow()])
  }

  function removeParticipant(rowId) {
    setParticipants((rows) => {
      if (rows.length === 1) return rows
      return rows.filter((row) => row.rowId !== rowId)
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')

    const trimmedDepartment = department.trim()
    const trimmedContactName = contactName.trim()
    const trimmedContactPhone = contactPhone.trim()

    if (!trimmedDepartment || !trimmedContactName || !trimmedContactPhone) {
      setMessage('부서명, 담당자 이름, 담당자 연락처를 모두 입력해 주세요.')
      return
    }

    const incomplete = participants.some(
      (row) => !row.participant_name.trim() || !row.employment_type || !row.session_no,
    )
    if (incomplete) {
      setMessage('모든 신청자의 이름, 직종, 희망 회차를 입력해 주세요.')
      return
    }

    if (participants.some((row) => row.employment_type === '환경직(신청 제외)')) {
      setMessage('환경직은 이번 문화의 날 신청 대상에서 제외되어 있습니다.')
      return
    }

    const batchId = globalThis.crypto?.randomUUID?.() ?? String(Date.now())
    const rows = participants.map((row) => {
      const session = SESSIONS.find((item) => item.no === Number(row.session_no))
      return {
        batch_id: batchId,
        department: trimmedDepartment,
        contact_name: trimmedContactName,
        contact_phone: trimmedContactPhone,
        participant_name: row.participant_name.trim(),
        employment_type: row.employment_type,
        session_no: session.no,
        session_date: session.date,
        program: session.program,
        venue: session.venue,
        created_at: new Date().toISOString(),
      }
    })

    setSaving(true)

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('culture_day_applications').insert(rows)
      if (error) {
        setSaving(false)
        setMessage(`신청 저장 중 오류가 발생했습니다: ${error.message}`)
        return
      }
    } else {
      const current = loadLocalRows()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...rows, ...current]))
    }

    setParticipants([participantRow()])
    setSaving(false)
    setMessage(`${trimmedDepartment} 신청 ${rows.length}명이 접수되었습니다.`)
    await refreshApplications()
  }

  function exportCsv() {
    const header = [
      '부서',
      '신청자',
      '직종',
      '회차',
      '일자',
      '프로그램',
      '장소',
      '부서담당자',
      '담당자연락처',
      '접수일시',
    ]
    const rows = filteredApplications.map((row) => [
      row.department,
      row.participant_name,
      row.employment_type,
      `${row.session_no}회차`,
      row.session_date,
      row.program,
      row.venue,
      row.contact_name,
      row.contact_phone,
      row.created_at,
    ])

    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `2026-문화의날-취합-${departmentFilter}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">광산</div>
          <div>
            <strong>소통광산구시설관리공단</strong>
            <span>2026 문화의 날 부서별 신청·취합</span>
          </div>
        </div>
        <div className={`mode-badge ${isSupabaseConfigured ? 'live' : 'demo'}`}>
          {isSupabaseConfigured ? '공동 취합 모드' : '데모 모드'}
        </div>
      </header>

      <main className="page-wrap">
        {!isSupabaseConfigured && (
          <div className="alert warning">
            현재는 데모 모드로, 입력한 내용이 이 브라우저에만 저장됩니다. 전 부서 공동 취합을
            사용하려면 README 안내에 따라 Supabase 환경변수를 연결해 주세요.
          </div>
        )}

        <section className="hero-card">
          <div>
            <p className="eyebrow">2026년 10월 · 총 5회차</p>
            <h1>문화의 날 참여 신청</h1>
            <p>
              공단 전 직원 대상 부서별 일괄 신청 페이지입니다. 환경직은 이번 신청 대상에서
              제외됩니다.
            </p>
          </div>
          <div className="hero-meta">
            <div>
              <span>장소</span>
              <strong>월곡 고려인마을 · 광주비엔날레</strong>
            </div>
            <div>
              <span>신청 방식</span>
              <strong>부서 담당자 일괄 제출</strong>
            </div>
          </div>
        </section>

        <section className="schedule-section" aria-labelledby="schedule-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">행사 일정</p>
              <h2 id="schedule-title">회차별 프로그램</h2>
            </div>
          </div>
          <div className="schedule-grid">
            {SESSIONS.map((session) => (
              <article className="schedule-card" key={session.no}>
                <div className="session-number">{session.no}회차</div>
                <strong>{session.dateLabel}</strong>
                <h3>{session.program}</h3>
                <p>{session.venue}</p>
              </article>
            ))}
          </div>
        </section>

        <nav className="tabbar" aria-label="신청 및 취합 메뉴">
          <button className={tab === 'apply' ? 'active' : ''} onClick={() => setTab('apply')}>
            부서 신청
          </button>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
            취합 현황
          </button>
        </nav>

        {message && <div className="alert info">{message}</div>}

        {tab === 'apply' ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">부서 담당자 입력</p>
                <h2>참여자 일괄 신청</h2>
              </div>
              <span className="helper">한 번에 여러 명을 등록할 수 있습니다.</span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="contact-grid">
                <label>
                  <span>부서명 *</span>
                  <input
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="예: 경영지원팀"
                  />
                </label>
                <label>
                  <span>담당자 이름 *</span>
                  <input
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    placeholder="홍길동"
                  />
                </label>
                <label>
                  <span>담당자 연락처 *</span>
                  <input
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    placeholder="010-0000-0000"
                    inputMode="tel"
                  />
                </label>
              </div>

              <div className="participant-header">
                <div>
                  <h3>신청자 명단</h3>
                  <p>직원별 희망 회차를 선택해 주세요.</p>
                </div>
                <button type="button" className="secondary-button" onClick={addParticipant}>
                  + 신청자 추가
                </button>
              </div>

              <div className="participant-list">
                {participants.map((row, index) => (
                  <div className="participant-row" key={row.rowId}>
                    <div className="row-index">{index + 1}</div>
                    <label>
                      <span>이름</span>
                      <input
                        value={row.participant_name}
                        onChange={(event) =>
                          updateParticipant(row.rowId, 'participant_name', event.target.value)
                        }
                        placeholder="직원 이름"
                      />
                    </label>
                    <label>
                      <span>직종</span>
                      <select
                        value={row.employment_type}
                        onChange={(event) =>
                          updateParticipant(row.rowId, 'employment_type', event.target.value)
                        }
                      >
                        <option value="">선택</option>
                        {EMPLOYMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>희망 회차</span>
                      <select
                        value={row.session_no}
                        onChange={(event) =>
                          updateParticipant(row.rowId, 'session_no', event.target.value)
                        }
                      >
                        <option value="">선택</option>
                        {SESSIONS.map((session) => (
                          <option key={session.no} value={session.no}>
                            {session.no}회차 · {session.dateLabel} · {session.program}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeParticipant(row.rowId)}
                      aria-label={`${index + 1}번 신청자 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-note">
                입력된 이름과 담당자 연락처는 행사 참여자 확인 및 일정 안내 목적으로만 사용하도록
                운영해 주세요.
              </div>

              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? '저장 중...' : `${participants.length}명 신청 제출`}
              </button>
            </form>
          </section>
        ) : (
          <section className="panel">
            <div className="section-heading dashboard-heading">
              <div>
                <p className="eyebrow">실시간 취합</p>
                <h2>전 부서 참여 현황</h2>
              </div>
              <div className="dashboard-actions">
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                >
                  <option value="전체">전체 부서</option>
                  {departments.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button className="secondary-button" onClick={refreshApplications}>
                  새로고침
                </button>
                <button
                  className="secondary-button"
                  onClick={exportCsv}
                  disabled={!filteredApplications.length}
                >
                  CSV 다운로드
                </button>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <span>총 신청 인원</span>
                <strong>{applications.length}</strong>
              </div>
              <div className="stat-card">
                <span>제출 부서</span>
                <strong>{departments.length}</strong>
              </div>
              <div className="stat-card">
                <span>조회 인원</span>
                <strong>{filteredApplications.length}</strong>
              </div>
            </div>

            <div className="dashboard-columns">
              <div>
                <h3>회차별 인원</h3>
                <div className="summary-list">
                  {sessionCounts.map((session) => (
                    <div key={session.no}>
                      <span>
                        {session.no}회차 · {session.dateLabel}
                      </span>
                      <strong>{session.count}명</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>부서별 인원</h3>
                <div className="summary-list">
                  {departmentCounts.length ? (
                    departmentCounts.map((item) => (
                      <div key={item.name}>
                        <span>{item.name}</span>
                        <strong>{item.count}명</strong>
                      </div>
                    ))
                  ) : (
                    <p className="empty-copy">아직 접수된 부서가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>부서</th>
                    <th>신청자</th>
                    <th>직종</th>
                    <th>회차</th>
                    <th>프로그램</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        데이터를 불러오는 중입니다.
                      </td>
                    </tr>
                  ) : filteredApplications.length ? (
                    filteredApplications.map((row, index) => (
                      <tr key={row.id ?? `${row.batch_id}-${row.participant_name}-${index}`}>
                        <td>{row.department}</td>
                        <td>{row.participant_name}</td>
                        <td>{row.employment_type}</td>
                        <td>{row.session_no}회차</td>
                        <td>{row.program}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        표시할 신청 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer>
        <strong>소통광산구시설관리공단</strong>
        <span>2026 문화의 날 신청·취합 시스템</span>
      </footer>
    </div>
  )
}
