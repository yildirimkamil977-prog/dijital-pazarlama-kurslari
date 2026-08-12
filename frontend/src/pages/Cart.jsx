import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, ShoppingCart, ArrowRight, Plus, Sparkles, ShieldCheck } from "lucide-react";
import api, { formatPrice } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { WhatsAppCTA } from "@/components/WhatsAppCTA";
import { toast } from "sonner";

export default function Cart() {
  const { items, remove, add, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recs, setRecs] = useState([]);

  useEffect(() => {
    document.title = "Sepetim - Akademi";
    if (items.length) {
      const ids = items.map((i) => i.course_id).join(",");
      api.get(`/recommendations?ids=${ids}`).then(({ data }) => setRecs(data)).catch(() => {});
    } else setRecs([]);
    // eslint-disable-next-line
  }, [items.length]);

  const addRec = (r) => { add({ course_id: r.course_id, title: r.title, slug: r.slug, thumbnail: r.thumbnail, price: r.price, discount_price: r.bundle_price }); toast.success("Kampanyalı fiyatla eklendi"); };

  const originalTotal = items.reduce((s, i) => s + (i.original_price ?? i.price ?? 0), 0);
  const savings = Math.max(0, originalTotal - subtotal);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter mb-10">Sepetim</h1>

      {items.length === 0 ? (
        <div className="text-center py-24 bg-ink-surface border border-white/5 rounded-2xl">
          <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="mt-4 text-muted-foreground">Sepetin şu an boş.</p>
          <Link to="/kurslar"><Button className="mt-6 bg-gold hover:bg-gold-hover text-ink font-semibold rounded-full">Eğitimlere Göz At</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-4">
            {items.map((i) => (
              <div key={i.course_id} data-testid={`cart-item-${i.course_id}`} className="flex gap-4 bg-ink-surface border border-white/5 rounded-2xl p-4">
                <img src={i.thumbnail} alt={i.title} className="w-32 h-20 object-cover rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col justify-between">
                  <Link to={`/kurslar/${i.slug}`} className="font-medium hover:text-gold transition-colors duration-200">{i.title}</Link>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {i.original_price > i.price && <span className="text-xs text-muted-foreground line-through">{formatPrice(i.original_price)} ₺</span>}
                      <span className="font-heading font-bold text-gold">{i.price === 0 ? "Ücretsiz" : `${formatPrice(i.price)} ₺`}</span>
                      {i.original_price > i.price && <span className="text-[11px] font-semibold text-green-400 bg-green-500/10 rounded px-1.5 py-0.5">%{Math.round((1 - i.price / i.original_price) * 100)}</span>}
                    </div>
                    <button onClick={() => remove(i.course_id)} data-testid={`remove-${i.course_id}`} className="text-muted-foreground hover:text-destructive transition-colors duration-200 p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}

            {/* Cross-sell / campaign */}
            {recs.length > 0 && (
              <div className="mt-8 bg-gradient-to-br from-gold/10 to-ink-surface border border-gold/15 rounded-2xl p-6">
                <h2 className="font-heading font-semibold flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-gold" /> Bunları da ekle, {recs[0]?.bundle_pct > 0 ? `%${recs[0].bundle_pct} indirim kazan` : "keşfet"}</h2>
                <p className="text-sm text-muted-foreground mb-5">Birlikte alınan eğitimlerde sana özel kampanyalı fiyatlar.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {recs.map((r) => (
                    <div key={r.course_id} data-testid={`rec-${r.course_id}`} className="flex gap-3 bg-ink border border-white/5 rounded-xl p-3">
                      <img src={r.thumbnail} alt={r.title} className="w-20 h-14 object-cover rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {r.bundle_price < r.price && <span className="text-xs text-muted-foreground line-through">{formatPrice(r.price)} ₺</span>}
                          <span className="text-sm font-bold text-gold">{formatPrice(r.bundle_price)} ₺</span>
                        </div>
                      </div>
                      <Button onClick={() => addRec(r)} size="sm" data-testid={`add-rec-${r.course_id}`} className="bg-gold text-ink font-semibold self-center shrink-0 h-8"><Plus className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-4">
            <div className="bg-ink-surface border border-white/10 rounded-2xl p-6">
              <h2 className="font-heading font-semibold text-lg mb-4">Özet</h2>
              <div className="flex justify-between text-sm mb-2"><span className="text-muted-foreground">Liste Fiyatı ({items.length} eğitim)</span><span>{formatPrice(originalTotal)} ₺</span></div>
              {items.filter((i) => (i.original_price ?? i.price) > i.price).map((i) => (
                <div key={i.course_id} className="flex justify-between text-sm mb-2 text-green-400"><span className="truncate mr-2">{i.title} indirimi</span><span className="shrink-0">- {formatPrice((i.original_price ?? i.price) - i.price)} ₺</span></div>
              ))}
              {savings > 0 && <div className="flex justify-between text-sm mb-2 font-medium text-green-400 pt-2 border-t border-white/5"><span>Toplam İndirim</span><span>- {formatPrice(savings)} ₺</span></div>}
              <div className="flex justify-between font-heading font-bold text-lg pt-4 mt-4 border-t border-white/5"><span>Toplam</span><span className="text-gold">{formatPrice(subtotal)} ₺</span></div>
              <Button onClick={() => navigate("/odeme")} data-testid="checkout-btn" className="w-full mt-6 bg-gold hover:bg-gold-hover text-ink font-bold h-12">Ödemeye Geç <ArrowRight className="w-4 h-4 ml-2" /></Button>
              <p className="text-xs text-muted-foreground text-center mt-3">Üye olmadan da ödeme yapabilirsin.</p>
              <p className="text-xs text-muted-foreground text-center mt-4 flex items-center justify-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> PayTR güvenli ödeme</p>
            </div>
            <WhatsAppCTA prefill="Sepetimdeki eğitimler hakkında soru sormak istiyorum." testId="cart-whatsapp" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
