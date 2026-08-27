import json, re, sys

TOC = ['정관','직제 규정','이사회운영 규정','기간제근로자 관리규정','물품관리 규정','감사 규정',
'당직 및 비상근무 규정','여비 규정','임·직원 업무관련 범죄 고발 규정','회계 규정','사무관리 규정',
'사무전결처리 규정','보안업무 규정','민원사무처리 규정','공인관리 규정','복무규정','제규정관리 규정',
'인사 규정','보수 규정','연봉제 규정','퇴직금 규정','임원추천위원회설치 및 운영 규정','계약직근로자 운영 규정',
'환경직근로자 채용 및 복무관리 규정','노사협의회 운영규정','공무직근로자 관리 규정','성과평가 규정',
'임원 인사규정','기능인재추천채용제 운영 규정','안전보건관리 규정','산업안전보건위원회 운영규정',
'개방형직위 운영 규정','행복나루노인복지관 운영 규정','정보공개운영 규정']

RE_CHAP = re.compile(r'^\s*제\s*(\d+)\s*장\s+(.+)$')
RE_ART = re.compile(r'^\s*제\s*(\d+)(?:조의(\d+)|조)\s*(?:\((.*?)\))?\s*(.*)$', re.S)
RE_BUCHIK = re.compile(r'^\s*부\s*칙')
RE_BYEOL = re.compile(r'^\s*[【\[]?\s*별\s*표')
RE_REVISE = re.compile(r'<\s*(?:개정|신설|전문개정|본조신설|제정)\s*([0-9./,\s]+?)\s*>')


def norm(s):
    return re.sub(r'\s+', '', s or '')


def find_ranges(paras):
    starts = []
    for name in TOC:
        n = norm(name)
        found = None
        sf = starts[-1][1] + 1 if starts and starts[-1][1] is not None else 0
        for i in range(sf, len(paras)):
            if norm(paras[i]) == n:
                found = i
                break
        starts.append([name, found])
    if starts[0][1] is None:
        starts[0][1] = 0
    for idx in range(len(starts)):
        if starts[idx][1] is None:
            prev = starts[idx - 1][1] if idx > 0 else 0
            nxt = next((starts[j][1] for j in range(idx + 1, len(starts))
                        if starts[j][1] is not None), len(paras))
            cand = None
            for i in range(prev + 1, nxt):
                if re.match(r'^\s*제\s*1\s*조\s*\(목적\)', paras[i]):
                    cand = i
            starts[idx][1] = cand if cand else prev + 1
    starts[0][1] = 80
    return [[name, st, (starts[i + 1][1] if i + 1 < len(starts) else len(paras))]
            for i, (name, st) in enumerate(starts)]


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
            byeolpyo.append(p)
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
    return {'name': name, 'chapters': chapters, 'articleCount': len(flat),
            'buchik': buchik, 'byeolpyo': byeolpyo, 'revisions': sorted(revisions)}


if __name__ == '__main__':
    paras = json.load(open(sys.argv[1], encoding='utf-8'))
    ranges = find_ranges(paras)
    regs = []
    for idx, (name, s, e) in enumerate(ranges):
        reg = parse_regulation(name, paras[s:e])
        reg['id'] = idx + 1
        regs.append(reg)
    out = {'title': '광산구시설관리공단 규정집',
           'org': '전남광주통합특별시광산구시설관리공단',
           'basisDate': '2026. 8. 기준', 'category': '규정', 'regulations': regs}
    json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(regs)} regulations, {sum(r["articleCount"] for r in regs)} articles -> {sys.argv[2]}')
