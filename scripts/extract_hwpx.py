"""Extract paragraph text from an (unencrypted) HWPX file.

HWPX stores body text as OWPML XML under Contents/section*.xml. Each paragraph
is an <hp:p> element containing <hp:run>/<hp:t> text runs. This emits one string
per paragraph, matching the output format of extract_hwp.py so the same
build pipeline can consume it.
"""
import html
import json
import re
import sys
import zipfile


def section_key(name):
    m = re.search(r'section(\d+)\.xml$', name)
    return int(m.group(1)) if m else 1 << 30


def paragraphs_from_section(xml):
    out = []
    # Split into individual paragraphs on the <hp:p ...> boundary.
    for pm in re.finditer(r'<hp:p\b[^>]*>(.*?)</hp:p>', xml, re.S):
        chunk = pm.group(1)
        parts = []
        # A line break inside a run is <hp:lineBreak/>; a table/cell boundary
        # or nested paragraph also carries text via <hp:t>.
        for tm in re.finditer(r'<hp:t(?:\s[^>]*)?>(.*?)</hp:t>', chunk, re.S):
            t = tm.group(1)
            t = t.replace('<hp:lineBreak/>', '\n')
            # Drop any residual inline tags (markpen, ctrl, etc.).
            t = re.sub(r'<[^>]+>', '', t)
            parts.append(html.unescape(t))
        text = ''.join(parts)
        out.append(text)
    return out


def extract(hwpx_path):
    z = zipfile.ZipFile(hwpx_path)
    secs = sorted(
        (n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n)),
        key=section_key,
    )
    paras = []
    for sec in secs:
        xml = z.read(sec).decode('utf-8', 'ignore')
        paras.extend(paragraphs_from_section(xml))
    return paras


if __name__ == '__main__':
    paras = extract(sys.argv[1])
    json.dump(paras, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(paras)} paragraphs -> {sys.argv[2]}')
