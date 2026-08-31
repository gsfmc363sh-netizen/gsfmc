import json
import re
import sys
from pathlib import Path

import pymupdf

ORG = '전남광주통합특별시광산구시설관리공단'
HDR = re.compile(r'^\s*[【\[]\s*(별\s*표|별\s*지|서\s*식)')
# 규정 사이의 표지 페이지는 규정명과 개정 구분(일부/전부개정·제정)만 담긴 짧은 페이지다.
# 마지막 별표 범위가 다음 규정 표지까지 삼키는 것을 막기 위해 이 시그니처로 표지를 판별한다.
COVER = re.compile(r'\((?:일부개정|전부개정|제정)\)')
COVER_MAX_CHARS = 120
RENDER_DPI = 130


def norm(s):
    return re.sub(r'\s+', '', s or '')


def is_cover_page(text):
    return bool(COVER.search(text or '')) and len((text or '').strip()) < COVER_MAX_CHARS


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
            last = max(page, next_page - 1)
            # 마지막 별표의 범위 끝이 다음 규정 표지 페이지를 삼키면 그만큼 잘라낸다.
            while last > page and is_cover_page(page_texts[last]):
                last -= 1
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
