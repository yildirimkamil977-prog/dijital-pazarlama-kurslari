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

## Iteration 5 (2026-06) — Kapsamlı UI/UX + fonksiyon güncellemeleri
- Yapışkan header artık ekranın en üstüne sabit (promo bar + navbar tek fixed top-0 konteyner; PublicLayout + Navbar refactor). Aşağı kaydırınca boşluk oluşmuyor.
- Hero "öğrenci" etiketindeki pill/çizgi kaldırıldı (Home.jsx).
- Anasayfada kayan marka YAZILARI yerine kayan marka LOGOLARI (cdn.simpleicons.org: googleads, meta, tiktok, analytics, semrush, ahrefs vb.).
- Görsel yükleme: yeni ImageUpload bileşeni + backend POST /api/admin/upload-image (admin, 5MB, base64→Mongo) ve public GET /api/uploads/{id}. Kullanım: CourseEditor kapak, AdminSettings hero kapak + testimonial kapak. Artık URL yapıştırmak yerine bilgisayardan yükleniyor.
- Kurslarda kategori ve seviye bilgileri kaldırıldı (Courses.jsx, CourseDetail.jsx, CourseEditor.jsx).
- İndirim hesabı/gösterimi: Sepet ve Ödeme özetinde indirimler ayrı ayrı (Liste Fiyatı, ürün bazlı indirim / Kampanya İndirimi, Toplam) — yanıltıcı blended yüzde kaldırıldı. Cross-sell ekleme tam fiyatı original_price olarak kaydediyor.
- WhatsApp CTA yeniden tasarlandı (WhatsAppCTA bileşeni: yeşil avatar + Çevrimiçi göstergesi); Sepet ve Ödeme'de kullanılıyor, taşma sorunu giderildi.
- Havale/EFT indirim oranı 0 ise ödeme adımında '%X indirim' etiketi gizleniyor (transferPct>0 guard).
- Fatura bilgileri yeniden tasarlandı: İl (81 il dropdown) + İlçe (ile bağlı dependent dropdown, src/data/trCities.js), ülke sorulmuyor; backend Billing modeline city/district eklendi.
- Test: iteration_4.json — backend 100% (upload-image, city/district checkout), frontend 100% (sticky header, logo marquee, kategori/seviye kaldırma, İl/İlçe, WhatsApp CTA, itemized indirim). Ekran görüntüleriyle de doğrulandı.

## Iteration 6 (2026-06) — Faz 1: görünür hatalar + hızlı kazanımlar
- overline (üstü çizgili) yazı sorunu tüm sitede giderildi: Tailwind'in yerleşik `overline` (text-decoration) sınıfı ile çakışan `.overline` utility'sine `text-decoration:none` eklendi (12345 Öğrenci, KEŞFET, YASAL, DESTEK HATTI vb. hepsi düzeldi).
- Sayfa geçişlerinde en üste kaydırma: ScrollToTop bileşeni App.js'e eklendi.
- Kayan marka logoları artık RENKLİ (cdn.simpleicons.org marka renkleri); kırık ahrefs/canva kaldırıldı, geçerli logolarla değiştirildi.
- Üst duyuru çubuğu: panelden birden fazla duyuru (her satır ayrı duyuru — Textarea) ve daha yavaş akış (animate-marquee-slow 60s).
- Hero tanıtım videosu: YouTube/Vimeo watch linkleri otomatik embed'e çevriliyor (toEmbed) — panelden hero_video_url ile yönetiliyor.
- Panellerdeki İngilizce ifadeler düzeltildi: StudentPanel ve AdminDashboard'da 'awaiting_transfer' → 'Havale Bekleniyor/Bekliyor'.
- Admin Ödemeler: artık sadece gerçek ödeme yapanlar görünüyor (status paid + awaiting_transfer); terk edilen 'pending' siparişler gizlendi. Öğrenci panelinde de aynı filtre.
- Ödeme sonrası hesap: guest kayıtta 'password_reset' yerine yeni 'account_created' e-postası (doğru başlık/içerik + geçici şifre) gönderiliyor; Havale sonuç ekranında 'Hesabın oluşturuldu, şifren e-postana gönderildi' pop-up'ı gösteriliyor (account_created bayrağı).
- Test: derleme temiz; backend curl ile account_created=True ve payments filtresi (sadece paid/awaiting_transfer) doğrulandı; anasayfa görselleri (overline yok, renkli logolar, çoklu duyuru) ekran görüntüsüyle doğrulandı.

### KALAN FAZLAR (kullanıcı isteği, önceliklendirilecek)
- Faz 2: E-posta şablonlarının şık HTML tasarıma çevrilmesi (logo + iletişim + footer).
- Faz 3: Yorumlar revizyonu (panelde kurs eşleştirme, kurs detayda o kursun yorumları, anasayfada karışık, 4'lü yan yana + 4'ten fazlaysa yavaş kayan slider).
- Faz 4: Kurs detay sayfası zenginleştirme (ikna edici CTA + içerik alanları).
- Faz 5: SEO — kurs bazlı + global title/description/keywords panelden yönetimi + document head.
- Faz 6: Schema markup (JSON-LD): Organization, Course, FAQ, Breadcrumb.
- Faz 7: sitemap.xml, robots.txt, llms.txt + panel ayarlarında linkler/bilgiler.
- Faz 8: Meta & Google Ads dönüşüm ölçümleme (üye ol, sepete ekle, satın al event'leri) + panelde ilgili ID alanları.
- Faz 9: Anasayfaya video/görsel açıdan zengin, satışa ikna eden yeni alanlar.

## Iteration 7 (2026-06) — Kalan tüm fazlar tamamlandı
- E-posta: Tüm şablonlar artık markalı HTML kabuğuna (render_email_shell: logo başlık + iletişim footer) sarılıyor.
- Yorumlar: Panelde her yoruma "İlgili Eğitim" seçimi (course_id); kurs detayında o kursun yorumları (yoksa genel), anasayfada karışık (shuffle) 4'lü; 4'ten fazlaysa 5sn'de bir yavaş dönen slider. Kapak görselleri bilgisayardan yüklenebiliyor.
- Kurs detay: JSON-LD (Course + BreadcrumbList), SEO meta (title/description/keywords), öğrenci yorumları bölümü ve alt ikna edici CTA bandı eklendi.
- SEO: CourseEditor'a kurs bazlı meta_title/description/keywords; AdminSettings'e "SEO" sekmesi (global meta + OG görsel upload) ve SEO dosya linkleri. Seo bileşeni document.title/meta/OG/canonical + JSON-LD yönetiyor.
- Schema: Anasayfa Organization + WebSite + FAQPage; kurs detay Course + Breadcrumb JSON-LD.
- Dosyalar: GET /api/seo/sitemap.xml (dinamik, yayındaki kursları içerir), public/robots.txt, public/llms.txt; panelde linkleri.
- Dönüşüm ölçümleme: lib/track.js — AddToCart (CartContext), InitiateCheckout & Purchase (Checkout/PaymentResult), CompleteRegistration/sign_up (Register + guest checkout). Meta Pixel + GA4 + Google Ads conversion (panelde google_ads_purchase_label alanı, window.__SITE_TRACKING__).
- Test: backend curl (sitemap, settings seo/tracking, kurs reviews=2, seo) ve ekran görüntüleri (anasayfa çoklu duyuru + renkli logolar + hero video; kurs detay Course JSON-LD + reviews + CTA) ile doğrulandı. Derleme temiz.
- Kısmen: Anasayfaya ek "video/görsel zengin satış alanları" — mevcut hero video, istatistik, marka logoları, yorum slider, FAQ ve CTA güçlendirildi; istenirse ayrı zengin bölümler eklenebilir.

## Iteration 8 (2026-06) — Sepet/indirim düzeltmeleri + per-kurs kod + dikey video yorumlar
- İndirim kodları artık belirli kurslara özel olabiliyor: DiscountIn.course_ids; _apply_discount indirimi yalnızca eşleşen kursların tutarına uyguluyor (curl: 999 üzerinden %50 = 499,5; uygun olmayan sepette hata). AdminDiscounts diyalogunda kurs seçim listesi + kartta "N eğitime özel" rozeti.
- Sepet & Ödeme: sağdaki özet ile alttaki WhatsApp CTA çakışması giderildi (özet + CTA tek sticky konteynerde).
- Sepette indirimli eğitim dikkat çekici: yeşil "İNDİRİMLİ · %X" rozeti, "X ₺ tasarruf" ve yeşil çerçeve; özet ürün bazlı indirim + Toplam İndirim.
- Yorumlar dikey videoya uygun: anasayfa testimonial kartları 9:16; kurs detay yorumları 4'lü grid, videolu (9:16 iframe) veya dikey görsel.
- checkout ve validate-discount artık items (course_id/price) gönderiyor/işliyor.
- Kısmen: anasayfa/kurs detay için ek büyük animasyonlu satış bölümleri — mevcut zengin alanlar (hero video, istatistik, logolar, dikey video yorum slider, FAQ, CTA) korunur; istenirse yeni bölümler eklenebilir.

## Iteration 10 (2026-06) — Mobil sticky CTA + "Kayıt Ol" + Ücretsiz eğitim akışı
- Kurs Detay mobilde ekranda sabit alt bar (lg:hidden, fixed bottom): fiyat + üstü çizili liste fiyatı + indirim rozeti + kayıt butonu (data-testid mobile-buy-bar / mobile-enroll-btn / mobile-price). Sayfaya pb-24 lg:pb-0 eklendi.
- Tüm "Satın Al" butonları "Kayıt Ol" olarak değiştirildi (Kurs Detay sticky kart "Hemen Kayıt Ol", alt CTA "Hemen Kayıt Ol · fiyat", mobil bar "Kayıt Ol").
- Ücretsiz eğitim: fiyat 0 ise sepet/ödeme yerine "Ücretsiz Kayıt Ol" butonu. Giriş yapmış kullanıcı → doğrudan POST /payments/checkout (total 0 → status:free) → anında kayıt + /panel/izle/:courseId'ye yönlendirme. Misafir → /odeme (ücretsiz akış anında kaydeder). Backend zaten total<=0 için _enroll_free ile anında kayıt yapıyor.
- Test: mobil (414px) ücretsiz kurs barı "Ücretsiz Kayıt Ol"/"Ücretsiz" ve ödeme kursu barı "Kayıt Ol"/"1.799₺"/"%10 indirim" ekran görüntüsüyle doğrulandı; misafir ücretsiz checkout curl ile status:free doğrulandı (test verisi temizlendi).

## Test Credentials
Admin: yildirimkamil977@gmail.com / Admin!2026Panel

## Iteration 9 (2026-06) — Fork: Ödeme analitiği + zengin satış bölümleri + hero fix
- Admin Ödemeler yeniden yapılandırıldı: 4 analitik kartı (Toplam Gelir, Ödenen Sipariş, Ortalama Sepet, Havale Bekleyen tutar+adet), günlük gelir alan grafiği (recharts), öğrenci adı/e-posta/sipariş no ile arama (400ms debounce), tarih aralığı (start/end) + hızlı presetler (Son 7/30 gün, Bu Ay, Tümü) ve durum filtreleri. Backend GET /api/admin/payments artık start_date/end_date/search query paramlarını destekliyor (sunucu tarafı filtre).
- Anasayfa: yeni ROADMAP bölümü (4 animasyonlu adım) ve VALUE STACK + garanti bandı (pakete dahil listesi + güven kartı + CTA). Bölüm etiketlerinde ikon çeşitliliği (Zap, GraduationCap, Compass, Quote, MessageCircle, Gift vb.) — tek tip yıldız şikayeti giderildi.
- Kurs Detay: alt CTA öncesi zengin ikna bandı (3 animasyonlu özellik kartı + güven rozetleri).
- Hero "Tanıtımı İzle" bug fix: settings dokümanında eksik olan hero_video_url/hero_poster migration ile dolduruldu (varsayılan gömülebilir video). Buton artık video dialog'unu açıyor; admin panelden yönetilebilir.
- Test: iteration_5.json — frontend %100 (6/6 akış: analitik kartları, arama debounce, tarih presetleri, durum filtreleri, home roadmap/valuestack, hero video dialog, kurs detay ikna bandı). Backend filtreleri curl ile doğrulandı.

### KALAN / Backlog
- P1: "Ücretsiz eğitim" yayınlama & anında kayıt UX akışı (checkout'ta %100 indirim/ücretsiz anında kayıt mevcut; net "Ücretsiz Kayıt Ol" buton akışı eklenebilir)
- P1: Gerçek PayTR anahtarları ile canlı ödeme testi (mağaza aktif olunca)
- P2: Video Dialog'lara DialogDescription (Radix a11y uyarısı), Meta Pixel null guard, /api/auth/me 401 gürültüsü (opsiyonel)

