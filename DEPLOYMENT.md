# Yayına Alma Rehberi — Hetzner + Docker + Caddy (otomatik HTTPS)

Bu proje tek komutla yayına alınacak şekilde hazırlandı:
- **mongo** — veritabanı (kalıcı disk `mongo_data`)
- **backend** — FastAPI (port 8001, iç ağ)
- **frontend** — React build'i nginx ile sunar (port 80, iç ağ)
- **caddy** — ters proxy + Let's Encrypt SSL (80/443 dışa açık)

Alan adı: **https://dijitalpazarlamakurslari.com**

---

## 1) Sunucuya bağlan
```bash
ssh root@188.245.184.200
```

## 2) Docker + Compose kurulu mu kontrol et
```bash
docker --version
docker compose version
```
Yoksa:
```bash
curl -fsSL https://get.docker.com | sh
```

## 3) Projeyi indir (ilk kurulum)
```bash
cd /opt
git clone <GITHUB_REPO_URL> akademi
cd akademi
```
> `<GITHUB_REPO_URL>` yerine "Save to GitHub" ile oluşan repo adresini yaz.

## 4) .env dosyasını oluştur
```bash
cp env.production.example .env
nano .env
```
`.env` içindeki `CHANGE_ME` alanlarını sohbette verilen gerçek değerlerle doldur ve kaydet (Ctrl+O, Enter, Ctrl+X).

> `.env` dosyası GitHub'a gönderilmez; sırların sadece sunucuda kalır.

## 5) Yayına al
```bash
docker compose up -d --build
```
İlk build birkaç dakika sürebilir (frontend build + imajlar).

## 6) SSL ve durum kontrolü
```bash
docker compose ps
docker compose logs -f caddy
```
Caddy, DNS doğru olduğu için otomatik Let's Encrypt sertifikası alır (loglarda "certificate obtained" görürsün). Sonra çık: Ctrl+C.

Backend loglarını görmek için:
```bash
docker compose logs -f backend
```

## 7) Test
Tarayıcıdan **https://dijitalpazarlamakurslari.com** aç. `www` otomatik ana adrese yönlenir.

---

## Güncelleme (kod değişince)
Her yeni değişiklikte (Save to GitHub sonrası):
```bash
cd /opt/akademi
git pull
docker compose up -d --build
```
Veritabanı `mongo_data` diskinde kalıcıdır; güncellemede silinmez.

## Google OAuth (önemli)
Google Cloud Console > OAuth istemcisi > **Authorized JavaScript origins** listesine şunu ekli olduğundan emin ol:
```
https://dijitalpazarlamakurslari.com
```
Yoksa Google ile giriş çalışmaz.

## (İsteğe bağlı) Canlı grup eğitimi hatırlatma e-postaları
Ders öncesi 24 saat / 1 saat hatırlatma için host'ta bir cron ekle:
```bash
crontab -e
```
Satır olarak (SECRET = .env içindeki WEBHOOK_CRON_SECRET):
```
*/15 * * * * curl -s -X POST https://dijitalpazarlamakurslari.com/api/cron/group-reminders -H "Authorization: Bearer SECRET" > /dev/null 2>&1
```

## Sorun giderme
- **Sertifika alınamıyor:** DNS'in `188.245.184.200`'e baktığını ve 80/443 portlarının açık olduğunu doğrula (`ufw status`). Gerekirse: `ufw allow 80 && ufw allow 443`.
- **Backend başlamıyor:** `docker compose logs backend` — genelde `.env` içinde eksik/yanlış değer olur.
- **Frontend API'ye ulaşamıyor:** `.env` içindeki `REACT_APP_BACKEND_URL=https://dijitalpazarlamakurslari.com` doğru mu? Değiştirdiysen `docker compose up -d --build frontend` ile yeniden build gerekir (bu değer build sırasında gömülür).
- **Baştan temiz kurulum:** `docker compose down` (veritabanını da silmek için `docker compose down -v` — DİKKAT: veriler gider).
