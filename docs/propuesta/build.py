"""Genera UneedT_Propuesta.pdf a partir de propuesta.html con Microsoft Edge (sin instalar nada más).

Uso:  python docs/propuesta/build.py

Pasos:
 1. Construye el índice con los títulos <h2>/<h3> que tienen id.
 2. Imprime una primera versión y busca en qué página quedó cada título.
 3. Escribe esos números en el índice e imprime la versión final.
Requiere el paquete pypdf (pip install pypdf).
"""
import html
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata

from pypdf import PdfReader

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / 'propuesta.html'
OUT = HERE / 'UneedT_Propuesta.pdf'
EDGE_PATHS = [
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]
BODY_START = 'La vida académica universitaria'  # primera frase de la Introducción: el índice termina antes

HEADING = re.compile(r'<h([23])([^>]*)\bid="([^"]+)"([^>]*)>(.*?)</h\1>', re.S)


def edge() -> str:
    for p in EDGE_PATHS:
        if pathlib.Path(p).exists():
            return p
    sys.exit('No se encontró Microsoft Edge.')


def headings(src: str):
    out = []
    for m in HEADING.finditer(src):
        attrs = m.group(2) + m.group(4)
        if 'data-notoc' in attrs:
            continue
        text = html.unescape(re.sub(r'<[^>]+>', '', m.group(5))).strip()
        out.append((int(m.group(1)), m.group(3), text))
    return out


def with_toc(src: str, heads, pages=None) -> str:
    items = []
    for lvl, hid, text in heads:
        pg = pages.get(hid, '') if pages else ''
        items.append(
            f'<li class="l{lvl - 1}"><a class="t" href="#{hid}">{html.escape(text)}</a>'
            f'<span class="dots"></span><span class="pg">{pg}</span></li>'
        )
    return re.sub(r'(<ol class="toc" id="toc">).*?(</ol>)', lambda m: m.group(1) + ''.join(items) + m.group(2), src, flags=re.S)


def render(src: str, pdf: pathlib.Path):
    # El HTML temporal va junto al original para que encuentre propuesta.css
    tmp = HERE / '_build.html'
    tmp.write_text(src, encoding='utf-8')
    try:
        with tempfile.TemporaryDirectory() as profile:
            subprocess.run([
                edge(), '--headless', '--disable-gpu', '--no-pdf-header-footer', '--no-first-run',
                f'--user-data-dir={profile}', f'--print-to-pdf={pdf}', tmp.as_uri(),
            ], check=True, capture_output=True, timeout=180)
    finally:
        tmp.unlink(missing_ok=True)


def squash(s: str) -> str:
    # El texto extraído del PDF trae tildes descompuestas, ligaduras e i sin punto: se normaliza todo a ASCII simple
    s = unicodedata.normalize('NFKD', s.replace('\u0131', 'i'))
    s = ''.join(c for c in s if not unicodedata.combining(c) and c != '\x00')
    return re.sub(r'\s+', '', s).lower()


def locate(pdf: pathlib.Path, heads):
    texts = [squash(p.extract_text() or '') for p in PdfReader(str(pdf)).pages]
    start = next(i for i, t in enumerate(texts) if squash(BODY_START) in t)
    pages, cur = {}, start
    for _, hid, text in heads:
        key = squash(text)
        for i in range(cur, len(texts)):
            if key in texts[i]:
                pages[hid] = i + 1  # número de página físico = el del pie de página
                cur = i
                break
        else:
            print(f'  aviso: no se encontró «{text}»')
    return pages, len(texts)


def main():
    src = SRC.read_text(encoding='utf-8')
    heads = headings(src)
    with tempfile.TemporaryDirectory() as d:
        draft = pathlib.Path(d) / 'draft.pdf'
        render(with_toc(src, heads), draft)
        pages, _ = locate(draft, heads)
        final = pathlib.Path(d) / 'final.pdf'
        render(with_toc(src, heads, pages), final)
        pages2, n = locate(final, heads)
        if pages2 != pages:
            print('  aviso: la paginación cambió entre pasadas; revisa el índice')
        shutil.copyfile(final, OUT)
    print(f'Listo: {OUT} ({n} páginas)')


if __name__ == '__main__':
    main()
