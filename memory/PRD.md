# PRD - Kamil Yıldırım Akademi (Dijital Pazarlama LMS)

## Original Problem Statement
Dijital pazarlama eğitmeni için video eğitim satış platformu. Ön yüz sayfaları (anasayfa, hakkımda, kurslar, kurs detay, sepet, ödeme, üye ol/giriş, öğrenci paneli, ders izleme, sözleşme sayfaları), admin panel (kurs yönetimi, ödemeler, öğrenciler, indirim kodları, site ayarları, e-posta şablonları), öğrenci paneli (eğitimler, ödemeler, sertifikalar), ders izleme (müfredat ilerleyişi, izlenen dersler, kaldığı yerden devam, video + açıklama + PDF kaynak indirme). PayTR ödeme (admin panelden yapılandırılabilir), Resend e-posta bildirimleri. Kendi sunucusunda yayınlanacak.

## User Choices
- Ödeme: PayTR — anahtarlar admin panelden girilecek (Merchant ID/Key/Salt, bildirim URL, test modu). Şu an test/mock.
- Auth: E-posta+şifre VE Google (Emergent-managed), her ikisinde de sözleşme onayı zorunlu.
- E-posta: Resend (Emergent-managed). Kullanıcı kendi bilgilerini sonra sağlayacak.
- Video: YouTube/Vimeo embed linki yapıştırma.

## Architecture
- Backend: FastAPI + MongoDB (motor). Modüler: deps.py (auth/session, Fernet-encrypted PayTR, Resend email, settings), routes_auth/courses/payments/admin, server.py (seed).
- Auth: Birleşik session sistemi — bcrypt email/şifre + Emergent Google, ikisi de httpOnly `session_token` cookie (Bearer da desteklenir). Roller: admin / student.
- Frontend: React + Tailwind (dark/luxury tema, Outfit+Satoshi fontları, gold #FFB800 CTA), shadcn/ui, framer-motion, sonner. Context: Auth, Cart, Site.
- Ödeme: PayTR iframe token akışı; anahtarlar Fernet ile şifreli DB'de; callback HMAC doğrulamalı. Ücretsiz/%100 indirim anında kayıt.

## Personas
- Eğitmen/Admin (Kamil Yıldırım): kurs/öğrenci/ödeme/indirim/ayar yönetimi.
- Öğrenci: kurs keşfi, satın alma, ders izleme, ilerleme, sertifika.

## Implemented (2026-08-11)
- Tüm ön yüz sayfaları + 4 sözleşme sayfası (KVKK, gizlilik, üyelik, mesafeli satış)
- Auth: kayıt (sözleşme onayı zorunlu), giriş, Google giriş akışı + callback (sözleşme onayı), oturum
- Kurslar: liste/filtre/arama, detay (müfredat, önizleme kilidi, kazanımlar), sepet, checkout (indirim kodu, PayTR iframe / ücretsiz kayıt), ödeme sonucu
- Öğrenci paneli: eğitimlerim (ilerleme %), ödemelerim, sertifikalarım
- Ders izleyici: müfredat kenar çubuğu, izlendi işaretleme, kaldığı yerden devam, video embed + açıklama + PDF kaynak indirme, tamamlamada otomatik sertifika
- Admin panel: dashboard (istatistik), kurs CRUD + zengin editör (bölüm/ders/kaynak/önizleme/yayın), öğrenciler + manuel kayıt, ödemeler (filtre), indirim kodları CRUD, site ayarları (genel + PayTR + e-posta şablonları)
- E-posta: Resend ile welcome/purchase/completion şablonları (admin'den düzenlenebilir, fire-and-forget)
- 3 demo kurs seed'lendi; admin hesabı seed'lendi
- Test: 26/26 backend + frontend smoke %100 geçti

## Backlog / Remaining
- P0: Kullanıcı gerçek PayTR anahtarlarını girip canlı ödeme testi (mağaza aktif olunca)
- P1: Resend API anahtarı bağlanınca gerçek e-posta teslim testi
- P1: Sertifika PDF indirme + QR doğrulama sayfası (backend verify endpoint hazır)
- P2: Şifre sıfırlama, öğrenci profil düzenleme, kurs yorumları/puanları
- P2: Google OAuth uçtan uca manuel doğrulama

## Test Credentials
Admin: yildirimkamil977@gmail.com / Admin!2026Panel
