import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import api from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clear } = useCart();
  const oid = params.get("oid");
  const failParam = params.get("fail");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Ödeme Sonucu - Akademi";
    if (!oid) { setLoading(false); return; }
    let tries = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/order/${oid}`);
        setOrder(data);
        if (data.status === "paid") { clear(); setLoading(false); return; }
        if (data.status === "pending" && !failParam && tries < 5) { tries++; setTimeout(poll, 2000); return; }
        setLoading(false);
      } catch { setLoading(false); }
    };
    poll();
    // eslint-disable-next-line
  }, [oid]);

  const paid = order?.status === "paid";
  const pending = order?.status === "pending" && !failParam;

  return (
    <div className="max-w-lg mx-auto px-5 py-24 text-center">
      {loading ? (
        <>
          <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto" />
          <p className="mt-6 text-muted-foreground">Ödeme durumu kontrol ediliyor...</p>
        </>
      ) : paid ? (
        <div data-testid="payment-success">
          <span className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-9 h-9 text-green-400" /></span>
          <h1 className="mt-6 font-heading font-black text-3xl tracking-tighter">Ödeme Başarılı!</h1>
          <p className="mt-3 text-muted-foreground">Tebrikler, eğitimlerine erişimin açıldı. Hemen izlemeye başlayabilirsin.</p>
          <Button onClick={() => navigate("/panel")} className="mt-8 bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-8">Panelime Git</Button>
        </div>
      ) : pending ? (
        <div data-testid="payment-pending">
          <span className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto"><Clock className="w-9 h-9 text-gold" /></span>
          <h1 className="mt-6 font-heading font-black text-3xl tracking-tighter">Ödeme İşleniyor</h1>
          <p className="mt-3 text-muted-foreground">Ödemen alındı, onay bekleniyor. Erişimin kısa süre içinde açılacak.</p>
          <Button onClick={() => navigate("/panel")} className="mt-8 bg-gold text-ink font-bold rounded-full px-8">Panelime Git</Button>
        </div>
      ) : (
        <div data-testid="payment-failed">
          <span className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto"><XCircle className="w-9 h-9 text-red-400" /></span>
          <h1 className="mt-6 font-heading font-black text-3xl tracking-tighter">Ödeme Tamamlanamadı</h1>
          <p className="mt-3 text-muted-foreground">Bir sorun oluştu veya ödeme iptal edildi. Lütfen tekrar deneyin.</p>
          <Button onClick={() => navigate("/sepet")} variant="outline" className="mt-8 rounded-full px-8 border-white/15">Sepete Dön</Button>
        </div>
      )}
    </div>
  );
}
