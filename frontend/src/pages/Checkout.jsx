import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Tag, ShieldCheck, X } from "lucide-react";
import api, { apiError, formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function Checkout() {
  const { items, subtotal, remove, clear } = useCart();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(null);
  const [applying, setApplying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [iframeUrl, setIframeUrl] = useState("");

  useEffect(() => { document.title = "Ödeme - Akademi"; }, []);

  const total = discount ? Math.max(0, subtotal - discount.discount) : subtotal;

  const applyDiscount = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const { data } = await api.post("/payments/validate-discount", { code, subtotal });
      setDiscount(data);
      toast.success("İndirim kodu uygulandı");
    } catch (e) { toast.error(apiError(e)); setDiscount(null); }
    finally { setApplying(false); }
  };

  const pay = async () => {
    setProcessing(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        items: items.map((i) => ({ course_id: i.course_id })),
        discount_code: discount?.code || null,
      });
      if (data.status === "free") {
        clear();
        toast.success("Kayıt tamamlandı!");
        navigate(`/odeme/sonuc?oid=${data.order_id}`);
      } else if (data.status === "paytr") {
        setIframeUrl(data.iframe_url);
      }
    } catch (e) { toast.error(apiError(e)); }
    finally { setProcessing(false); }
  };

  if (items.length === 0 && !iframeUrl) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-24 text-center">
        <p className="text-muted-foreground">Ödeme yapılacak eğitim yok.</p>
        <Link to="/kurslar"><Button className="mt-6 bg-gold text-ink font-semibold rounded-full">Eğitimlere Göz At</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter mb-10">Ödeme</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          {items.map((i) => (
            <div key={i.course_id} className="flex gap-4 bg-ink-surface border border-white/5 rounded-2xl p-4">
              <img src={i.thumbnail} alt={i.title} className="w-24 h-16 object-cover rounded-lg" />
              <div className="flex-1 flex items-center justify-between">
                <span className="font-medium text-sm">{i.title}</span>
                <div className="flex items-center gap-3">
                  <span className="font-heading font-bold text-gold">{i.price === 0 ? "Ücretsiz" : `${formatPrice(i.price)} ₺`}</span>
                  <button onClick={() => remove(i.course_id)} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-ink-surface border border-white/5 rounded-2xl p-5">
            <label className="text-sm font-medium flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-gold" /> İndirim Kodu</label>
            <div className="flex gap-2">
              <Input data-testid="discount-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KOD" className="bg-ink border-white/10" />
              <Button onClick={applyDiscount} disabled={applying} variant="outline" data-testid="apply-discount" className="border-white/15">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Uygula"}
              </Button>
            </div>
            {discount && <p className="text-xs text-green-400 mt-2">✓ {formatPrice(discount.discount)} ₺ indirim uygulandı</p>}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="bg-ink-surface border border-white/10 rounded-2xl p-6 lg:sticky lg:top-24">
            <h2 className="font-heading font-semibold text-lg mb-4">Sipariş Özeti</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Ara Toplam</span><span>{formatPrice(subtotal)} ₺</span></div>
              {discount && <div className="flex justify-between text-green-400"><span>İndirim</span><span>- {formatPrice(discount.discount)} ₺</span></div>}
            </div>
            <div className="flex justify-between font-heading font-bold text-xl pt-4 mt-4 border-t border-white/5"><span>Toplam</span><span className="text-gold">{formatPrice(total)} ₺</span></div>
            <Button onClick={pay} disabled={processing} data-testid="pay-now" className="w-full mt-6 h-12 bg-gold hover:bg-gold-hover text-ink font-bold">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : total === 0 ? "Ücretsiz Kaydol" : "Güvenli Ödeme Yap"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> PayTR güvenli ödeme altyapısı</p>
            <p className="text-[11px] text-muted-foreground text-center mt-3">Ödemeyi tamamlayarak <Link to="/sozlesmeler/mesafeli-satis" target="_blank" className="text-gold">Mesafeli Satış Sözleşmesi</Link>'ni kabul etmiş olursunuz.</p>
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
