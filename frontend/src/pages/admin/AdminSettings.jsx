import { useEffect, useState } from "react";
import { Loader2, Save, CreditCard, Mail, Globe, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [savingG, setSavingG] = useState(false);
  const [savingP, setSavingP] = useState(false);
  const [paytr, setPaytr] = useState({ merchant_id: "", merchant_key: "", merchant_salt: "", notification_url: "", test_mode: true });
  const callbackUrl = `${process.env.REACT_APP_BACKEND_URL}/api/payments/paytr/callback`;

  useEffect(() => {
    document.title = "Yönetim - Ayarlar";
    api.get("/admin/settings").then(({ data }) => {
      setSettings(data);
      setPaytr({
        merchant_id: data.paytr.merchant_id || "", merchant_key: "", merchant_salt: "",
        notification_url: data.paytr.notification_url || callbackUrl, test_mode: data.paytr.test_mode,
      });
    });
    api.get("/admin/email-templates").then(({ data }) => setTemplates(data));
    // eslint-disable-next-line
  }, []);

  const saveGeneral = async () => {
    setSavingG(true);
    try {
      const { paytr: _p, paytr_conf, ...g } = settings;
      await api.put("/admin/settings/general", {
        site_name: settings.site_name, tagline: settings.tagline, contact_email: settings.contact_email,
        support_phone: settings.support_phone, hero_title: settings.hero_title, hero_subtitle: settings.hero_subtitle,
        about_text: settings.about_text, students_count: settings.students_count, email_enabled: settings.email_enabled,
      });
      toast.success("Genel ayarlar kaydedildi");
    } catch (e) { toast.error(apiError(e)); } finally { setSavingG(false); }
  };

  const savePaytr = async () => {
    setSavingP(true);
    try {
      const payload = { merchant_id: paytr.merchant_id, notification_url: paytr.notification_url, test_mode: paytr.test_mode };
      if (paytr.merchant_key) payload.merchant_key = paytr.merchant_key;
      if (paytr.merchant_salt) payload.merchant_salt = paytr.merchant_salt;
      const { data } = await api.put("/admin/settings/paytr", payload);
      toast.success(data.configured ? "PayTR ayarları kaydedildi ve aktif" : "Kaydedildi (eksik bilgi: pasif)");
      const { data: s } = await api.get("/admin/settings");
      setSettings(s);
      setPaytr((p) => ({ ...p, merchant_key: "", merchant_salt: "" }));
    } catch (e) { toast.error(apiError(e)); } finally { setSavingP(false); }
  };

  const saveTemplate = async (tpl) => {
    try {
      await api.put(`/admin/email-templates/${tpl.key}`, { subject: tpl.subject, html: tpl.html, enabled: tpl.enabled });
      toast.success("Şablon kaydedildi");
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!settings) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  const inputCls = "bg-ink border-white/10 mt-1.5";

  return (
    <div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter mb-8">Site Ayarları</h1>
      <Tabs defaultValue="general">
        <TabsList className="bg-ink-surface border border-white/5 flex-wrap h-auto">
          <TabsTrigger value="general" data-testid="settings-tab-general"><Globe className="w-4 h-4 mr-2" /> Genel</TabsTrigger>
          <TabsTrigger value="paytr" data-testid="settings-tab-paytr"><CreditCard className="w-4 h-4 mr-2" /> PayTR</TabsTrigger>
          <TabsTrigger value="email" data-testid="settings-tab-email"><Mail className="w-4 h-4 mr-2" /> E-posta</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Site Bilgileri</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Site Adı</Label><Input value={settings.site_name || ""} onChange={(e) => setSettings({ ...settings, site_name: e.target.value })} className={inputCls} data-testid="setting-site-name" /></div>
              <div><Label>Slogan</Label><Input value={settings.tagline || ""} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} className={inputCls} /></div>
              <div><Label>İletişim E-postası</Label><Input value={settings.contact_email || ""} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} className={inputCls} /></div>
              <div><Label>Destek Telefonu</Label><Input value={settings.support_phone || ""} onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })} className={inputCls} /></div>
              <div><Label>Öğrenci Sayısı (gösterim)</Label><Input value={settings.students_count || ""} onChange={(e) => setSettings({ ...settings, students_count: e.target.value })} className={inputCls} /></div>
            </div>
          </section>
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-heading font-semibold">Anasayfa & Hakkımda</h2>
            <div><Label>Hero Başlık</Label><Input value={settings.hero_title || ""} onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })} className={inputCls} /></div>
            <div><Label>Hero Alt Metin</Label><Textarea value={settings.hero_subtitle || ""} onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })} className={inputCls} rows={3} /></div>
            <div><Label>Hakkımda Metni</Label><Textarea value={settings.about_text || ""} onChange={(e) => setSettings({ ...settings, about_text: e.target.value })} className={inputCls} rows={4} /></div>
          </section>
          <Button onClick={saveGeneral} disabled={savingG} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-general">{savingG ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
        </TabsContent>

        {/* PAYTR */}
        <TabsContent value="paytr" className="mt-6 space-y-6">
          <div className="flex items-center gap-3">
            {settings.paytr.configured ? (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/20"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Aktif</Badge>
            ) : (
              <Badge className="bg-gold/15 text-gold border-gold/20"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> Yapılandırılmadı</Badge>
            )}
            <Badge className="bg-secondary">{settings.paytr.test_mode ? "Test Modu" : "Canlı Mod"}</Badge>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>PayTR Mağaza Paneli → Bilgi sayfasından Mağaza No, API Anahtarı ve Gizli Anahtarı alın. <strong>Bildirim URL'sini</strong> PayTR panelinize aşağıdaki adres olarak tanımlayın. Mağazanız aktif olduğunda bu bilgileri girip kaydedin; ödeme anında çalışır.</p>
          </div>

          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
            <div><Label>Mağaza No (Merchant ID)</Label><Input value={paytr.merchant_id} onChange={(e) => setPaytr({ ...paytr, merchant_id: e.target.value })} className={inputCls} data-testid="paytr-merchant-id" /></div>
            <div><Label>API Anahtarı (Merchant Key) {settings.paytr.has_key && <span className="text-xs text-green-400">· kayıtlı</span>}</Label>
              <Input type="password" value={paytr.merchant_key} onChange={(e) => setPaytr({ ...paytr, merchant_key: e.target.value })} className={inputCls} placeholder={settings.paytr.has_key ? "•••••• (değiştirmek için yaz)" : "Merchant Key"} data-testid="paytr-merchant-key" /></div>
            <div><Label>Gizli Anahtar (Merchant Salt) {settings.paytr.has_salt && <span className="text-xs text-green-400">· kayıtlı</span>}</Label>
              <Input type="password" value={paytr.merchant_salt} onChange={(e) => setPaytr({ ...paytr, merchant_salt: e.target.value })} className={inputCls} placeholder={settings.paytr.has_salt ? "•••••• (değiştirmek için yaz)" : "Merchant Salt"} data-testid="paytr-merchant-salt" /></div>
            <div><Label>Bildirim URL'si (PayTR paneline tanımlayın)</Label>
              <Input value={paytr.notification_url} onChange={(e) => setPaytr({ ...paytr, notification_url: e.target.value })} className={inputCls} data-testid="paytr-notification-url" />
              <button type="button" onClick={() => { navigator.clipboard?.writeText(callbackUrl); setPaytr({ ...paytr, notification_url: callbackUrl }); toast.success("Kopyalandı"); }} className="text-xs text-gold mt-2 hover:underline">Önerilen adresi kullan: {callbackUrl}</button>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div><Label>Test Modu</Label><p className="text-xs text-muted-foreground">Gerçek ödeme almadan test etmek için açık bırakın</p></div>
              <Switch checked={paytr.test_mode} onCheckedChange={(v) => setPaytr({ ...paytr, test_mode: v })} data-testid="paytr-test-mode" />
            </div>
          </section>
          <Button onClick={savePaytr} disabled={savingP} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-paytr">{savingP ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> PayTR Ayarlarını Kaydet</>}</Button>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="mt-6 space-y-6">
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 flex items-center justify-between">
            <div><h2 className="font-heading font-semibold">E-posta Bildirimleri</h2><p className="text-sm text-muted-foreground mt-1">Tüm otomatik e-postaları aç/kapat</p></div>
            <Switch checked={settings.email_enabled} onCheckedChange={async (v) => { setSettings({ ...settings, email_enabled: v }); await api.put("/admin/settings/general", { ...pickGeneral(settings), email_enabled: v }); toast.success(v ? "E-postalar açıldı" : "E-postalar kapatıldı"); }} data-testid="toggle-email" />
          </section>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-muted-foreground">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p>Şablonlarda <code className="text-gold">{"{{name}}"}</code>, <code className="text-gold">{"{{course_title}}"}</code>, <code className="text-gold">{"{{amount}}"}</code>, <code className="text-gold">{"{{certificate_code}}"}</code>, <code className="text-gold">{"{{site_name}}"}</code> değişkenlerini kullanabilirsiniz.</p>
          </div>

          {templates.map((t, i) => (
            <section key={t.key} className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold">{t.name}</h3>
                <Switch checked={t.enabled} onCheckedChange={(v) => setTemplates(templates.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
              </div>
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

function pickGeneral(s) {
  return {
    site_name: s.site_name, tagline: s.tagline, contact_email: s.contact_email, support_phone: s.support_phone,
    hero_title: s.hero_title, hero_subtitle: s.hero_subtitle, about_text: s.about_text, students_count: s.students_count,
  };
}
