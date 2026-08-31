"""Build the 내규(internal-rule) dataset from extracted HWPX paragraphs.

Reuses the article/chapter/부칙/별표 parsing logic proven on the 규정 dataset,
but with the 내규 table of contents and its own document layout (the body title
of each 내규 appears as a standalone paragraph after the front-matter TOC).
"""
import json
import re
import sys

ORG = '전남광주통합특별시광산구시설관리공단'
TABLE_MARKER = '\x00TBL\x00'

# 28 내규 in document order. Each body opens with an org-prefixed title
# paragraph (ORG + name), which is how we locate section boundaries.
TOC = [
    '인사규정 시행내규', '보수규정 시행내규', '감사규정 시행내규',
    '적극행정 면책 및 경고 등 처분에 관한 내규', '임직원행동강령에 관한 내규',
    '재정보증 시행내규', '회계규정 시행내규', '교육훈련 운영내규', '제안제도 운영내규',
    '임금피크제 시행내규', '유연근무제 시행내규', '공용차량 관리 내규',
    '체육시설 관리·운영 내규', '인권경영 이행내규', '직장 내 괴롭힘 예방 및 대응 시행내규',
    '노동자이사 후보 선거 관리 내규', '주차장 관리내규', '연구용역 관리 시행내규',
    '직제규정 시행내규', '사무전결처리 규정 시행내규', '휴직자 복무관리 시행내규',
    '공직자의 이해충돌 방지제도 운영 내규', '소송사무처리 시행내규', '시간강사 관리 내규',
    '임직원 겸직허가 운영내규', '노동이사제 운영 내규', '공무국외여행 운영 내규',
    '스토킹 예방 시행내규',
]

DISPLAY_OVERRIDE = {}

RE_CHAP = re.compile(r'^\s*제\s*(\d+)\s*장\s+(.+)$')
RE_ART = re.compile(r'^\s*제\s*(\d+)(?:조의(\d+)|조)\s*(?:\((.*?)\))?\s*(.*)$', re.S)
RE_BUCHIK = re.compile(r'^\s*부\s*칙')
RE_BYEOL = re.compile(r'^\s*[【\[]?\s*(별\s*표|별\s*지|서\s*식)')
RE_REVISE = re.compile(r'<\s*(?:개정|신설|전문개정|본조신설|제정)\s*([0-9./,\s]+?)\s*>')


def norm(s):
    return re.sub(r'\s+', '', s or '')


def find_ranges(paras, toc_start):
    starts = []
    cursor = toc_start
    for name in TOC:
        target = norm(ORG + name)
        bare = norm(name)
        found = None
        for i in range(cursor, len(paras)):
            if norm(paras[i]) in (target, bare):
                found = i
                break
        if found is None:
            raise SystemExit(f'heading not found: {name} (from {cursor})')
        starts.append([name, found])
        cursor = found + 1
    return [
        [name, st, (starts[i + 1][1] if i + 1 < len(starts) else len(paras))]
        for i, (name, st) in enumerate(starts)
    ]


def parse_regulation(name, plist):
    chapters = []
    cur = {'num': None, 'title': None, 'articles': []}
    flat = []
    buchik = []
    byeolpyo = []
    revisions = set()
    mode = 'body'
    i = 0
    while i < len(plist):
        p = plist[i].rstrip('\n')
        if not p.strip():
            i += 1
            continue
        if RE_BUCHIK.match(p.replace(' ', '')[:3]) or RE_BUCHIK.match(p):
            mode = 'tail'
            block = []
            i += 1
            while i < len(plist):
                q = plist[i].rstrip('\n')
                if plist[i].startswith(TABLE_MARKER):
                    i += 1
                    continue
                if (RE_BUCHIK.match(q.replace(' ', '')[:3]) or RE_BUCHIK.match(q)) or RE_BYEOL.match(q):
                    break
                if q.strip():
                    block.append(q)
                i += 1
            text = '\n'.join(block)
            dd = re.search(r'(\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.?)', text)
            buchik.append({'date': dd.group(1).replace(' ', '') if dd else '', 'text': text})
            continue
        if RE_BYEOL.match(p):
            mode = 'tail'
            entry = {'title': p, 'tables': []}
            i += 1
            while i < len(plist):
                q = plist[i]
                if q.startswith(TABLE_MARKER):
                    entry['tables'].append(q[len(TABLE_MARKER):])
                    i += 1
                    continue
                qs = q.rstrip('\n')
                if (RE_BUCHIK.match(qs.replace(' ', '')[:3]) or RE_BUCHIK.match(qs)
                        or RE_BYEOL.match(qs)):
                    break
                if qs.strip():
                    entry.setdefault('notes', []).append(qs)
                i += 1
            byeolpyo.append(entry)
            continue
        if p.startswith(TABLE_MARKER):
            i += 1
            continue
        mc = RE_CHAP.match(p)
        if mc:
            if cur['articles'] or cur['title']:
                chapters.append(cur)
            cur = {'num': int(mc.group(1)), 'title': mc.group(2).strip(), 'articles': []}
            i += 1
            continue
        ma = RE_ART.match(p)
        if ma and mode == 'body':
            num = ma.group(1)
            sub = ma.group(2)
            art_no = f'{num}의{sub}' if sub else num
            title = (ma.group(3) or '').strip()
            first = (ma.group(4) or '').strip()
            lines = [first] if first else []
            for rev in RE_REVISE.findall(p):
                for d in re.findall(r'\d{4}\.\d{1,2}\.\d{1,2}', rev.replace(' ', '')):
                    revisions.add(d)
            i += 1
            while i < len(plist):
                q = plist[i].rstrip('\n')
                if plist[i].startswith(TABLE_MARKER):
                    lines.append(plist[i])
                    i += 1
                    continue
                if not q.strip():
                    i += 1
                    continue
                if re.match(r'^\s*제\s*\d+\s*조', q) or RE_CHAP.match(q):
                    break
                if RE_BUCHIK.match(q.replace(' ', '')[:3]) or RE_BYEOL.match(q):
                    break
                lines.append(q)
                for rev in RE_REVISE.findall(q):
                    for d in re.findall(r'\d{4}\.\d{1,2}\.\d{1,2}', rev.replace(' ', '')):
                        revisions.add(d)
                i += 1
            art = {'no': art_no, 'title': title, 'label': f'제{art_no}조',
                   'body': '\n'.join(lines).strip()}
            cur['articles'].append(art)
            flat.append(art)
            continue
        i += 1
    if cur['articles'] or cur['title']:
        chapters.append(cur)
    if not any(c['title'] for c in chapters):
        chapters = [{'num': None, 'title': None, 'articles': flat}]
    display = DISPLAY_OVERRIDE.get(name, name)
    return {'name': display, 'chapters': chapters, 'articleCount': len(flat),
            'buchik': buchik, 'byeolpyo': byeolpyo, 'revisions': sorted(revisions)}


def find_toc_start(paras):
    first = norm(ORG + TOC[0])
    for i, s in enumerate(paras):
        if norm(s) == first:
            return i
    raise SystemExit('could not locate body start')


if __name__ == '__main__':
    paras = json.load(open(sys.argv[1], encoding='utf-8'))
    toc_start = find_toc_start(paras)
    ranges = find_ranges(paras, toc_start)
    regs = []
    for idx, (name, s, e) in enumerate(ranges):
        reg = parse_regulation(name, paras[s:e])
        reg['id'] = idx + 1
        regs.append(reg)
    out = {'title': '광산구시설관리공단 내규집',
           'org': '전남광주통합특별시광산구시설관리공단',
           'basisDate': '2026. 8. 기준', 'category': '내규', 'regulations': regs}
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(regs)} 내규, {sum(r["articleCount"] for r in regs)} articles -> {sys.argv[2]}')
