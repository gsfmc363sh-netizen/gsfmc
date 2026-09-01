import json
import re
import sys
from pathlib import Path

import pymupdf

ORG = '전남광주통합특별시광산구시설관리공단'
# 실제 별표/서식/별지 내용은 각진괄호 【 】로 시작한다. 대괄호 [별표 N]은
# 별표 색인 페이지의 목록 항목이거나 본문 인라인 참조이므로 헤더로 잡지 않는다.
HDR = re.compile(r'^\s*【\s*(별\s*표|별\s*지|서\s*식)')
# 각진괄호 별표/서식 헤더가 페이지 어디에서 나오든 탐지한다(범위 종료 경계 판정용).
ANNEX_HDR = re.compile(r'(?m)^\s*【\s*(?:별\s*표|별\s*지|서\s*식)\b[^】]*】')
# '【별표 3】삭제'처럼 헤더 뒤에 '삭제'만 있는 경우는 렌더링할 실제 내용이 없는 삭제 별표다.
DELETED_HDR = re.compile(r'^\s*【\s*(?:별\s*표|별\s*지|서\s*식)\b[^】]*】\s*삭제')
# 규정 사이의 표지 페이지는 규정명과 개정 구분(일부/전부개정·제정)만 담긴 짧은 페이지다.
COVER = re.compile(r'(?:일부개정|전부개정|제정)')
# 발령문 표지는 최대 ~147자(발령문에 직전 규정명이 잘못 병기된 예외 포함)라, 본문 오탐을
# 조문-시작 가드로 따로 막고 상한은 넉넉히 둔다.
COVER_MAX_CHARS = 160
# '- 192 -'처럼 페이지 번호만 있는 줄. 여백 페이지 판별 시 이 줄을 제거하고 남는 내용을 본다.
PAGE_NUM = re.compile(r'(?m)^\s*-\s*\d+\s*-\s*$')
# 페이지 상단이 '제29조(' 처럼 조문으로 새로 시작하면 별표가 아니라 본문 재개 페이지다.
ARTICLE_START = re.compile(r'^제\s*\d+\s*조(?:의\s*\d+)?\s*\(')
RENDER_DPI = 130


def norm(s):
    return re.sub(r'\s+', '', s or '')


def without_page_number(text):
    return PAGE_NUM.sub('', text or '').strip()


def meaningful_lines(text):
    return [ln.strip() for ln in without_page_number(text).splitlines() if ln.strip()]


def is_cover_page(text):
    # 페이지 번호를 뗀 본문 전체가 짧고 개정/제정 표기를 담으면 표지다. 조문·양식이 본문에서
    # '일부개정'을 참조하는 경우를 걸러내기 위해 전체 길이 상한을 둔다. 또한 페이지 상단이
    # '제N조('로 시작하면 상한을 넉넉히 둬도 본문 재개 페이지를 표지로 오인하지 않도록 배제한다.
    content = without_page_number(text)
    if not bool(COVER.search(content)) or len(content) >= COVER_MAX_CHARS:
        return False
    lines = meaningful_lines(text)
    if lines and ARTICLE_START.match(lines[0]):
        return False
    return True


def is_hard_blank_page(page, text):
    # 페이지 번호 외에 아무 텍스트도 없고 이미지·드로잉이 없는 확실한 여백만 blank로 본다.
    # 텍스트가 적다는 이유만으로 제거하면 스캔 양식/표를 잃으므로 엄격히 판정한다.
    return (not without_page_number(text)
            and not page.get_images(full=True)
            and len(page.get_drawings()) < 3)


def is_body_page(text, regname):
    # 본문 여부는 페이지 상단 앵커로만 판정한다. 양식 안내문·표 셀의 '제N조' 참조를
    # 본문 근거로 쓰지 않기 위해, 페이지 첫 의미 있는 줄(들)만 검사한다.
    lines = meaningful_lines(text)
    if not lines:
        return False
    expected = norm(ORG + regname)
    if expected in norm(lines[0]) or expected in norm(''.join(lines[:2])):
        return True
    return bool(ARTICLE_START.match(lines[0]))


def body_starts(page_texts, names):
    # 규정 시작점은 반드시 '표지 페이지'(짧은 페이지 + 제정/개정 표기)에서만 찾는다.
    # 본문 조문이 「…사무관리 규정」처럼 다른 규정명을 인용하면, 그 인용문이 다음
    # 규정의 시작으로 오인되어 범위가 잘리고 별표가 통째로 누락된다(회계 규정 사례).
    # 표지로 후보를 한정하면 인라인 교차참조가 구조적으로 배제된다.
    npages = [norm(t) for t in page_texts]
    covers = [is_cover_page(t) for t in page_texts]
    starts = []
    cursor = 0
    for nm in names:
        target = norm(ORG + nm)
        bare = norm(nm)
        # 기관명까지 포함한 표지를 우선한다.
        found = next((p for p in range(cursor, len(npages))
                      if covers[p] and target in npages[p]), None)
        # 텍스트 추출 과정에서 기관명이 분할·누락된 표지를 위한 fallback(표지 조건은 유지).
        if found is None:
            found = next((p for p in range(cursor, len(npages))
                          if covers[p] and bare in npages[p]), None)
        if found is None:
            raise SystemExit(f'cover start not found: {nm}')
        starts.append(found)
        cursor = found + 1
    starts.append(len(page_texts))
    # 불변식: 모든 시작점은 대응 규정명을 담은 표지이며, 범위는 엄격히 증가한다.
    assert all(a < b for a, b in zip(starts, starts[1:])), 'reg ranges must strictly increase'
    assert all(covers[s] and (norm(ORG + nm) in npages[s] or norm(nm) in npages[s])
               for s, nm in zip(starts[:-1], names)), 'each start must be its cover page'
    return starts


def headers_in_range(page_texts, start, end):
    out = []
    for p in range(start, end):
        for line in page_texts[p].splitlines():
            s = line.strip()
            if HDR.match(s):
                out.append((p, s))
    return out


def annex_end_page(doc, page_texts, header_page, upper_bound, regname):
    last = header_page
    for p in range(header_page + 1, upper_bound):
        text = page_texts[p]
        if ANNEX_HDR.search(text) or is_cover_page(text) \
                or is_hard_blank_page(doc[p], text) or is_body_page(text, regname):
            break
        last = p
    return last


def render_pages(doc, first, last, out_dir, prefix):
    out_dir.mkdir(parents=True, exist_ok=True)
    rels = []
    zoom = RENDER_DPI / 72
    mat = pymupdf.Matrix(zoom, zoom)
    for p in range(first, last + 1):
        pix = doc[p].get_pixmap(matrix=mat, colorspace=pymupdf.csGRAY)
        fname = f'{prefix}_p{p + 1}.png'
        pix.save(str(out_dir / fname))
        rels.append(fname)
    return rels


def process(pdf_path, json_path, category, out_root, url_prefix):
    doc = pymupdf.open(pdf_path)
    page_texts = [doc[p].get_text() for p in range(doc.page_count)]
    data = json.load(open(json_path, encoding='utf-8'))
    regs = data['regulations']
    names = [r['name'] for r in regs]
    starts = body_starts(page_texts, names)

    for i, reg in enumerate(regs):
        s, e = starts[i], starts[i + 1]
        hdrs = headers_in_range(page_texts, s, e)
        entries = []
        for h_idx, (page, title) in enumerate(hdrs):
            next_page = hdrs[h_idx + 1][0] if h_idx + 1 < len(hdrs) else e
            upper = next_page if next_page > page else e
            last = annex_end_page(doc, page_texts, page, upper, reg['name'])
            prefix = f'{reg["id"]}_{h_idx}'
            out_dir = out_root / category
            images = render_pages(doc, page, last, out_dir, prefix)
            entries.append({
                'title': title,
                'pdfPage': page + 1,
                'images': [f'{url_prefix}/{category}/{name}' for name in images],
            })
        reg['byeolpyo'] = entries

    json.dump(data, open(json_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(len(r['byeolpyo']) for r in regs)
    imgs = sum(len(b['images']) for r in regs for b in r['byeolpyo'])
    print(f'{category}: {len(regs)} regs, {total} byeolpyo, {imgs} images -> {json_path}')


if __name__ == '__main__':
    public = Path('app/public')
    out_root = public / 'byeolpyo'
    process(str(public / 'regulations.pdf'), str(public / 'regulations.json'),
            'regulations', out_root, 'byeolpyo')
    process(str(public / 'naegyu.pdf'), str(public / 'naegyu.json'),
            'naegyu', out_root, 'byeolpyo')
