import { useState, useMemo, useRef, useEffect } from 'react'
import { Icon } from './icons.jsx'
import AmendModal from './AmendModal.jsx'

function highlightRevisions(text) {
  const nodes = []
  const re = /<\s*(개정|신설|전문개정|본조신설|삭제|제정)[^>]*>/g
  let last = 0
  let m
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    nodes.push(
      <em className="revmark" key={key++}>
        {m[0]}
      </em>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function ByeolpyoItem({ item, pdfFile }) {
  const [open, setOpen] = useState(false)
  const base = import.meta.env.BASE_URL
  const pdfHref = `${base}${pdfFile}#page=${item.pdfPage}`
  return (
    <div className="byeolpyo-item">
      <button className="byeolpyo-item__head" onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? 'minus' : 'plus'} size={14} />
        <span className="byeolpyo-item__title">{highlightRevisions(item.title)}</span>
      </button>
      {open && (
        <div className="byeolpyo-item__body">
          {item.images.map((src, i) => (
            <img key={i} className="byeolpyo-img" src={`${base}${src}`} alt={item.title} loading="lazy" />
          ))}
          <a className="btn byeolpyo-item__pdf" href={pdfHref} target="_blank" rel="noreferrer">
            <Icon name="download" size={15} />
            원문 PDF에서 보기 ({item.pdfPage}쪽)
          </a>
        </div>
      )}
    </div>
  )
}

function RegulationView({ reg, org, pdfFile, focusedArtNo, onPickAmend, articleRefs }) {
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
          <div className="subsec__title">별표 · 서식 · 별지</div>
          {reg.byeolpyo.map((b, i) => (
            <ByeolpyoItem key={i} item={b} pdfFile={pdfFile} />
          ))}
        </div>
      )}
    </div>
  )
}

const DATASETS = {
  규정: 'regulations.json',
  내규: 'naegyu.json',
}

const PDF_FILES = {
  규정: 'regulations.pdf',
  내규: 'naegyu.pdf',
}

function PdfView({ tab, file }) {
  const url = `${import.meta.env.BASE_URL}${file}`
  return (
    <div className="pdfview">
      <div className="pdfview__bar">
        <span className="pdfview__label">{tab} 원문 (표·서식 포함)</span>
        <a className="btn" href={url} download>
          <Icon name="download" size={16} />
          PDF 내려받기
        </a>
      </div>
      <iframe className="pdfview__frame" src={url} title={`${tab} 원문 PDF`} />
    </div>
  )
}

export default function App() {
  const [datasets, setDatasets] = useState({ 규정: null, 내규: null })
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState('규정')
  const [viewMode, setViewMode] = useState('article')
  const [selectedRegId, setSelectedRegId] = useState(1)
  const [query, setQuery] = useState('')
  const [focusedArtNo, setFocusedArtNo] = useState(null)
  const [amend, setAmend] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [treeOpen, setTreeOpen] = useState(false)
  const articleRefs = useRef({})
  const mainRef = useRef(null)

  useEffect(() => {
    Promise.all(
      Object.entries(DATASETS).map(([key, file]) =>
        fetch(`${import.meta.env.BASE_URL}${file}`)
          .then((r) => r.json())
          .then((d) => [key, d]),
      ),
    )
      .then((entries) => setDatasets(Object.fromEntries(entries)))
      .catch(() => setLoadError(true))
  }, [])

  const data = datasets[tab]
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
    setViewMode('article')
    setFocusedArtNo(null)
    setSidebarOpen(false)
    if (mainRef.current) mainRef.current.scrollTop = 0
  }

  function selectTab(t) {
    if (t === tab) return
    setTab(t)
    setSelectedRegId(1)
    setFocusedArtNo(null)
    setQuery('')
    setSidebarOpen(false)
    setTreeOpen(false)
    if (mainRef.current) mainRef.current.scrollTop = 0
  }

  function gotoArticle(no) {
    setViewMode('article')
    setFocusedArtNo(no)
    setTreeOpen(false)
    const el = articleRefs.current[no]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    articleRefs.current = {}
  }, [selectedRegId, tab])

  if (loadError) {
    return (
      <div className="app">
        <div className="empty">
          <h3>데이터를 불러오지 못했습니다</h3>
          <p>페이지를 새로고침해 주세요.</p>
        </div>
      </div>
    )
  }
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
              onClick={() => selectTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="topbar__spacer" />
        <div className="topbar__view">
          <button
            className={`topbar__viewbtn${viewMode === 'article' ? ' is-active' : ''}`}
            onClick={() => setViewMode('article')}
          >
            조문
          </button>
          <button
            className={`topbar__viewbtn${viewMode === 'pdf' ? ' is-active' : ''}`}
            onClick={() => setViewMode('pdf')}
          >
            원문 PDF
          </button>
        </div>
        <span className="topbar__meta tabular">{data.basisDate}</span>
      </header>

      <div className="body">
        <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`}>
          <div className="search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder={`${tab}·조문 검색`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <nav className="reglist">
            <div className="reglist__group-label">
              {tab} {filteredRegs.length}건
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
          {viewMode === 'pdf' ? (
            <PdfView tab={tab} file={PDF_FILES[tab]} />
          ) : selectedReg ? (
            <RegulationView
              reg={selectedReg}
              org={data.org}
              pdfFile={PDF_FILES[tab]}
              focusedArtNo={focusedArtNo}
              onPickAmend={(art) => setAmend({ reg: selectedReg, art })}
              articleRefs={articleRefs}
            />
          ) : (
            <div className="empty">
              <Icon name="book" size={48} />
              <h3>{tab}을 선택하세요</h3>
            </div>
          )}
        </main>
      </div>

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
