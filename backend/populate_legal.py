import urllib.request, ssl, io, re
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

out = []
for t, title, url in DOCS:
    raw = urllib.request.urlopen(url, context=ctx, timeout=90).read()
    reader = PdfReader(io.BytesIO(raw))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    # pypdf bazı PDF'lerde her kelimeyi ayrı satıra koyar; akıcı paragraflara çevir
    text = re.sub(r"[ \t]*\n[ \t]*", " ", text)      # tüm satır sonlarını boşluğa çevir
    text = re.sub(r"[ \t]{2,}", " ", text).strip()   # fazla boşlukları tek boşluğa
    text = re.sub(r"\s+(MADDE\s)", r"\n\n\1", text, flags=re.IGNORECASE)  # MADDE başlıkları
    text = re.sub(r"\s+(\d{1,2})[.)]\s+", r"\n\n\1. ", text)  # numaralı maddeler
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    out.append({"type": t, "title": title, "body": text})
    print(t, "->", len(text), "karakter,", len(reader.pages), "sayfa")

db = MongoClient("mongodb://localhost:27017")["test_database"]
db.settings.update_one({"_id": "site"}, {"$set": {"legal_documents": out}}, upsert=True)
print("DB guncellendi, toplam", len(out), "belge")
