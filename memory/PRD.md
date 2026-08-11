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

## Iteration 2 (2026-08-11) — Büyük tasarım & özellik yükseltmesi
- Önyüz yeniden tasarım: video odaklı hero (oynat modalı), modern kazanımlar, çıktı istatistikleri, marka marquee, video öğrenci yorumları bölümü, duyuru çubuğu
- Kişiselleştirilmiş anasayfa: giriş yapan kullanıcı "Öğrenmeye Devam Et" görür, "Üye Ol" CTA gizlenir
- Kurs detay: renkli gradient hero, yıldız, ücretsiz önizleme oynatma (BUG FIX), zengin müfredat
- Sepet/Ödeme: header+footer eklendi, cross-sell kampanya önerileri (admin'den kurs bazında + Ayarlar'dan indirim %), WhatsApp CTA kartları; indirim detayı (% + tutar + kod) gösterimi (BUG FIX)
- Öğrenci paneli yeniden tasarım: gradient hero başlık, istatistikler, fatura sütunu ("Fatura bekleniyor" → indirilebilir fatura), Hesap Ayarları
- Öğrenci ayarları: profil düzenleme + şifre değiştirme
- Fatura akışı: admin ödemeye PDF fatura yükler (base64, orders'ta), öğrenci indirir; invoice_ready e-postası
- Admin dashboard: 14 günlük gelir grafiği (recharts), en popüler eğitimler, zengin kartlar
- Kurs editörü: 100+ ders için katlanabilir bölüm/dersler, detaylı ders notu alanı, ders kopyalama, cross-sell seçimi
- Admin ayarları sekmeleri: Genel, Kampanya (duyuru/paket %/WhatsApp), PayTR, Takip Kodları (GA/Meta Pixel/Google Ads/özel head+body — otomatik enjekte), Yorumlar (testimonials), E-posta (6 şablon)
- E-posta şablonları: welcome, purchase, completion + payment_failed, invoice_ready, password_reset, profile_updated
- Test: 42/42 backend geçti, frontend akışları %100

## Kalan / Backlog (güncel)
- P0: Gerçek PayTR anahtarları ile canlı ödeme testi (mağaza aktif olunca)
- P1: Resend API anahtarı ile gerçek e-posta teslim testi
- P1: Sertifika PDF indirme + QR doğrulama sayfası
- P2: Şifre sıfırlama (self-service), kurs yorum/puanlama, ders sürükle-bırak sıralama

## Iteration 3 (2026-06) — Fork devam: DnD + Havale oranı + bug fix
- BUG FIX (kritik): Cart.jsx tanımsız değişkenler (originalTotal/savings/savingsPct) + dosya sonu bozuk JSX → frontend derlenmiyordu. Yeniden yazıldı, artık derleniyor.
- BUG FIX: Havale/EFT indirim oranı sepette/ödemede %0 görünüyordu. Kök neden: admin genel ayar kaydı transfer_discount_pct'yi varsayılan 0 ile eziyordu. Çözüm: backend update_general artık body.model_dump(exclude_unset=True) kullanıyor; panelde Ayarlar>Kampanya'ya "Havale/EFT İndirim Oranı (%)" alanı (setting-transfer-pct) eklendi.
- Promo bar (duyuru çubuğu) mobilde kayan yazı (marquee) — iki özdeş grup + animate-marquee -50%, overflow-hidden; metin artık kesilmiyor, akıcı kayıyor.
- Admin Kurs Editörü: bölüm ve ders sürükle-bırak sıralama (@hello-pangea/dnd). Tutamaçlar: module-drag-<mi>, lesson-drag-<mi>-<li>. Dersler bölümler arası taşınabilir.
- Kurs toplam süresi: zaten course_summary'de ders sürelerinin toplamı olarak otomatik hesaplanıp Kurslar/Kurs Detay'da gösteriliyor (total_seconds).
- Test: backend 3/3 yeni + 42/42 mevcut geçti; frontend cart/checkout(guest+transfer)/admin kampanya/kurs editörü DnD %100 (iteration_3.json).

## Iteration 4 (2026-06) — Havale onay akışı + bildirim sayfası
- Havale/EFT bildirim sayfası: /havale-bildirimi (public, misafir de kullanabilir). Sipariş no ile sorgulama, gönderen/tutar/tarih/not formu → POST /api/payments/transfer-notification.
- Havale bilgi e-postasına "Havale/EFT Bildirimi Yap" butonu eklendi ({{notify_url}} → /havale-bildirimi?oid=). Ödeme sonucu (transferInfo) ekranına da "Ödememi Bildir" butonu eklendi.
- Bildirim yapıldığında yöneticiye e-posta (transfer_notified_admin şablonu) gider.
- Admin Ödemeler: "Havale" filtresi (awaiting_transfer), her siparişte "Onayla" butonu (mark-paid → öğrenci kaydı + purchase e-postası) ve "Havale bildirimi alındı" rozeti (gönderen/tutar/tarih/not).
- Yeni backend: GET /api/payments/transfer-order/{id} (public özet), POST /api/payments/transfer-notification. server.py seed: bank_transfer şablonu migration + transfer_notified_admin şablonu.
- Test: backend uçtan uca curl ile doğrulandı (checkout→awaiting_transfer→bildirim→admin onay→paid); frontend bildirim sayfası ve admin havale filtresi/onay UI ekran görüntüsüyle doğrulandı.

## Test Credentials
Admin: yildirimkamil977@gmail.com / Admin!2026Panel
