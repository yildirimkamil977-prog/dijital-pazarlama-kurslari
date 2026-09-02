import { useEffect, useState } from "react";
import { Loader2, Save, CreditCard, Mail, Globe, ShieldCheck, AlertTriangle, Info, Code, Star, Plus, Trash2, Megaphone, FileText } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";

const gKeys = ["site_name", "tagline", "contact_email", "support_phone", "hero_title", "hero_subtitle", "about_text", "students_count", "email_enabled", "hero_video_url", "hero_poster", "whatsapp_number", "whatsapp_message", "bundle_discount_pct", "transfer_discount_pct", "promo_enabled", "promo_text"];
const numKeys = ["bundle_discount_pct", "transfer_discount_pct"];

export default function AdminSettings() {
  const [s, setS] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [paytr, setPaytr] = useState({ merchant_id: "", merchant_key: "", merchant_salt: "", notification_url: "", test_mode: true });
  const [tracking, setTracking] = useState({ head_code: "", body_code: "", ga_id: "", meta_pixel_id: "", google_ads_id: "", google_ads_purchase_label: "" });
  const [seo, setSeo] = useState({ meta_title: "", meta_description: "", meta_keywords: "", og_image: "" });
  const [courses, setCourses] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [legal, setLegal] = useState([]);
  const [busy, setBusy] = useState("");
  const BACKEND = process.env.REACT_APP_BACKEND_URL;
  const callbackUrl = `${process.env.REACT_APP_BACKEND_URL}/api/payments/paytr/callback`;

  const loadSettings = () => api.get("/admin/settings").then(({ data }) => {
    setS(data);
    setPaytr({ merchant_id: data.paytr.merchant_id || "", merchant_key: "", merchant_salt: "", notification_url: data.paytr.notification_url || callbackUrl, test_mode: data.paytr.test_mode });
    setTracking(data.tracking || tracking);
    setSeo(data.seo || { meta_title: "", meta_description: "", meta_keywords: "", og_image: "" });
    setTestimonials(data.testimonials || []);
    setLegal(data.legal_documents || []);
    api.get("/courses").then((r) => setCourses(r.data)).catch(() => {});
  });

  useEffect(() => { document.title = "Yönetim - Ayarlar"; loadSettings(); api.get("/admin/email-templates").then(({ data }) => setTemplates(data)); /* eslint-disable-next-line */ }, []);

  const g = (v) => setS({ ...s, ...v });
  const generalPayload = () => Object.fromEntries(gKeys.map((k) => [k, numKeys.includes(k) ? Number(s[k]) || 0 : s[k]]));

  const saveGeneral = async () => { setBusy("g"); try { await api.put("/admin/settings/general", generalPayload()); toast.success("Ayarlar kaydedildi"); } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); } };

  const savePaytr = async () => {
    setBusy("p");
    try {
      const payload = { merchant_id: paytr.merchant_id, notification_url: paytr.notification_url, test_mode: paytr.test_mode };
      if (paytr.merchant_key) payload.merchant_key = paytr.merchant_key;
      if (paytr.merchant_salt) payload.merchant_salt = paytr.merchant_salt;
      const { data } = await api.put("/admin/settings/paytr", payload);
      toast.success(data.configured ? "PayTR aktif" : "Kaydedildi (eksik bilgi: pasif)");
      loadSettings(); setPaytr((p) => ({ ...p, merchant_key: "", merchant_salt: "" }));
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); }
  };

  const saveTracking = async () => { setBusy("t"); try { await api.put("/admin/settings/tracking", tracking); toast.success("Takip kodları kaydedildi"); } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); } };
  const saveSeo = async () => { setBusy("seo"); try { await api.put("/admin/settings/seo", seo); toast.success("SEO ayarları kaydedildi"); } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); } };
  const saveTestimonials = async () => { setBusy("tt"); try { await api.put("/admin/settings/testimonials", testimonials); toast.success("Yorumlar kaydedildi"); } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); } };
  const saveLegal = async () => { setBusy("lg"); try { await api.put("/admin/settings/legal", legal); toast.success("Sözleşmeler kaydedildi"); } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); } };
  const saveTemplate = async (tpl) => { try { await api.put(`/admin/email-templates/${tpl.key}`, { subject: tpl.subject, html: tpl.html, enabled: tpl.enabled }); toast.success("Şablon kaydedildi"); } catch (e) { toast.error(apiError(e)); } };

  if (!s) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  const inputCls = "bg-ink border-white/10 mt-1.5";

  return (
    <div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter mb-8">Site Ayarları</h1>
      <Tabs defaultValue="general">
        <TabsList className="bg-ink-surface border border-white/5 flex-wrap h-auto">
          <TabsTrigger value="general" data-testid="settings-tab-general"><Globe className="w-4 h-4 mr-2" /> Genel</TabsTrigger>
          <TabsTrigger value="campaign" data-testid="settings-tab-campaign"><Megaphone className="w-4 h-4 mr-2" /> Kampanya</TabsTrigger>
          <TabsTrigger value="paytr" data-testid="settings-tab-paytr"><CreditCard className="w-4 h-4 mr-2" /> PayTR</TabsTrigger>
          <TabsTrigger value="tracking" data-testid="settings-tab-tracking"><Code className="w-4 h-4 mr-2" /> Takip Kodları</TabsTrigger>
          <TabsTrigger value="seo" data-testid="settings-tab-seo"><Globe className="w-4 h-4 mr-2" /> SEO</TabsTrigger>
          <TabsTrigger value="testimonials" data-testid="settings-tab-testimonials"><Star className="w-4 h-4 mr-2" /> Yorumlar</TabsTrigger>
          <TabsTrigger value="legal" data-testid="settings-tab-legal"><FileText className="w-4 h-4 mr-2" /> Sözleşmeler</TabsTrigger>
          <TabsTrigger value="email" data-testid="settings-tab-email"><Mail className="w-4 h-4 mr-2" /> E-posta</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Site Bilgileri</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Site Adı</Label><Input value={s.site_name || ""} onChange={(e) => g({ site_name: e.target.value })} className={inputCls} data-testid="setting-site-name" /></div>
              <div><Label>Slogan</Label><Input value={s.tagline || ""} onChange={(e) => g({ tagline: e.target.value })} className={inputCls} /></div>
              <div><Label>İletişim E-postası</Label><Input value={s.contact_email || ""} onChange={(e) => g({ contact_email: e.target.value })} className={inputCls} /></div>
              <div><Label>Destek Telefonu</Label><Input value={s.support_phone || ""} onChange={(e) => g({ support_phone: e.target.value })} className={inputCls} /></div>
              <div><Label>Öğrenci Sayısı (gösterim)</Label><Input value={s.students_count || ""} onChange={(e) => g({ students_count: e.target.value })} className={inputCls} /></div>
            </div>
          </section>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Anasayfa (Hero) & Hakkımda</h2>
            <div><Label>Hero Başlık</Label><Input value={s.hero_title || ""} onChange={(e) => g({ hero_title: e.target.value })} className={inputCls} /></div>
            <div><Label>Hero Alt Metin</Label><Textarea value={s.hero_subtitle || ""} onChange={(e) => g({ hero_subtitle: e.target.value })} className={inputCls} rows={3} /></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Hero Video (embed linki)</Label><Input value={s.hero_video_url || ""} onChange={(e) => g({ hero_video_url: e.target.value })} className={inputCls} placeholder="https://www.youtube.com/embed/..." data-testid="setting-hero-video" /></div>
              <div><Label>Hero Kapak Görseli</Label><div className="mt-1.5"><ImageUpload value={s.hero_poster || ""} onChange={(v) => g({ hero_poster: v })} testId="hero-poster-upload" /></div></div>
            </div>
            <div><Label>Hakkımda Metni</Label><Textarea value={s.about_text || ""} onChange={(e) => g({ about_text: e.target.value })} className={inputCls} rows={4} /></div>
          </section>
          <Button onClick={saveGeneral} disabled={busy === "g"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-general">{busy === "g" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
        </TabsContent>

        {/* CAMPAIGN */}
        <TabsContent value="campaign" className="mt-6 space-y-6">
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Duyuru Çubuğu</h2>
            <div className="flex items-center justify-between"><div><Label>Üst Duyuru Çubuğu</Label><p className="text-xs text-muted-foreground">Sitenin en üstünde gösterilir</p></div>
              <Switch checked={s.promo_enabled} onCheckedChange={(v) => g({ promo_enabled: v })} data-testid="setting-promo-enabled" /></div>
            <div><Label>Duyuru Metinleri</Label><Textarea value={s.promo_text || ""} onChange={(e) => g({ promo_text: e.target.value })} className={inputCls} rows={4} placeholder={"Her satıra bir duyuru yazın...\nÖrn: Yıl sonuna özel indirim!\nÖrn: Ücretsiz danışmanlık fırsatı"} data-testid="setting-promo-text" /><p className="text-xs text-muted-foreground mt-1">Her satır ayrı bir duyuru olarak üst çubukta sırayla kayar.</p></div>
          </section>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Sepet Kampanyası (Cross-sell)</h2>
            <p className="text-sm text-muted-foreground">Öğrenci sepetteyken, kurslara tanımladığın "Birlikte Önerilen Eğitimler" bu indirim oranıyla teklif edilir.</p>
            <div className="max-w-xs"><Label>Paket İndirim Oranı (%)</Label><Input type="number" value={s.bundle_discount_pct ?? 0} onChange={(e) => g({ bundle_discount_pct: e.target.value })} className={inputCls} data-testid="setting-bundle-pct" /></div>
          </section>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Havale / EFT İndirimi</h2>
            <p className="text-sm text-muted-foreground">Müşteri ödeme adımında Havale/EFT seçtiğinde uygulanacak indirim oranı. Sepet ve ödeme özetinde otomatik gösterilir.</p>
            <div className="max-w-xs"><Label>Havale/EFT İndirim Oranı (%)</Label><Input type="number" value={s.transfer_discount_pct ?? 0} onChange={(e) => g({ transfer_discount_pct: e.target.value })} className={inputCls} data-testid="setting-transfer-pct" /></div>
          </section>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">WhatsApp Destek</h2>
            <p className="text-sm text-muted-foreground">Numara girilince site genelinde ve sepet/ödeme sayfalarında WhatsApp butonu görünür.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>WhatsApp Numarası</Label><Input value={s.whatsapp_number || ""} onChange={(e) => g({ whatsapp_number: e.target.value })} className={inputCls} placeholder="905XXXXXXXXX" data-testid="setting-whatsapp" /></div>
              <div><Label>Varsayılan Mesaj</Label><Input value={s.whatsapp_message || ""} onChange={(e) => g({ whatsapp_message: e.target.value })} className={inputCls} /></div>
            </div>
          </section>
          <Button onClick={saveGeneral} disabled={busy === "g"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-campaign">{busy === "g" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
        </TabsContent>

        {/* PAYTR */}
        <TabsContent value="paytr" className="mt-6 space-y-6">
          <div className="flex items-center gap-3">
            {s.paytr.configured ? <Badge className="bg-green-500/15 text-green-400 border-green-500/20"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Aktif</Badge> : <Badge className="bg-gold/15 text-gold border-gold/20"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Yapılandırılmadı</Badge>}
            <Badge className="bg-secondary">{s.paytr.test_mode ? "Test Modu" : "Canlı Mod"}</Badge>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>PayTR Mağaza Paneli → Bilgi sayfasından Mağaza No, API Anahtarı ve Gizli Anahtarı alın. Bildirim URL'sini PayTR panelinize aşağıdaki adres olarak tanımlayın. Mağazanız aktif olunca bu bilgileri girip kaydedin.</p>
          </div>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <div><Label>Mağaza No (Merchant ID)</Label><Input value={paytr.merchant_id} onChange={(e) => setPaytr({ ...paytr, merchant_id: e.target.value })} className={inputCls} data-testid="paytr-merchant-id" /></div>
            <div><Label>API Anahtarı (Merchant Key) {s.paytr.has_key && <span className="text-xs text-green-400">· kayıtlı</span>}</Label><Input type="password" value={paytr.merchant_key} onChange={(e) => setPaytr({ ...paytr, merchant_key: e.target.value })} className={inputCls} placeholder={s.paytr.has_key ? "•••••• (değiştirmek için yaz)" : "Merchant Key"} data-testid="paytr-merchant-key" /></div>
            <div><Label>Gizli Anahtar (Merchant Salt) {s.paytr.has_salt && <span className="text-xs text-green-400">· kayıtlı</span>}</Label><Input type="password" value={paytr.merchant_salt} onChange={(e) => setPaytr({ ...paytr, merchant_salt: e.target.value })} className={inputCls} placeholder={s.paytr.has_salt ? "•••••• (değiştirmek için yaz)" : "Merchant Salt"} data-testid="paytr-merchant-salt" /></div>
            <div><Label>Bildirim URL'si</Label><Input value={paytr.notification_url} onChange={(e) => setPaytr({ ...paytr, notification_url: e.target.value })} className={inputCls} data-testid="paytr-notification-url" />
              <button type="button" onClick={() => { navigator.clipboard?.writeText(callbackUrl); setPaytr({ ...paytr, notification_url: callbackUrl }); toast.success("Kopyalandı"); }} className="text-xs text-gold mt-2 hover:underline break-all">Önerilen adresi kullan: {callbackUrl}</button></div>
            <div className="flex items-center justify-between pt-2"><div><Label>Test Modu</Label><p className="text-xs text-muted-foreground">Gerçek ödeme almadan test etmek için açık bırakın</p></div>
              <Switch checked={paytr.test_mode} onCheckedChange={(v) => setPaytr({ ...paytr, test_mode: v })} data-testid="paytr-test-mode" /></div>
          </section>
          <Button onClick={savePaytr} disabled={busy === "p"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-paytr">{busy === "p" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> PayTR Ayarlarını Kaydet</>}</Button>
        </TabsContent>

        {/* TRACKING */}
        <TabsContent value="tracking" className="mt-6 space-y-6">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /><p>Dönüşüm takibi ve reklam optimizasyonu için ölçüm kodlarını buraya ekle. ID'ler otomatik entegre edilir; özel kodlar &lt;head&gt; ve &lt;body&gt; alanlarına eklenir.</p>
          </div>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div><Label>Google Analytics ID</Label><Input value={tracking.ga_id} onChange={(e) => setTracking({ ...tracking, ga_id: e.target.value })} className={inputCls} placeholder="G-XXXXXXX" data-testid="tracking-ga" /></div>
              <div><Label>Meta Pixel ID</Label><Input value={tracking.meta_pixel_id} onChange={(e) => setTracking({ ...tracking, meta_pixel_id: e.target.value })} className={inputCls} placeholder="1234567890" data-testid="tracking-meta" /></div>
              <div><Label>Google Ads ID</Label><Input value={tracking.google_ads_id} onChange={(e) => setTracking({ ...tracking, google_ads_id: e.target.value })} className={inputCls} placeholder="AW-XXXXXXX" data-testid="tracking-gads" /></div>
              <div><Label>Google Ads Dönüşüm Etiketi (Satın Alma)</Label><Input value={tracking.google_ads_purchase_label || ""} onChange={(e) => setTracking({ ...tracking, google_ads_purchase_label: e.target.value })} className={inputCls} placeholder="AbC-D_efGh" data-testid="tracking-gads-label" /></div>
            </div>
            <div><Label>Özel &lt;head&gt; Kodu</Label><Textarea value={tracking.head_code} onChange={(e) => setTracking({ ...tracking, head_code: e.target.value })} className={`${inputCls} font-mono text-xs`} rows={4} placeholder="<script>...</script>" data-testid="tracking-head" /></div>
            <div><Label>Özel &lt;body&gt; Kodu</Label><Textarea value={tracking.body_code} onChange={(e) => setTracking({ ...tracking, body_code: e.target.value })} className={`${inputCls} font-mono text-xs`} rows={4} placeholder="<noscript>...</noscript>" /></div>
          </section>
          <Button onClick={saveTracking} disabled={busy === "t"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-tracking">{busy === "t" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="mt-6 space-y-6">
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Genel SEO</h2>
            <p className="text-sm text-muted-foreground">Ana sayfa ve site geneli varsayılan başlık/açıklama. Kurslar kendi SEO alanlarını kullanır.</p>
            <div><Label>Meta Başlık (Title)</Label><Input value={seo.meta_title} onChange={(e) => setSeo({ ...seo, meta_title: e.target.value })} className={inputCls} data-testid="seo-title" /></div>
            <div><Label>Meta Açıklama (Description)</Label><Textarea value={seo.meta_description} onChange={(e) => setSeo({ ...seo, meta_description: e.target.value })} className={inputCls} rows={3} data-testid="seo-desc" /></div>
            <div><Label>Anahtar Kelimeler</Label><Input value={seo.meta_keywords} onChange={(e) => setSeo({ ...seo, meta_keywords: e.target.value })} className={inputCls} placeholder="dijital pazarlama, google ads, seo" data-testid="seo-keywords" /></div>
            <div><Label>Paylaşım Görseli (OG Image)</Label><div className="mt-1.5"><ImageUpload value={seo.og_image} onChange={(v) => setSeo({ ...seo, og_image: v })} testId="seo-ogimage" /></div></div>
            <Button onClick={saveSeo} disabled={busy === "seo"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-seo">{busy === "seo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
          </section>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-3">
            <h2 className="font-heading font-semibold">SEO Dosyaları</h2>
            <p className="text-sm text-muted-foreground">Arama motorları ve yapay zeka botları için otomatik oluşturulan dosyalar.</p>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <a href={`${BACKEND}/api/seo/sitemap.xml`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-3 hover:border-gold/40 text-gold" data-testid="link-sitemap">sitemap.xml →</a>
              <a href="/robots.txt" target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-3 hover:border-gold/40 text-gold" data-testid="link-robots">robots.txt →</a>
              <a href="/llms.txt" target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-3 hover:border-gold/40 text-gold" data-testid="link-llms">llms.txt →</a>
            </div>
          </section>
        </TabsContent>

        {/* TESTIMONIALS */}
        <TabsContent value="testimonials" className="mt-6 space-y-4">
          {testimonials.map((t, i) => (
            <section key={i} className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-heading font-semibold text-sm">Yorum #{i + 1}</h3>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTestimonials(testimonials.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>İsim</Label><Input value={t.name} onChange={(e) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inputCls} data-testid={`testimonial-name-${i}`} /></div>
                <div><Label>Ünvan / Rol</Label><Input value={t.role} onChange={(e) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className={inputCls} /></div>
                <div><Label>İlgili Eğitim</Label><select value={t.course_id || ""} onChange={(e) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, course_id: e.target.value } : x))} className={`${inputCls} w-full h-10 rounded-md px-3`} data-testid={`testimonial-course-${i}`}><option value="">Genel (tüm site)</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}</select></div>
                <div><Label>Video (embed linki)</Label><Input value={t.video_url} onChange={(e) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, video_url: e.target.value } : x))} className={inputCls} /></div>
                <div><Label>Kapak Görseli</Label><div className="mt-1.5"><ImageUpload value={t.thumbnail} onChange={(v) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, thumbnail: v } : x))} testId={`testimonial-thumb-${i}`} /></div></div>
              </div>
              <div><Label>Yorum</Label><Textarea value={t.quote} onChange={(e) => setTestimonials(testimonials.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))} className={inputCls} rows={2} /></div>
            </section>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/15" onClick={() => setTestimonials([...testimonials, { name: "", role: "", quote: "", video_url: "", thumbnail: "", rating: 5, course_id: "" }])} data-testid="add-testimonial"><Plus className="w-4 h-4 mr-2" /> Yorum Ekle</Button>
            <Button onClick={saveTestimonials} disabled={busy === "tt"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-testimonials">{busy === "tt" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
          </div>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="legal" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Site sözleşme ve politika metinlerini düzenle. Değişiklikler footer, sözleşme sayfaları ve onay bağlantılarında görünür. "Tür", URL'de kullanılır (örn. <span className="text-gold">/sozlesmeler/kvkk</span>).</p>
          {legal.map((d, i) => (
            <div key={i} className="bg-ink-surface border border-white/10 rounded-xl p-4 space-y-3" data-testid={`legal-doc-${i}`}>
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
                <div><Label>Tür (URL)</Label><Input value={d.type || ""} onChange={(e) => setLegal(legal.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className={inputCls} data-testid={`legal-type-${i}`} /></div>
                <div><Label>Başlık</Label><Input value={d.title || ""} onChange={(e) => setLegal(legal.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} className={inputCls} data-testid={`legal-title-${i}`} /></div>
              </div>
              <div><Label>İçerik</Label><Textarea value={d.body || ""} onChange={(e) => setLegal(legal.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} className={inputCls} rows={10} data-testid={`legal-body-${i}`} /></div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setLegal(legal.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 mr-1" /> Sil</Button>
            </div>
          ))}
          <div className="flex gap-3">
            <Button variant="outline" className="border-white/15" onClick={() => setLegal([...legal, { type: "", title: "", body: "" }])} data-testid="add-legal"><Plus className="w-4 h-4 mr-2" /> Sözleşme Ekle</Button>
            <Button onClick={saveLegal} disabled={busy === "lg"} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-legal">{busy === "lg" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
          </div>
        </TabsContent>

        <TabsContent value="email" className="mt-6 space-y-6">
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 flex items-center justify-between">
            <div><h2 className="font-heading font-semibold">E-posta Bildirimleri</h2><p className="text-sm text-muted-foreground mt-1">Tüm otomatik e-postaları aç/kapat</p></div>
            <Switch checked={s.email_enabled} onCheckedChange={async (v) => { g({ email_enabled: v }); await api.put("/admin/settings/general", { ...generalPayload(), email_enabled: v }); toast.success(v ? "E-postalar açıldı" : "E-postalar kapatıldı"); }} data-testid="toggle-email" />
          </section>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" /><p>Değişkenler: <code className="text-gold">{"{{name}}"}</code>, <code className="text-gold">{"{{course_title}}"}</code>, <code className="text-gold">{"{{amount}}"}</code>, <code className="text-gold">{"{{certificate_code}}"}</code>, <code className="text-gold">{"{{new_password}}"}</code>, <code className="text-gold">{"{{site_name}}"}</code></p>
          </div>
          {templates.map((t, i) => (
            <section key={t.key} className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between"><h3 className="font-heading font-semibold">{t.name}</h3>
                <Switch checked={t.enabled} onCheckedChange={(v) => setTemplates(templates.map((x, j) => j === i ? { ...x, enabled: v } : x))} /></div>
              <div><Label>Konu</Label><Input value={t.subject} onChange={(e) => setTemplates(templates.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} className={inputCls} data-testid={`template-subject-${t.key}`} /></div>
              <div><Label>İçerik (HTML)</Label><Textarea value={t.html} onChange={(e) => setTemplates(templates.map((x, j) => j === i ? { ...x, html: e.target.value } : x))} className={`${inputCls} font-mono text-xs`} rows={5} /></div>
              <Button onClick={() => saveTemplate(t)} variant="outline" size="sm" className="border-white/15" data-testid={`save-template-${t.key}`}><Save className="w-4 h-4 mr-2" /> Şablonu Kaydet</Button>
            </section>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
