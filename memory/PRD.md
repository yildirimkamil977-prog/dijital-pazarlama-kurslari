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

## Iteration 11 (2026-06) — Eğitmen (Instructor) sistemi
- Yeni `instructors` koleksiyonu + admin CRUD (GET/POST/PUT/DELETE /api/admin/instructors): ad, ünvan, biyografi, profil resmi (ImageUpload). Admin panelde "Eğitmenler" menüsü (/yonetim/egitmenler, AdminInstructors.jsx) — kart listesi, ekle/düzenle/sil, her eğitmende bağlı kurs sayısı.
- Kurslara `instructor_id` alanı; Kurs Editörü'nde eğitmen seçim dropdown'ı (course-instructor). Silinen eğitmenin kursları instructor_id='' olarak boşaltılır.
- Public: GET /api/instructors (liste + course_count), GET /api/instructors/{slug} (biyografi + o eğitmenin yayındaki kursları). course_summary artık instructor objesi (name/slug/title/avatar) taşıyor.
- Eğitmen sayfası: /egitmen/:slug (InstructorPage.jsx) — avatar, ad, ünvan, biyografi + eğitmene ait kurs kartları.
- Kurs kartlarında (anasayfa + Kurslar sayfası) eğitmen mini-satırı (avatar + ad/ünvan, eğitmen sayfasına link). Kurs Detay'da açıklama altında zengin eğitmen kartı (link).
- Seed: "Kamil Yıldırım" eğitmeni (slug kamil-yildirim) oluşturuldu ve mevcut 3 kurs ona bağlandı.
- Test: iteration_6.json — backend 4/4 (pytest), frontend 8/8 (admin CRUD, editör atama kalıcılığı, kurs detay/liste/eğitmen sayfası). Ekran görüntüleriyle de doğrulandı.

## Iteration 12 (2026-06) — Şifremi unuttum akışı + e-posta düzeltmeleri
- Şifre sıfırlama (token-tabanlı, integration_expert playbook'una uygun): POST /api/auth/forgot-password (secrets.token_urlsafe(32), sha256 hash'lenip password_resets'e 1 saat TTL ile saklanır, e-posta ifşası yok — her zaman ok döner) + POST /api/auth/reset-password (token doğrulama: geçerli/süresi dolmamış/tek kullanımlık, bcrypt password_hash güncelleme, kullanıcının diğer token'ları geçersizleştirilir). Min şifre 6 karakter.
- Frontend: /giris sayfasında "Şifremi unuttum?" linki; /sifremi-unuttum (ForgotPassword — e-posta formu + "E-postanı kontrol et" onayı) ve /sifre-sifirla?token= (ResetPassword — yeni şifre + tekrar).
- Şık HTML e-posta: password_reset şablonu artık markalı kabuk içinde "Şifremi Sıfırla" butonu + {{reset_url}} + 1 saat uyarısı ile gönderiliyor.
- Hoşgeldin e-postası düzeltildi: DB'deki bozuk "hi {{name}}" içeriği, Türkçe zengin HTML + "Panele Git" butonlu ({{login_url}}) yeni şablonla değiştirildi. server.py'ye welcome + password_reset için force-update migration eklendi.
- Test: backend curl ile uçtan uca doğrulandı (forgot ok, reset ok, yeni şifre login 200, eski 401, token tek kullanımlık 400, kısa şifre 400, bilinmeyen e-posta ifşasız); frontend 3 sayfa ekran görüntüsüyle doğrulandı. Test kullanıcıları temizlendi.

## Iteration 13 (2026-06) — Öğrenci ödenen tutar (bug) + içerik güvenliği
- BUG FIX: Öğrenci panelinde "Eğitimlerim" kartlarında artık öğrencinin o eğitime ödediği tutar görünüyor. Backend /api/my/courses her kayda `paid_amount` ekliyor (source=='free' → 0; aksi halde ilgili sipariş kaleminin fiyatı; sipariş total 0 ise 0). Frontend rozet: 0 ise yeşil "Ücretsiz", aksi halde "X ₺ ödendi" (paid-amount-<course_id>).
- İçerik güvenliği (Ders İzleyici): video alanına giriş yapan öğrencinin e-postasıyla dinamik filigran (büyük çapraz + sağ alt köşe), sağ tık (context menu) ve metin seçimi engellendi. Backend zaten ders video URL'lerini ve kaynakları yalnızca kayıtlı öğrenciye sunuyor (player endpoint kayıtsıza 403). Not: iframe/DevTools ile tam DRM mümkün değil; filigran gündelik hırsızlığı/paylaşımı caydırır, erişim kontrolü asıl korumadır.
- Test: iteration_7.json — backend 4/4 (paid_amount paid=1999 & free=0, player 403/200), frontend %100 (rozet '1.999 ₺ ödendi', filigran e-posta, sağ tık engeli). Test kullanıcıları temizlendi.

## Iteration 14 (2026-06) — Video oynatıcı YouTube Hata 153 fix + Vimeo geçişi
- Kök neden: Demo derslerin YouTube video ID'si (hSHZzC9bhkc) gömülmeye kapalıydı → "Video oynatıcı yapılandırma hatası / Hata 153". Eğitmen tüm videoları Vimeo'dan sunmak istiyor.
- Fix: `frontend/src/lib/video.js` → `toEmbed()` yardımcı fonksiyonu (Vimeo `vimeo.com/{id}`, `vimeo.com/{id}/{hash}`, `player.vimeo.com/*` ve YouTube `watch?v=`, `youtu.be`, `/embed/` linklerini doğru iframe embed'ine çevirir; Vimeo'da dnt=1 + indirme/pip/badge kapalı). CoursePlayer ve CourseDetail önizleme iframe'i bu fonksiyonu kullanıyor. Player iframe'ine referrerPolicy=no-referrer.
- Veri: Tüm demo ders videoları + hero + testimonial videoları çalışan Vimeo örneğine (vimeo.com/76979871) taşındı; server.py seed_default_data ve deps.py varsayılanları da Vimeo yapıldı (fresh DB idempotent). Bozuk test testimonial'ları (Ali/Ayşe) varsayılanlara sıfırlandı.
- A11y: CourseDetail önizleme dialog'una sr-only DialogTitle eklendi.
- Test: iteration_8.json — backend 4/4 (player vimeo URL, non-enrolled 403, hero vimeo, önizleme youtube yok), frontend %100 (lesson-video src = player.vimeo.com, Hata 153 yok, filigran + sağ tık engeli korunuyor). NOT: Seçilen demo Vimeo örneği bu ortamda Vimeo'nun kendi "player error"ını gösterebilir; eğitmen kendi Vimeo videolarını (domain embed izinli) ekleyince sorunsuz oynar. Pipeline doğru.

## Iteration 15 (2026-06) — Bire Bir Danışmanlık (1-on-1 consulting)
- Yeni modül `routes_consulting.py` (+ server.py'ye register). Ayarlar: `settings.consulting {enabled, price, weekly, weeks_ahead=4}`.
- Admin (/yonetim/danismanlik, AdminConsulting.jsx): haftalık tekrar eden müsaitlik (gün + saat aralıkları, ör. Pzt 10:00-13:00 → 1 saatlik dilimler), 1 saatlik ücret ve aktif/pasif. Talepleri Onayla/Reddet/Farklı saat öner (reschedule). Ücretli (Havale) talepleri onayla/reddet.
- Öğrenci (StudentPanel "Bire Bir Danışmanlık" sekmesi, ConsultingPanel.jsx): kullanılabilir hak, 4 hafta ileriye kadar boş slotlar (tarihe göre gruplu), slot seçip talep oluşturma (Beklemede), randevularım listesi, reschedule önerisini Kabul/Ret, "Ücretli Hak Al" (Havale/EFT + banka bilgisi).
- Kredi mantığı: her ücretli kurs (enrollment source!='free') +1 saat; ücretsiz kurslar 0. Ücretli satın alma admin onayında +1. Aktif booking (pending/approved/rescheduled/completed) 1 hak tüketir; red/iptal iade eder. Slot kilitleme: bir slot talep edilince /consulting/slots'tan düşer, başkası aynı date+time'ı alamaz (400).
- Test: iteration_9.json — backend 8/8, frontend %100 (config, kredi, slot üretimi, booking+kilit, kredi zorlaması, admin onay/öner, reschedule kabul, Havale satın alma+onay). Hata yok. NOT: <option> içi hydration console uyarısı (Emergent build instrumentasyonu, kullanıcıya görünmez).

## Iteration 16 (2026-06) — Danışmanlık geliştirmeleri (rozet, öner-modalı, e-posta, takvim, kart)
- Admin nav'da bekleyen danışmanlık talebi sayısı rozeti (GET /admin/consulting/pending-count, 30sn'de bir güncellenir; consulting-nav-badge).
- Randevu Onay/Ret/Öneri işlemlerinde öğrenciye şık HTML e-posta (yeni şablonlar: consulting_approved/rejected/proposed; server.py'ye seed + migration).
- "Farklı Gün ve Saat Öner" artık görünür bir MODAL (tarih + saat + not) — önceki window.prompt yerine; öneri öğrenciye e-postayla iletilir.
- Ücretli danışmanlık artık SADECE kredi kartı (PayTR) ile; Havale seçeneği kaldırıldı. PayTR yapılandırılmadığında 503 (order önce credential kontrolünden sonra oluşturulur — orphan pending yok).
- Öğrenci panelinde randevu seçimi artık şık TAKVİM görünümü (shadcn Calendar; müsait günler altın vurgulu, gün seçince saat çipleri). Mobil (390px) test edildi.
- Ücret sabit (settings.consulting.price, admin belirler).
- Test: iteration_10.json — backend 9/9, frontend %100 (rozet artış/azalış, öner-modalı→rescheduled, e-posta şablonları, takvim+booking, kart 503, mobil, slot kilit regresyonu). Hata yok.

## Iteration 17 (2026-06) — Admin e-posta bildirimleri (tüm süreçler)
- `push_notification` artık her tetiklendiğinde admin'e de şık HTML e-posta gönderiyor (fire-and-forget, `_email_admin_notification`). Alıcı: settings.notify_email || contact_email. "Yönetim Paneline Git" butonlu markalı şablon.
- Kapsanan tüm süreçler (mevcut push_notification çağrıları): yeni öğrenci kaydı, Havale ödeme onayı, Havale bildirimi alındı, eğitim tamamlandı, yeni danışmanlık talebi, danışmanlık kart ödeme talebi.
- PayTR kart callback'ine ödeme başarılı bildirimi eklendi (kurs + danışmanlık ayrımıyla). Danışmanlık siparişlerinde sahte kurs kaydı/purchase e-postası engellendi.
- Doğrulama: backend hatasız yeniden başladı; register akışı push_notification→admin e-posta tetikliyor (traceback yok). E-posta gönderimi mevcut kanıtlı send_email kanalını kullanır (welcome/purchase ile aynı). NOT: gerçek e-posta teslimi otomatik testle assert edilmedi; aynı proven kanal kullanıldığı için güvenli.

## Iteration 18 (2026-06) — Canlı Grup Eğitimleri (Google Meet)
- Yeni modül `routes_group.py` + `group_trainings`/`group_enrollments`/`group_reminders_sent` koleksiyonları. Router server.py'ye eklendi.
- Admin (/yonetim/grup-egitimleri, AdminGroupTrainings.jsx): başlık, açıklama, kapak, tanıtım videosu, fiyat, KONTENJAN, eğitmen, ders takvimi (her ders: gün+saat+Google Meet linki), yayın durumu. CRUD. Kontenjan canlı değiştirilebilir; public sayfada anında yansır.
- Public: Navbar'da "Canlı Grup Eğitimleri"; liste (/canli-grup-egitimleri) + detay (/canli-grup-egitimleri/:slug). Detayda ders takvimi, fiyat, kontenjan, kalan kontenjan; kalan <=10 olunca yanıp sönen ALARM efekti (group-urgency). Tanıtım videosu (toEmbed), müfredat, eğitmen kartı.
- Öğrenci paneli "Canlı Grup Eğitimi" sekmesi (GroupPanel.jsx): kayıtlı eğitimin bilgileri + ders takvimi + admin link girince Google Meet "Katıl" butonları (girilmemişse "Link yakında").
- Ödeme SADECE kredi kartı (PayTR, kind='group'). Callback'te group_enrollment + group_purchase maili (panelde tarih/saat/link uyarısı). PayTR yapılandırılmadığında 503.
- Hatırlatma e-postaları: ders başlamadan 24 saat ve 1 saat önce (POST /api/cron/group-reminders, Bearer WEBHOOK_CRON_SECRET; .emergent/crons.yml */15). Idempotent (group_reminders_sent). Şablonlar: group_purchase, group_reminder (server.py seed).
- Örnek seed: "google-ads-canli-grup-egitimi" (12 kontenjan, 4999₺, 2 ders).
- Test: iteration_11.json — backend 13/13, frontend %100 (liste/detay, kontenjan canlı güncelleme, urgency toggle, 503 kart, panel meet link, kapasite 400, cron 401/200). Fonksiyonel hata yok. İyileştirme: 502'de order token_failed işaretlenir; cron hataları loglanır.

## Test Credentials
Admin: yildirimkamil977@gmail.com / Admin!2026Panel

## Iteration 21 (2026-06) — Ders Kaydı Hazır e-posta bildirimi
- Admin bir derse ilk kez `recording_url` eklediğinde (boş → dolu), o gruba kayıtlı TÜM öğrencilere otomatik "Ders kaydın hazır" e-postası gidiyor. Yeni `group_recording` şablonu (deps.py DEFAULT_TEMPLATES, başlangıçta seed) + `_notify_new_recordings` (routes_group.admin_update).
- Tekrar bildirimi önleme: `group_recording_sent` koleksiyonu (group_id+lesson_id) ve zaten kaydı olan derse tekrar e-posta gönderilmiyor. Lesson id'leri admin formunda korunduğu için güvenilir eşleşme.
- Test (curl + DB): yeni kayıtlı derste bildirim tetiklendi, mevcut kayıtlı derste tetiklenmedi; e-posta API'sine gerçek istek atıldı (202 Accepted). Seed korundu, temp veriler temizlendi.

## Iteration 20 (2026-06) — Grup Ders Kaydı + Liste redesign + Anasayfa canlı bölüm
- Grup Ders Kaydı: LessonIn'e `recording_url`; her derse admin editöründe "Ders kaydı linki" alanı (lesson-recording-<i>). recording_url SADECE kayıtlı öğrenciye (/my/group-trainings) açılır; public detay/liste id/title/date/time dışında hiçbir link vermez. Öğrenci panelinde (GroupPanel) kaydı olan derste "Kaydı İzle" butonu (recording-link-<id>) — canlıyı kaçıranlar için.
- Ortak `GroupCard.jsx` bileşeni (CANLI + Google Meet rozeti, eğitmen mini-satırı, kontenjan progress bar, fiyat/İncele). GroupList.jsx premium yeniden tasarlandı (gradient hero + özellik çipleri + kart grid).
- Anasayfa: hero'ya "CANLI · Canlı Grup Eğitimleri başladı" pill (hero-group-cta) + üçüncü güven maddesi; kurslar altına yeni "Canlı Grup Eğitimleri" bölümü (home-group-section, home-all-groups, en fazla 3 GroupCard).
- Test: iteration_13.json — backend 5/5 (recording görünürlük kuralları + kalıcılık), frontend %100 (admin kayıt alanı, öğrenci "Kaydı İzle", anasayfa pill+bölüm, liste redesign). Hata yok.

## Iteration 19 (2026-06) — Grup Eğitimi detay premium redesign + eğitmen sosyal medya
- GroupDetail.jsx tamamen yeniden tasarlandı (premium): CANLI YAYIN rozeti + Google Meet logolu badge, breadcrumb, hero meta çipleri; sol kolonda tanıtım videosu, Google Meet şeridi, "Eğitim Hakkında", "Neler Öğreneceksin" (what_you_learn grid), "Canlı Ders Programı" (takvim + Canlı çipleri), "Gereksinimler", zengin eğitmen kartı (bio + sosyal ikonlar), 9:16 video öğrenci yorumları; sağda sticky sidebar (fiyat, kontenjan, kalan yer, kontenjan progress bar, urgency alarmı, **"Eğitime Kaydol"** butonu, güven rozetleri). Mobil sticky alt bar. SEO meta + JSON-LD Course schema.
- Eğitmen sosyal medya linkleri: InstructorIn'e `social_links: dict`; AdminInstructors formuna 7 alan (instagram/linkedin/youtube/twitter/facebook/tiktok/website — sadece dolu olanlar görünür). Yeni paylaşılan `SocialLinks.jsx` bileşeni (lucide ikonlar + tiktok inline SVG).
- Public API'lerde social_links: routes_courses.instructor_card, routes_group._instructors; get_group artık genel testimonials'ı `reviews` olarak döndürüyor.
- CourseDetail eğitmen kartı yeniden yapılandırıldı (iç içe <a> kaldırıldı) + SocialLinks ikonları eklendi.
- Seed zenginleştirildi: grup eğitimine what_you_learn(6)+requirements(3); kamil-yildirim eğitmenine social_links (instagram/linkedin/youtube/website).
- Test: iteration_12.json — backend 5/5 (+13/13 mevcut), frontend %100 (tüm bölümler, mobil bar, admin sosyal alan kalıcılığı, 503 kart toast). Fonksiyonel hata yok.

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

