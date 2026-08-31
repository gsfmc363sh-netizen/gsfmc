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
COVER_MAX_CHARS = 120
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
    # '일부개정'을 참조하는 경우를 걸러내기 위해 전체 길이 상한을 둔다.
    content = without_page_number(text)
    return bool(COVER.search(content)) and len(content) < COVER_MAX_CHARS


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
    npages = [norm(t) for t in page_texts]
    starts = []
    cursor = 0
    for nm in names:
        target = norm(ORG + nm)
        bare = norm(nm)
        found = next((p for p in range(cursor, len(npages)) if target in npages[p]), None)
        if found is None:
            found = next((p for p in range(cursor, len(npages)) if bare in npages[p]), None)
        if found is None:
            raise SystemExit(f'body start not found: {nm}')
        starts.append(found)
        cursor = found
    starts.append(len(page_texts))
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
