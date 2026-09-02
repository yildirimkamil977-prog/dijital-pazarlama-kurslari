import urllib.request, ssl, io, re, html as H
from pypdf import PdfReader
from pymongo import MongoClient

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

DOCS = [
    ("kvkk", "KVKK Aydınlatma Metni",
     "https://customer-assets-jt897jd0.emergentagent.net/job_video-elearning/artifacts/bclpgfve_KVKK.pdf"),
    ("gizlilik", "Gizlilik ve Çerez Politikası",
     "https://customer-assets-jt897jd0.emergentagent.net/job_video-elearning/artifacts/tq545l20_G%C4%B0ZL%C4%B0L%C4%B0K%20VE%20%C3%87EREZ%20POL%C4%B0T%C4%B0KASI.pdf"),
    ("satis", "Satış Sözleşmesi",
     "https://customer-assets-jt897jd0.emergentagent.net/job_video-elearning/artifacts/smoultes_Sat%C4%B1%C5%9F%20S%C3%B6zle%C5%9Fmesi.pdf"),
    ("teslimat", "Teslimat Koşulları",
     "https://customer-assets-jt897jd0.emergentagent.net/job_video-elearning/artifacts/jj5hdrtd_Teslimat%20Ko%C5%9Fullar%C4%B1%20%281%29.pdf"),
    ("iptal-iade", "İptal ve İade Politikası",
     "https://customer-assets-jt897jd0.emergentagent.net/job_video-elearning/artifacts/uxsrv5lw_%C4%B0ptal%20ve%20%C4%B0ade%20Politikas%C4%B1.pdf"),
]

URL_RE = re.compile(r'(https?://[^\s<]+)')


def fmt_inline(s):
    s = H.escape(s.strip())
    s = URL_RE.sub(r'<a href="\1" target="_blank" rel="noopener">\1</a>', s)
    # kalın etiket: satır başındaki "Etiket:" kısmı
    s = re.sub(r'^([^:<]{3,45}):(\s)', r'<strong>\1:</strong>\2', s)
    return s


def is_upper_heading(b):
    letters = [c for c in b if c.isalpha()]
    if not letters or len(b) > 95:
        return False
    ups = sum(1 for c in letters if c == c.upper() and not c.islower())
    return ups / len(letters) > 0.85


def to_html(raw):
    raw = raw.replace('\r', '')
    # 3+ satır sonu = paragraf; daha azı = kelime boşluğu
    def repl(m):
        return '\u0001' if m.group(0).count('\n') >= 3 else ' '
    marked = re.sub(r'[ \t]*(?:\n[ \t]*)+', repl, raw)
    blocks = [re.sub(r'\s{2,}', ' ', b).strip() for b in marked.split('\u0001')]
    blocks = [b for b in blocks if b]
    html_parts = []
    for b in blocks:
        if '●' in b or '•' in b or '▪' in b:
            parts = re.split(r'[●•▪]\s*', b)
            lead = parts[0].strip()
            items = [p.strip() for p in parts[1:] if p.strip()]
            if lead:
                html_parts.append(f'<p>{fmt_inline(lead)}</p>')
            if items:
                html_parts.append('<ul>' + ''.join(f'<li>{fmt_inline(i)}</li>' for i in items) + '</ul>')
        elif re.match(r'^\d{1,2}[.)]\s', b) and len(b) <= 80:
            html_parts.append(f'<h3>{H.escape(b)}</h3>')
        elif re.match(r'^(MADDE|BÖLÜM)\b', b, re.IGNORECASE) and len(b) <= 90:
            html_parts.append(f'<h3>{H.escape(b)}</h3>')
        elif is_upper_heading(b):
            html_parts.append(f'<h2>{H.escape(b)}</h2>')
        else:
            html_parts.append(f'<p>{fmt_inline(b)}</p>')
    return '\n'.join(html_parts)


out = []
for slug, title, url in DOCS:
    data = urllib.request.urlopen(url, context=ctx, timeout=90).read()
    reader = PdfReader(io.BytesIO(data))
    raw = "\n\n\n".join((p.extract_text() or "") for p in reader.pages)
    body = to_html(raw)
    out.append({"type": slug, "title": title, "body": body})
    print(slug, "->", len(body), "html karakter,", len(reader.pages), "sayfa")

db = MongoClient("mongodb://localhost:27017")["test_database"]
db.settings.update_one({"_id": "site"}, {"$set": {"legal_documents": out}}, upsert=True)
print("DB guncellendi, toplam", len(out), "belge (HTML)")
