import { useState, useMemo } from 'react'
import { diffTokens, renderDiffSide } from './diff.js'
import { Icon } from './icons.jsx'

function DiffCell({ ops, side }) {
  const parts = useMemo(() => renderDiffSide(ops, side), [ops, side])
  return (
    <div className="cmp-line">
      {parts.map((p, i) => {
        if (p.kind === 'ins') return <ins key={i} className="diff">{p.text}</ins>
        if (p.kind === 'del') return <del key={i} className="diff">{p.text}</del>
        return <span key={i}>{p.text}</span>
      })}
    </div>
  )
}

export default function AmendModal({ regName, article, onClose }) {
  const current = article ? `${article.label}(${article.title}) ${article.body}` : ''
  const [oldText, setOldText] = useState(current)
  const [newText, setNewText] = useState(current)
  const [reason, setReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [view, setView] = useState('edit')

  const ops = useMemo(() => diffTokens(oldText, newText), [oldText, newText])

  const changed = ops.some((o) => o.type !== 'equal')

  function print() {
    window.print()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h2>신구조문대조표 생성</h2>
            <div className="sub">
              {regName} · {article ? article.label : '신규 조문'}
            </div>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="modal__body">
          {view === 'edit' ? (
            <>
              <div className="editor-grid">
                <div className="editor-col editor-col--old">
                  <label htmlFor="old-text">현행 (개정 전)</label>
                  <textarea
                    id="old-text"
                    value={oldText}
                    onChange={(e) => setOldText(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div className="editor-col editor-col--new">
                  <label htmlFor="new-text">개정안 (개정 후)</label>
                  <textarea
                    id="new-text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="editor-meta">
                <div className="field">
                  <label htmlFor="reason">개정 사유</label>
                  <input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="예: 조직개편에 따른 부서 명칭 정비"
                  />
                </div>
                <div className="field">
                  <label htmlFor="eff">시행일</label>
                  <input
                    id="eff"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    placeholder="예: 2026.09.01."
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="print-area">
              <div className="cmp-doc">
                <div className="cmp-doc__title">신·구조문대조표</div>
                <div className="cmp-doc__subtitle">
                  {regName}
                  {effectiveDate ? ` · 시행일 ${effectiveDate}` : ''}
                </div>
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>현 행</th>
                      <th>개 정 안</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="col-old">
                        <DiffCell ops={ops} side="old" />
                      </td>
                      <td className="col-new">
                        <DiffCell ops={ops} side="new" />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="cmp-legend">
                  <span>
                    <i style={{ background: 'var(--del-soft)' }} /> 삭제·변경 (현행)
                  </span>
                  <span>
                    <i style={{ background: 'var(--ins-soft)' }} /> 신설·변경 (개정안)
                  </span>
                </div>
                {reason && (
                  <div className="cmp-reason">
                    <h4>개정 사유</h4>
                    <p>{reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal__foot">
          <span className="hint">
            {changed ? '변경 사항이 감지되었습니다.' : '좌·우 내용이 동일합니다.'}
          </span>
          {view === 'edit' ? (
            <>
              <button className="btn" onClick={onClose}>
                취소
              </button>
              <button className="btn btn--primary" onClick={() => setView('preview')}>
                <Icon name="table" size={16} />
                대조표 생성
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setView('edit')}>
                <Icon name="back" size={16} />
                수정
              </button>
              <button className="btn" onClick={print}>
                <Icon name="print" size={16} />
                인쇄 / PDF 저장
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
