import { Link, useNavigate } from "react-router-dom";
import { Trash2, ShoppingCart, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function Cart() {
  const { items, remove, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
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
                    <span className="font-heading font-bold text-gold">{i.price === 0 ? "Ücretsiz" : `${formatPrice(i.price)} ₺`}</span>
                    <button onClick={() => remove(i.course_id)} data-testid={`remove-${i.course_id}`} className="text-muted-foreground hover:text-destructive transition-colors duration-200 p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4">
            <div className="bg-ink-surface border border-white/10 rounded-2xl p-6 lg:sticky lg:top-24">
              <h2 className="font-heading font-semibold text-lg mb-4">Özet</h2>
              <div className="flex justify-between text-sm mb-2"><span className="text-muted-foreground">Ara Toplam</span><span>{formatPrice(subtotal)} ₺</span></div>
              <div className="flex justify-between font-heading font-bold text-lg pt-4 mt-4 border-t border-white/5"><span>Toplam</span><span className="text-gold">{formatPrice(subtotal)} ₺</span></div>
              <Button onClick={() => navigate(user ? "/odeme" : "/giris")} data-testid="checkout-btn" className="w-full mt-6 bg-gold hover:bg-gold-hover text-ink font-bold h-12">
                Ödemeye Geç <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {!user && <p className="text-xs text-muted-foreground text-center mt-3">Ödeme için giriş yapman gerekiyor.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
