import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Video, Users, CalendarDays, ArrowRight } from "lucide-react";
import api, { formatPrice } from "@/lib/api";

const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }); } catch { return d; } };

export default function GroupList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { document.title = "Canlı Grup Eğitimleri"; api.get("/group-trainings").then(({ data }) => setItems(data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
      <div className="max-w-2xl mb-12">
        <span className="inline-flex items-center gap-2 overline text-gold"><Video className="w-3.5 h-3.5" /> Google Meet · Canlı</span>
        <h1 className="mt-3 font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">Canlı Grup Eğitimleri</h1>
        <p className="mt-4 text-muted-foreground text-lg">Sınırlı kontenjanlı, canlı ve etkileşimli grup eğitimleriyle birlikte öğren.</p>
      </div>
      {loading ? <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
        : items.length === 0 ? <p className="text-muted-foreground py-20 text-center">Yakında yeni canlı eğitimler eklenecek.</p>
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((g) => (
                <Link key={g.group_id} to={`/canli-grup-egitimleri/${g.slug}`} data-testid={`group-card-${g.slug}`} className="group bg-ink-surface border border-white/5 rounded-2xl overflow-hidden hover:border-gold/30 transition-colors duration-300">
                  <div className="relative aspect-video bg-ink overflow-hidden">
                    {g.image && <img src={g.image} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    <span className="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> CANLI</span>
                    {g.low_stock && !g.sold_out && <span className="absolute top-3 right-3 bg-gold text-ink text-[11px] font-bold px-2.5 py-1 rounded-full animate-pulse">Son {g.remaining} kontenjan!</span>}
                    {g.sold_out && <span className="absolute top-3 right-3 bg-secondary text-white text-[11px] font-bold px-2.5 py-1 rounded-full">Doldu</span>}
                  </div>
                  <div className="p-5">
                    <h3 className="font-heading font-semibold text-lg leading-snug line-clamp-2">{g.title}</h3>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {g.start_date ? trDate(g.start_date) : "Yakında"}</span>
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {g.remaining}/{g.capacity} kontenjan</span>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="font-heading font-black text-xl text-gold">{formatPrice(g.price)} ₺</span>
                      <span className="text-sm text-gold flex items-center gap-1 group-hover:gap-2 transition-all">İncele <ArrowRight className="w-4 h-4" /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
    </div>
  );
}
