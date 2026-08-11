import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, Landmark, CheckCircle2, Send } from "lucide-react";
import api, { apiError, formatPrice } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function TransferNotify() {
  const [params] = useSearchParams();
  const [orderId, setOrderId] = useState(params.get("oid") || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ sender_name: "", amount: "", transfer_date: "", note: "" });

  useEffect(() => { document.title = "Havale/EFT Bildirimi - Akademi"; }, []);

  const fetchOrder = async (oid) => {
    const id = (oid ?? orderId).trim();
    if (!id) { toast.error("Lütfen sipariş numaranı gir"); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/payments/transfer-order/${id}`);
      setOrder(data);
      setForm((f) => ({ ...f, amount: data.total != null ? String(data.total) : f.amount }));
      if (data.already_notified) toast.info("Bu sipariş için daha önce bildirim yapılmış. Yeniden gönderebilirsin.");
    } catch (e) { setOrder(null); toast.error(apiError(e)); } finally { setLoading(false); }
  };

  useEffect(() => { if (params.get("oid")) fetchOrder(params.get("oid")); /* eslint-disable-next-line */ }, []);

  const submit = async () => {
    if (!orderId.trim()) { toast.error("Sipariş numarası zorunlu"); return; }
    setSubmitting(true);
    try {
      await api.post("/payments/transfer-notification", { order_id: orderId.trim(), ...form });
      setDone(true);
    } catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };

  const inputCls = "bg-ink border-white/10 mt-1.5";

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-20 text-center" data-testid="transfer-notify-done">
        <span className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-green-400" /></span>
        <h1 className="mt-5 font-heading font-black text-3xl tracking-tighter">Bildirimin Alındı</h1>
        <p className="mt-3 text-muted-foreground">Havale/EFT bildirimin bize ulaştı. Ödemen kontrol edilip onaylandığında eğitimlerine erişimin otomatik açılacak ve e-posta ile bilgilendirileceksin.</p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link to="/panel"><Button className="bg-gold hover:bg-gold-hover text-ink font-bold">Panelime Git</Button></Link>
          <Link to="/kurslar"><Button variant="outline" className="border-white/15">Eğitimlere Göz At</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-5 sm:px-8 py-16">
      <div className="text-center mb-8">
        <span className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto"><Landmark className="w-8 h-8 text-gold" /></span>
        <h1 className="mt-5 font-heading font-black text-3xl sm:text-4xl tracking-tighter">Havale/EFT Bildirimi</h1>
        <p className="mt-3 text-muted-foreground">Ödemeni yaptıysan aşağıdaki formu doldurarak bize bildir. Böylece kaydın daha hızlı onaylanır.</p>
      </div>

      <div className="bg-ink-surface border border-white/10 rounded-2xl p-6 space-y-4">
        <div>
          <Label>Sipariş Numarası *</Label>
          <div className="flex gap-2 mt-1.5">
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} className="bg-ink border-white/10" placeholder="PTxxxxxxxxxxxx" data-testid="notify-order-id" />
            <Button variant="outline" className="border-white/15 shrink-0" onClick={() => fetchOrder()} disabled={loading} data-testid="notify-fetch-order">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sorgula"}</Button>
          </div>
          {order && (
            <div className="mt-3 text-sm bg-ink rounded-lg p-3 border border-white/5" data-testid="notify-order-summary">
              <p className="text-muted-foreground">{order.items?.join(", ")}</p>
              <p className="mt-1">Tutar: <span className="text-gold font-semibold">{formatPrice(order.total)} ₺</span> · Durum: {order.status === "paid" ? "Onaylandı" : "Ödeme bekleniyor"}</p>
            </div>
          )}
        </div>
        <div><Label>Gönderen Ad Soyad</Label><Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} className={inputCls} data-testid="notify-sender" /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Gönderilen Tutar (₺)</Label><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} data-testid="notify-amount" /></div>
          <div><Label>Gönderim Tarihi</Label><Input type="date" value={form.transfer_date} onChange={(e) => setForm({ ...form, transfer_date: e.target.value })} className={inputCls} data-testid="notify-date" /></div>
        </div>
        <div><Label>Not (opsiyonel)</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} rows={3} placeholder="Dekont açıklaması, banka vb." /></div>
        <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gold hover:bg-gold-hover text-ink font-bold" data-testid="notify-submit">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Bildirimi Gönder</>}
        </Button>
      </div>
    </div>
  );
}
