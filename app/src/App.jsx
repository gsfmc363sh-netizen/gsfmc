import { useState, useMemo, useRef, useEffect } from 'react'
import { Icon } from './icons.jsx'
import AmendModal from './AmendModal.jsx'

function highlightRevisions(body) {
  const nodes = []
  const re = /<\s*(개정|신설|전문개정|본조신설|삭제|제정)[^>]*>/g
  let last = 0
  let m
  let key = 0
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) nodes.push(body.slice(last, m.index))
    nodes.push(
      <em className="revmark" key={key++}>
        {m[0]}
      </em>,
    )
    last = m.index + m[0].length
  }
  if (last < body.length) nodes.push(body.slice(last))
  return nodes
}

function RegulationView({ reg, org, focusedArtNo, onPickAmend, articleRefs }) {
  return (
    <div className="doc">
      <div className="doc__header">
        <div className="doc__eyebrow">{org}</div>
        <h1 className="doc__title">{reg.name}</h1>
        <div className="doc__badges">
          <span className="badge badge--accent">전체 {reg.articleCount}개 조문</span>
          <span className="badge">부칙 {reg.buchik.length}건</span>
          {reg.byeolpyo.length > 0 && <span className="badge">별표 {reg.byeolpyo.length}건</span>}
          {reg.revisions.length > 0 && (
            <span className="badge">최근 개정 {reg.revisions[reg.revisions.length - 1]}</span>
          )}
        </div>
        <div className="doc__actionbar">
          <button className="btn btn--primary" onClick={() => onPickAmend(null)}>
            <Icon name="scale" size={16} />
            신구조문대조표 생성
          </button>
        </div>
      </div>

      {reg.chapters.map((chap, ci) => (
        <section key={ci}>
          {chap.title && (
            <h2 className="chapter-head">
              제{chap.num}장 {chap.title}
            </h2>
          )}
          {chap.articles.map((art) => {
            const focused = focusedArtNo === art.no
            return (
              <div
                key={art.no}
                id={`art-${art.no}`}
                ref={(el) => (articleRefs.current[art.no] = el)}
                className={`article${focused ? ' is-focused' : ''}`}
              >
                <div className="article__head">
                  <span className="article__no">{art.label}</span>
                  {art.title && <span className="article__title">({art.title})</span>}
                  <button className="article__pick" onClick={() => onPickAmend(art)}>
                    개정 대조표
                  </button>
                </div>
                <div className="article__body">{highlightRevisions(art.body)}</div>
              </div>
            )
          })}
        </section>
      ))}

      {reg.buchik.length > 0 && (
        <div className="subsec">
          <div className="subsec__title">부칙</div>
          {reg.buchik.map((b, i) => (
            <div className="buchik-item" key={i}>
              {b.date && <strong>&lt;{b.date}&gt;{'\n'}</strong>}
              {b.text}
            </div>
          ))}
        </div>
      )}

      {reg.byeolpyo.length > 0 && (
        <div className="subsec">
          <div className="subsec__title">별표 · 서식</div>
          {reg.byeolpyo.map((b, i) => (
            <div className="byeolpyo-item" key={i}>
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('규정')
  const [selectedRegId, setSelectedRegId] = useState(1)
  const [query, setQuery] = useState('')
  const [focusedArtNo, setFocusedArtNo] = useState(null)
  const [amend, setAmend] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const articleRefs = useRef({})
  const mainRef = useRef(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}regulations.json`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }))
  }, [])

  const regulations = data && data.regulations ? data.regulations : []

  const selectedReg = useMemo(
    () => regulations.find((r) => r.id === selectedRegId),
    [regulations, selectedRegId],
  )

  const filteredRegs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return regulations
    return regulations.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true
      return r.chapters.some((c) =>
        c.articles.some(
          (a) =>
            a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
        ),
      )
    })
  }, [regulations, query])

  const flatArticles = useMemo(() => {
    if (!selectedReg) return []
    const out = []
    selectedReg.chapters.forEach((c) => {
      if (c.title) out.push({ kind: 'chap', num: c.num, title: c.title })
      c.articles.forEach((a) => out.push({ kind: 'art', ...a }))
    })
    return out
  }, [selectedReg])

  function selectReg(id) {
    setSelectedRegId(id)
    setFocusedArtNo(null)
    setSidebarOpen(false)
    if (mainRef.current) mainRef.current.scrollTop = 0
  }

  function gotoArticle(no) {
    setFocusedArtNo(no)
    setTreeOpen(false)
    const el = articleRefs.current[no]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    articleRefs.current = {}
  }, [selectedRegId])

  if (!data) {
    return (
      <div className="app">
        <div className="empty">
          <Icon name="book" size={48} />
          <p>규정 데이터를 불러오는 중…</p>
        </div>
      </div>
    )
  }
  if (data.error) {
    return (
      <div className="app">
        <div className="empty">
          <h3>데이터를 불러오지 못했습니다</h3>
          <p>페이지를 새로고침해 주세요.</p>
        </div>
      </div>
    )
  }

  const totalArticles = regulations.reduce((s, r) => s + r.articleCount, 0)

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="메뉴"
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="topbar__brand">
          <span className="topbar__logo">
            <Icon name="book" size={20} />
            규정정보센터
          </span>
          <span className="topbar__sub">{data.org}</span>
        </div>
        <div className="topbar__tabs">
          {['규정', '내규'].map((t) => (
            <button
              key={t}
              className={`topbar__tab${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="topbar__spacer" />
        <span className="topbar__meta tabular">{data.basisDate}</span>
      </header>

      {tab === '규정' ? (
        <div className="body">
          <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`}>
            <div className="search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="규정·조문 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <nav className="reglist">
              <div className="reglist__group-label">
                규정 {filteredRegs.length}건
              </div>
              {filteredRegs.map((r) => (
                <button
                  key={r.id}
                  className={`regitem${r.id === selectedRegId ? ' is-active' : ''}`}
                  onClick={() => selectReg(r.id)}
                >
                  <span className="regitem__no tabular">{r.id}</span>
                  <span className="regitem__name">{r.name}</span>
                  <span className="regitem__count tabular">{r.articleCount}</span>
                </button>
              ))}
            </nav>
          </aside>

          <nav className={`tree${treeOpen ? ' is-open' : ''}`}>
            {selectedReg && (
              <>
                <div className="tree__reg-title">{selectedReg.name}</div>
                <div className="tree__reg-meta tabular">
                  {selectedReg.articleCount}개 조문 · 부칙 {selectedReg.buchik.length}건
                </div>
                {flatArticles.map((item, i) =>
                  item.kind === 'chap' ? (
                    <div className="tree__chap" key={`c${i}`}>
                      제{item.num}장 {item.title}
                    </div>
                  ) : (
                    <button
                      key={`a${item.no}`}
                      className={`tree__art${focusedArtNo === item.no ? ' is-active' : ''}`}
                      onClick={() => gotoArticle(item.no)}
                    >
                      <span className="tree__art-no">제{item.no}조</span>
                      <span>{item.title}</span>
                    </button>
                  ),
                )}
              </>
            )}
          </nav>

          <main className="main" ref={mainRef}>
            {selectedReg ? (
              <RegulationView
                reg={selectedReg}
                org={data.org}
                focusedArtNo={focusedArtNo}
                onPickAmend={(art) => setAmend({ reg: selectedReg, art })}
                articleRefs={articleRefs}
              />
            ) : (
              <div className="empty">
                <Icon name="book" size={48} />
                <h3>규정을 선택하세요</h3>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="body">
          <main className="main">
            <div className="notice">
              <h3>
                <Icon name="lock" size={20} />
                내규 합본은 문서 암호화로 열람이 제한됩니다
              </h3>
              <p>
                제공된 <code>내규 합본.hwpx</code> 파일은 한글 문서 자체에 열람
                암호(AES-256)가 설정되어 있어, 암호 없이는 본문을 추출할 수
                없습니다.
              </p>
              <p>
                내규 데이터를 이 사이트에 반영하려면 <strong>암호가 해제된
                파일</strong> 또는 <strong>문서 열람 암호</strong>를 제공해
                주세요. 규정 합본(배포용 문서)은 정상적으로 추출되어 현재{' '}
                <strong>34개 규정 · {totalArticles}개 조문</strong>이
                제공되고 있습니다.
              </p>
            </div>
          </main>
        </div>
      )}

      {amend && (
        <AmendModal
          regName={amend.reg.name}
          article={amend.art}
          onClose={() => setAmend(null)}
        />
      )}
    </div>
  )
}
