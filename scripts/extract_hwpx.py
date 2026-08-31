"""Extract paragraphs (and tables) from an unencrypted HWPX file.

HWPX stores body text as OWPML XML under Contents/section*.xml. The section root
(<hp:sec>) has top-level <hp:p> paragraphs; a table (<hp:tbl>) lives inside a
paragraph's run. We emit one entry per top-level paragraph, matching the flat
list format extract_hwp.py produces so the same build pipeline can consume it.

Tables are converted to sanitized HTML (<table> with rowspan/colspan) and
emitted as a single entry prefixed with TABLE_MARKER, so the web app can render
them as real tables (별표/서식/별지) instead of a collapsed line of text.
"""
import html
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

TABLE_MARKER = '\x00TBL\x00'


def section_key(name):
    m = re.search(r'section(\d+)\.xml$', name)
    return int(m.group(1)) if m else 1 << 30


def ln(tag):
    return tag.split('}')[-1]


def cell_text(tc):
    """Concatenate paragraph text inside a table cell, preserving paragraph
    breaks as newlines. Nested tables inside a cell are flattened to text."""
    lines = []
    for p in tc.iter():
        if ln(p.tag) != 'p':
            continue
        parts = []
        for t in p.iter():
            if ln(t.tag) == 't':
                parts.append(''.join(t.itertext()))
            elif ln(t.tag) == 'lineBreak':
                parts.append('\n')
        s = ''.join(parts).strip()
        if s:
            lines.append(s)
    return '\n'.join(lines)


def table_to_html(tbl):
    rows = tbl.findall('{*}tr')
    out = ['<table>']
    for tr in rows:
        out.append('<tr>')
        for tc in tr.findall('{*}tc'):
            span = tc.find('{*}cellSpan')
            cs = int(span.get('colSpan', '1')) if span is not None else 1
            rs = int(span.get('rowSpan', '1')) if span is not None else 1
            attr = ''
            if cs > 1:
                attr += f' colspan="{cs}"'
            if rs > 1:
                attr += f' rowspan="{rs}"'
            txt = html.escape(cell_text(tc)).replace('\n', '<br>')
            out.append(f'<td{attr}>{txt}</td>')
        out.append('</tr>')
    out.append('</table>')
    return ''.join(out)


def paragraph_text(p):
    parts = []
    for el in p.iter():
        if ln(el.tag) == 't':
            parts.append(''.join(el.itertext()))
        elif ln(el.tag) == 'lineBreak':
            parts.append('\n')
    return ''.join(parts)


def paragraphs_from_section(xml_bytes):
    root = ET.fromstring(xml_bytes)
    out = []
    # Only iterate DIRECT <hp:p> children of the section, so paragraphs nested
    # inside table cells are not double-counted.
    for p in root:
        if ln(p.tag) != 'p':
            continue
        tbls = p.findall('.//{*}tbl')
        if tbls:
            # A paragraph hosting one or more tables: emit each table as HTML.
            # Any stray text in the same paragraph is appended after.
            html_parts = [table_to_html(t) for t in tbls]
            out.append(TABLE_MARKER + '\n'.join(html_parts))
        else:
            out.append(paragraph_text(p))
    return out


def extract(hwpx_path):
    z = zipfile.ZipFile(hwpx_path)
    secs = sorted(
        (n for n in z.namelist() if re.match(r'Contents/section\d+\.xml$', n)),
        key=section_key,
    )
    paras = []
    for sec in secs:
        paras.extend(paragraphs_from_section(z.read(sec)))
    return paras


if __name__ == '__main__':
    paras = extract(sys.argv[1])
    json.dump(paras, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
    ntbl = sum(1 for p in paras if p.startswith(TABLE_MARKER))
    print(f'{len(paras)} paragraphs ({ntbl} tables) -> {sys.argv[2]}')
