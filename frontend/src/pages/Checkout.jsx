import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Tag, ShieldCheck, X, MessageCircle, CreditCard, Building2, User, Landmark, CheckCircle2, Copy } from "lucide-react";
import api, { apiError, formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trCities } from "@/data/trCities";
import { trackInitiateCheckout, trackPurchase, trackRegister } from "@/lib/track";
import { WhatsAppCTA } from "@/components/WhatsAppCTA";

export default function Checkout() {
  const { items, subtotal, remove, clear } = useCart();
  const { user, refresh } = useAuth();
  const { settings } = useSite();
  const navigate = useNavigate();
  const wa = (settings.whatsapp_number || settings.support_phone || "").replace(/\D/g, "");
  const transferPct = settings.transfer_discount_pct || 0;

  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(null);
  const [applying, setApplying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [iframeUrl, setIframeUrl] = useState("");
  const [method, setMethod] = useState("paytr");
  const [accept, setAccept] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [billing, setBilling] = useState({ type: "individual", tckn: "", company_name: "", tax_office: "", tax_no: "", city: "", district: "", address: "" });
  const [transferInfo, setTransferInfo] = useState(null);

  useEffect(() => { document.title = "Ödeme - Akademi"; }, []);

  const afterCode = discount ? Math.max(0, subtotal - discount.discount) : subtotal;
  const transferDisc = method === "transfer" ? Math.round(afterCode * (transferPct / 100) * 100) / 100 : 0;
  const total = Math.max(0, afterCode - transferDisc);
  const originalTotal = items.reduce((s, i) => s + (i.original_price ?? i.price ?? 0), 0);
  const campaignSavings = Math.max(0, originalTotal - subtotal);
  const districts = trCities.find((c) => c.name === billing.city)?.districts || [];
  const [pwdInfo, setPwdInfo] = useState(false);

  const applyDiscount = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try { const { data } = await api.post("/payments/validate-discount", { code, subtotal, items: items.map((i) => ({ course_id: i.course_id, price: i.price })) }); setDiscount(data); toast.success("İndirim kodu uygulandı"); }
    catch (e) { toast.error(apiError(e)); setDiscount(null); } finally { setApplying(false); }
  };

  const pay = async () => {
    if (!accept) { toast.error("Devam etmek için sözleşmeleri onaylayın."); return; }
    if (!user && (!customer.name || !customer.email || !customer.phone)) { toast.error("Ad, e-posta ve telefon zorunludur."); return; }
    setProcessing(true);
    trackInitiateCheckout({ value: total, numItems: items.length });
    try {
      const { data } = await api.post("/payments/checkout", {
        items: items.map((i) => ({ course_id: i.course_id })),
        discount_code: discount?.code || null,
        payment_method: method,
        customer: user ? null : customer,
        billing,
      });
      if (!user) await refresh();
      if (data.status === "free") { clear(); if (data.account_created) trackRegister(); trackPurchase({ orderId: data.order_id, value: total, items: items.map((i) => ({ id: i.course_id, title: i.title, price: i.price })) }); toast.success(data.account_created ? "Kayıt tamamlandı! Giriş bilgilerin e-postana gönderildi." : "Kayıt tamamlandı!"); navigate(`/odeme/sonuc?oid=${data.order_id}`); }
      else if (data.status === "paytr") { setIframeUrl(data.iframe_url); }
      else if (data.status === "transfer") { clear(); if (data.account_created) { trackRegister(); setPwdInfo(true); } setTransferInfo(data); }
    } catch (e) { toast.error(apiError(e)); } finally { setProcessing(false); }
  };

  if (items.length === 0 && !iframeUrl && !transferInfo) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <p className="text-muted-foreground">Ödeme yapılacak eğitim yok.</p>
        <Link to="/kurslar"><Button className="mt-6 bg-gold text-ink font-semibold rounded-full">Eğitimlere Göz At</Button></Link>
      </div>
    );
  }

  if (transferInfo) {
    return (
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-16" data-testid="transfer-result">
        <div className="text-center mb-8">
          <span className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto"><Landmark className="w-8 h-8 text-gold" /></span>
          <h1 className="mt-5 font-heading font-black text-3xl tracking-tighter">Havale/EFT Bilgileri</h1>
          <p className="mt-3 text-muted-foreground">Siparişin oluşturuldu. Aşağıdaki hesaba <strong className="text-gold">{formatPrice(transferInfo.total)} ₺</strong> gönder. Açıklamaya sipariş no <strong>{transferInfo.order_id}</strong> yaz. Bilgiler ayrıca e-postana gönderildi.</p>
        </div>
        <div className="space-y-3">
          {transferInfo.bank_accounts.map((b, i) => (
            <div key={i} className="bg-ink-surface border border-white/10 rounded-2xl p-5">
              <p className="font-heading font-semibold">{b.bank_name}</p>
              <p className="text-sm text-muted-foreground mt-1">Alıcı: {b.holder}</p>
              <div className="flex items-center justify-between mt-2 bg-ink rounded-lg p-3">
                <span className="font-mono text-sm">{b.iban}</span>
                <button onClick={() => { navigator.clipboard?.writeText(b.iban); toast.success("IBAN kopyalandı"); }} className="text-gold"><Copy className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={() => navigate(`/havale-bildirimi?oid=${transferInfo.order_id}`)} className="w-full mt-8 bg-gold hover:bg-gold-hover text-ink font-bold h-12" data-testid="go-transfer-notify">Ödememi Bildir</Button>
        <Button onClick={() => navigate("/panel")} variant="outline" className="w-full mt-3 border-white/15 h-12">Panelime Git</Button>
        <Dialog open={pwdInfo} onOpenChange={setPwdInfo}>
          <DialogContent className="max-w-md bg-ink-surface border-white/10" data-testid="account-created-dialog">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-400" /> Hesabın Oluşturuldu</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground leading-relaxed">Senin için otomatik bir öğrenci hesabı oluşturduk. Giriş şifren <strong className="text-foreground">{customer.email}</strong> adresine e-posta ile gönderildi. Panele giriş yaparken bu bilgileri kullanabilirsin.</p>
            <Button onClick={() => setPwdInfo(false)} className="bg-gold hover:bg-gold-hover text-ink font-semibold mt-2" data-testid="account-created-ok">Anladım</Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const inputCls = "bg-ink border-white/10 mt-1.5";

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter mb-10">Ödeme</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {/* Guest info */}
          {!user && (
            <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
              <h2 className="font-heading font-semibold mb-1">İletişim Bilgilerin</h2>
              <p className="text-sm text-muted-foreground mb-4">Hesabın otomatik oluşturulur, giriş bilgilerin e-postana gönderilir.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Ad Soyad *</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className={inputCls} data-testid="guest-name" /></div>
                <div><Label>Telefon *</Label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className={inputCls} placeholder="05XX XXX XX XX" data-testid="guest-phone" /></div>
                <div className="sm:col-span-2"><Label>E-posta *</Label><Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className={inputCls} data-testid="guest-email" /></div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Zaten üye misin? <Link to="/giris" className="text-gold">Giriş yap</Link></p>
            </section>
          )}

          {/* Billing */}
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-semibold mb-4">Fatura Bilgileri</h2>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[["individual", "Bireysel", User], ["corporate", "Kurumsal", Building2]].map(([v, l, Ic]) => (
                <button key={v} onClick={() => setBilling({ ...billing, type: v })} data-testid={`billing-${v}`}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors duration-200 ${billing.type === v ? "border-gold bg-gold/10 text-gold" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                  <Ic className="w-4 h-4" /> {l}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {billing.type === "individual" ? (
                <div className="sm:col-span-2"><Label>TC Kimlik No</Label><Input value={billing.tckn} onChange={(e) => setBilling({ ...billing, tckn: e.target.value })} className={inputCls} data-testid="billing-tckn" /></div>
              ) : (
                <>
                  <div><Label>Firma Ünvanı</Label><Input value={billing.company_name} onChange={(e) => setBilling({ ...billing, company_name: e.target.value })} className={inputCls} data-testid="billing-company" /></div>
                  <div><Label>Vergi No</Label><Input value={billing.tax_no} onChange={(e) => setBilling({ ...billing, tax_no: e.target.value })} className={inputCls} data-testid="billing-taxno" /></div>
                  <div className="sm:col-span-2"><Label>Vergi Dairesi</Label><Input value={billing.tax_office} onChange={(e) => setBilling({ ...billing, tax_office: e.target.value })} className={inputCls} data-testid="billing-taxoffice" /></div>
                </>
              )}
              <div>
                <Label>İl</Label>
                <Select value={billing.city} onValueChange={(v) => setBilling({ ...billing, city: v, district: "" })}>
                  <SelectTrigger className={inputCls} data-testid="billing-city"><SelectValue placeholder="Şehir seçin" /></SelectTrigger>
                  <SelectContent className="max-h-72">{trCities.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>İlçe</Label>
                <Select value={billing.district} onValueChange={(v) => setBilling({ ...billing, district: v })} disabled={!billing.city}>
                  <SelectTrigger className={inputCls} data-testid="billing-district"><SelectValue placeholder={billing.city ? "İlçe seçin" : "Önce şehir seçin"} /></SelectTrigger>
                  <SelectContent className="max-h-72">{districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Adres</Label><Textarea value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} className={inputCls} rows={2} placeholder="Mahalle, cadde, kapı no..." data-testid="billing-address" /></div>
            </div>
          </section>

          {/* Payment method */}
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-semibold mb-4">Ödeme Yöntemi</h2>
            <div className="space-y-3">
              <button onClick={() => setMethod("paytr")} data-testid="method-paytr" className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors duration-200 ${method === "paytr" ? "border-gold bg-gold/5" : "border-white/10"}`}>
                <CreditCard className="w-5 h-5 text-gold" /><div className="flex-1"><p className="font-medium text-sm">Kredi / Banka Kartı</p><p className="text-xs text-muted-foreground">PayTR güvenli ödeme</p></div>
                {method === "paytr" && <CheckCircle2 className="w-5 h-5 text-gold" />}
              </button>
              <button onClick={() => setMethod("transfer")} data-testid="method-transfer" className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors duration-200 ${method === "transfer" ? "border-gold bg-gold/5" : "border-white/10"}`}>
                <Landmark className="w-5 h-5 text-gold" /><div className="flex-1"><p className="font-medium text-sm">Havale / EFT {transferPct > 0 && <span className="text-green-400 text-xs font-semibold">%{transferPct} indirim</span>}</p><p className="text-xs text-muted-foreground">Banka bilgileri ekranda ve e-postada iletilir</p></div>
                {method === "transfer" && <CheckCircle2 className="w-5 h-5 text-gold" />}
              </button>
            </div>
          </section>

          {/* Discount */}
          <section className="bg-ink-surface border border-white/5 rounded-2xl p-5">
            <label className="text-sm font-medium flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-gold" /> İndirim Kodu</label>
            <div className="flex gap-2">
              <Input data-testid="discount-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KOD" className="bg-ink border-white/10" />
              <Button onClick={applyDiscount} disabled={applying} variant="outline" data-testid="apply-discount" className="border-white/15">{applying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Uygula"}</Button>
            </div>
            {discount && <p className="text-xs text-green-400 mt-2">✓ {discount.label || "İndirim"} uygulandı — {formatPrice(discount.discount)} ₺ ({discount.code})</p>}
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 space-y-4">
          <div className="bg-ink-surface border border-white/10 rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-lg mb-4">Sipariş Özeti</h2>
            <div className="space-y-2 max-h-40 overflow-auto mb-3">
              {items.map((i) => (<div key={i.course_id} className="flex justify-between items-center text-sm gap-2"><span className="truncate">{i.title}</span><span className="shrink-0 flex items-center gap-1.5">{(i.original_price ?? i.price) > i.price && <span className="text-xs text-muted-foreground line-through">{formatPrice(i.original_price)}</span>}{formatPrice(i.price)} ₺</span></div>))}
            </div>
            <div className="space-y-2 text-sm pt-3 border-t border-white/5">
              <div className="flex justify-between"><span className="text-muted-foreground">Liste Fiyatı</span><span>{formatPrice(originalTotal)} ₺</span></div>
              {campaignSavings > 0 && <div className="flex justify-between text-green-400"><span>Kampanya İndirimi</span><span>- {formatPrice(campaignSavings)} ₺</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Ara Toplam</span><span>{formatPrice(subtotal)} ₺</span></div>
              {discount && <div className="flex justify-between text-green-400"><span>{discount.label}</span><span>- {formatPrice(discount.discount)} ₺</span></div>}
              {transferDisc > 0 && <div className="flex justify-between text-green-400"><span>Havale/EFT (%{transferPct})</span><span>- {formatPrice(transferDisc)} ₺</span></div>}
            </div>
            <div className="flex justify-between font-heading font-bold text-xl pt-4 mt-4 border-t border-white/5"><span>Toplam</span><span className="text-gold">{formatPrice(total)} ₺</span></div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground mt-5 cursor-pointer">
              <Checkbox checked={accept} onCheckedChange={setAccept} data-testid="checkout-terms" className="mt-0.5" />
              <span><Link to="/sozlesmeler/satis" target="_blank" className="text-gold">Satış Sözleşmesi</Link>, <Link to="/sozlesmeler/kvkk" target="_blank" className="text-gold">KVKK</Link> ve <Link to="/sozlesmeler/iptal-iade" target="_blank" className="text-gold">İptal ve İade Politikası</Link>'nı okudum, onaylıyorum.</span>
            </label>

            <Button onClick={pay} disabled={processing} data-testid="pay-now" className="w-full mt-5 h-12 bg-gold hover:bg-gold-hover text-ink font-bold">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : total === 0 ? "Ücretsiz Kaydol" : method === "transfer" ? "Havale Bilgilerini Al" : "Güvenli Ödeme Yap"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Güvenli ödeme</p>
          </div>
          <WhatsAppCTA prefill="Ödeme adımında yardıma ihtiyacım var." testId="checkout-whatsapp" />
          </div>
        </div>
      </div>

      <Dialog open={!!iframeUrl} onOpenChange={(o) => !o && setIframeUrl("")}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 bg-ink-surface">
          <DialogHeader className="p-4 border-b border-white/10"><DialogTitle>Güvenli Ödeme</DialogTitle></DialogHeader>
          {iframeUrl && <iframe title="PayTR Ödeme" src={iframeUrl} className="w-full h-full border-0" allow="payment" data-testid="paytr-iframe" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
