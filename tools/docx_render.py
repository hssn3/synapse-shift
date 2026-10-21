"""Render a DOCX to HTML (A4 landscape) preserving nested tables, merges and header.

Usage: python tools/docx_render.py <input.docx> <output.html> <outdir>
"""
import sys, os, zipfile, html, subprocess, shutil
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}


def q(tag):
    return '{%s}%s' % (W, tag)


def p_text(p):
    chunks = []
    for node in p.iter():
        tag = node.tag.split('}')[-1]
        if tag == 't':
            chunks.append(node.text or '')
        elif tag == 'br':
            chunks.append('\n')
        elif tag == 'tab':
            chunks.append('\t')
    return ''.join(chunks)


def is_bold(p):
    for rpr in p.iter(q('b')):
        val = rpr.get(q('val'))
        if val in (None, '1', 'true'):
            return True
    return False


def align_of(p):
    ppr = p.find(q('pPr'))
    if ppr is None:
        return ''
    jc = ppr.find(q('jc'))
    if jc is None:
        return ''
    return jc.get(q('val')) or ''


def cell_span(tc):
    tcpr = tc.find(q('tcPr'))
    span, vmerge = 1, None
    if tcpr is not None:
        gs = tcpr.find(q('gridSpan'))
        if gs is not None:
            try:
                span = int(gs.get(q('val')))
            except (TypeError, ValueError):
                span = 1
        vm = tcpr.find(q('vMerge'))
        if vm is not None:
            vmerge = vm.get(q('val')) or 'continue'
    return span, vmerge


def grid_widths(tbl):
    grid = tbl.find(q('tblGrid'))
    if grid is None:
        return []
    out = []
    for col in grid.findall(q('gridCol')):
        try:
            out.append(int(col.get(q('w'))))
        except (TypeError, ValueError):
            out.append(0)
    return out


def esc(s):
    return html.escape(s, quote=False).replace('\n', '<br>')


def render_children(node, depth=0):
    """Render paragraphs and nested tables inside a container."""
    parts = []
    for child in node:
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            txt = p_text(child).strip()
            if not txt:
                parts.append('<p class="empty">&nbsp;</p>')
                continue
            cls = 'p'
            if is_bold(child):
                cls += ' bold'
            al = align_of(child)
            if al:
                cls += ' a-' + al
            parts.append('<p class="%s">%s</p>' % (cls, esc(txt)))
        elif tag == 'tbl':
            parts.append(render_table(child, depth + 1))
    return ''.join(parts)


def render_table(tbl, depth=0):
    widths = grid_widths(tbl)
    total = sum(w for w in widths if w) or 1
    colgroup = ''
    if widths and all(widths):
        colgroup = '<colgroup>' + ''.join(
            '<col style="width:%.3f%%">' % (100.0 * w / total) for w in widths) + '</colgroup>'

    rows = tbl.findall(q('tr'))
    # Pre-compute rowspans for vMerge
    spans = {}  # (row_idx, grid_col) -> remaining rows
    body = []
    for ri, tr in enumerate(rows):
        cells_html = []
        gcol = 0
        for tc in tr.findall(q('tc')):
            span, vmerge = cell_span(tc)
            if vmerge == 'continue':
                key = (ri, gcol)
                # find originating cell up the rows and extend it
                origin = None
                for r in range(ri - 1, -1, -1):
                    if (r, gcol) in spans:
                        origin = (r, gcol)
                        break
                if origin:
                    spans[origin] += 1
                gcol += span
                continue
            rs = 1
            spans[(ri, gcol)] = rs
            rowspan_attr = ''
            cells_html.append((rs, span, render_children(tc, depth)))
            gcol += span

        # apply accumulated rowspans for cells that started in this row
        final = []
        idx = 0
        for tc in tr.findall(q('tc')):
            pass
        body.append((ri, cells_html))

    # second pass: build html using spans computed above
    html_rows = []
    for ri, tr in enumerate(rows):
        tds = []
        gcol = 0
        for tc in tr.findall(q('tc')):
            span, vmerge = cell_span(tc)
            if vmerge == 'continue':
                gcol += span
                continue
            rs = spans.get((ri, gcol), 1)
            attrs = ''
            if span > 1:
                attrs += ' colspan="%d"' % span
            if rs > 1:
                attrs += ' rowspan="%d"' % rs
            inner = render_children(tc, depth)
            tds.append('<td%s>%s</td>' % (attrs, inner))
            gcol += span
        html_rows.append('<tr>%s</tr>' % ''.join(tds))

    cls = 'tbl' + (' nested' if depth else '')
    pr = tbl.find(q('tblPr'))
    bidi = pr is not None and pr.find(q('bidiVisual')) is not None
    if not bidi:
        cls += ' ltr'
    ncols = max((len(r.findall(q('tc'))) for r in rows), default=0)
    if ncols > 25:
        cls += ' dense'
    elif len(rows) > 22:
        cls += ' split-ok'
    return '<table class="%s">%s<tbody>%s</tbody></table>' % (cls, colgroup, ''.join(html_rows))


def build_html(docx_path, out_html, title):
    z = zipfile.ZipFile(docx_path)
    doc = etree.fromstring(z.read('word/document.xml'))
    header_html = ''
    if 'word/header1.xml' in z.namelist():
        hdr = etree.fromstring(z.read('word/header1.xml'))
        header_html = render_children(hdr)

    body = doc.find(q('body'))
    content = []
    for child in body:
        tag = child.tag.split('}')[-1]
        if tag == 'p':
            txt = p_text(child).strip()
            if txt:
                content.append('<p class="p">%s</p>' % esc(txt))
        elif tag == 'tbl':
            content.append(render_table(child))

    font_dir = os.path.abspath('public/fonts')
    font_url = 'file:///' + os.path.join(font_dir, 'Vazirmatn-Variable.woff2').replace('\\', '/')

    doc_html = """<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>%s</title>
<style>
@font-face { font-family: 'Vazirmatn'; src: url('%s') format('woff2'); font-weight: 100 900; }
@page { size: A4 landscape; margin: 10mm; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Vazirmatn', 'Tahoma', sans-serif; direction: rtl; background: #fff; color: #000;
       font-size: 7.6pt; line-height: 1.35; }
.page { padding: 4mm; }
.header { margin-bottom: 2mm; }
.p { margin: 0.6mm 0; }
.p.bold { font-weight: 600; }
.p.a-center { text-align: center; }
.p.a-right { text-align: right; }
.p.a-left { text-align: left; }
.p.empty { margin: 0; height: 2.2mm; }
table.tbl { border-collapse: collapse; width: 100%%; table-layout: fixed; margin: 1.5mm 0;
            direction: rtl; break-inside: avoid; page-break-inside: avoid; }
table.tbl.ltr { direction: ltr; }
table.tbl.dense td { font-size: 6.1pt; padding: 0.25mm 0.35mm; line-height: 1.15; }
table.tbl.dense { break-inside: auto; page-break-inside: auto; }
table.tbl td { direction: rtl; unicode-bidi: plaintext; }
table.tbl td { border: 0.4pt solid #333; padding: 0.5mm 0.7mm; vertical-align: middle;
               text-align: center; overflow-wrap: anywhere; font-size: 7pt; }
table.tbl.nested td { font-size: 6.6pt; }
table.tbl td .p { margin: 0; }
</style></head><body><div class="page"><div class="header">%s</div>%s</div></body></html>
""" % (html.escape(title), font_url, header_html, ''.join(content))

    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(doc_html)
    return out_html


def to_pdf(html_path, pdf_path):
    chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    if not os.path.exists(chrome):
        raise SystemExit('chrome not found')
    url = 'file:///' + os.path.abspath(html_path).replace('\\', '/')
    cmd = [chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
           '--no-pdf-header-footer', '--virtual-time-budget=8000',
           '--print-to-pdf=' + os.path.abspath(pdf_path), url]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not os.path.exists(pdf_path):
        print(r.stdout[-2000:], r.stderr[-2000:])
        raise SystemExit('pdf not produced')


def pdf_to_png(pdf_path, outdir, stem, dpi=120):
    import fitz
    doc = fitz.open(pdf_path)
    outs = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi)
        p = os.path.join(outdir, '%s-p%d.png' % (stem, i + 1))
        pix.save(p)
        outs.append((p, page.rect.width, page.rect.height))
    return outs


if __name__ == '__main__':
    docx, out_html, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(docx))[0].replace(' ', '-')
    build_html(docx, out_html, stem)
    pdf = os.path.join(outdir, stem + '.pdf')
    to_pdf(out_html, pdf)
    pages = pdf_to_png(pdf, outdir, stem)
    for p, w, h in pages:
        print('%s  %.1f x %.1f pt' % (p, w, h))
