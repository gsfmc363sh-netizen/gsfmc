function tokenize(text) {
  const tokens = []
  const re = /(\s+|[가-힣]+|[a-zA-Z0-9]+|[^\s가-힣a-zA-Z0-9])/g
  let m
  while ((m = re.exec(text)) !== null) tokens.push(m[0])
  return tokens
}

function lcsMatrix(a, b) {
  const n = a.length
  const mLen = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(mLen + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = mLen - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  return dp
}

export function diffTokens(oldText, newText) {
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const dp = lcsMatrix(a, b)
  const ops = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', a: a[i], b: b[j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', a: a[i] })
      i++
    } else {
      ops.push({ type: 'ins', b: b[j] })
      j++
    }
  }
  while (i < a.length) ops.push({ type: 'del', a: a[i++] })
  while (j < b.length) ops.push({ type: 'ins', b: b[j++] })
  return ops
}

export function renderDiffSide(ops, side) {
  const parts = []
  for (const op of ops) {
    if (op.type === 'equal') parts.push({ kind: 'same', text: side === 'old' ? op.a : op.b })
    else if (op.type === 'del' && side === 'old') parts.push({ kind: 'del', text: op.a })
    else if (op.type === 'ins' && side === 'new') parts.push({ kind: 'ins', text: op.b })
  }
  const merged = []
  for (const p of parts) {
    const last = merged[merged.length - 1]
    if (last && last.kind === p.kind) last.text += p.text
    else merged.push({ ...p })
  }
  return merged
}

export function hasChanges(ops) {
  return ops.some((o) => o.type !== 'equal')
}
