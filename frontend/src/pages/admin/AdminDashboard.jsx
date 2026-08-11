import { useEffect, useState } from "react";
import { Users, BookOpen, CreditCard, TrendingUp, Loader2, CheckCircle2 } from "lucide-react";
import api, { formatPrice, formatDate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { document.title = "Yönetim - Genel Bakış"; api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {}); }, []);
  if (!stats) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  const cards = [
    { label: "Toplam Gelir", value: `${formatPrice(stats.revenue)} ₺`, icon: TrendingUp },
    { label: "Öğrenci", value: stats.total_students, icon: Users },
    { label: "Kurs", value: `${stats.published_courses}/${stats.total_courses}`, icon: BookOpen },
    { label: "Satış", value: stats.total_sales, icon: CreditCard },
  ];

  return (
    <div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter mb-8">Genel Bakış</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="bg-ink-surface border border-white/5 rounded-2xl p-6">
            <c.icon className="w-5 h-5 text-gold" />
            <p className="font-heading font-black text-3xl mt-4">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <h2 className="font-heading font-semibold text-lg mb-4">Son Siparişler</h2>
      <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
        {stats.recent_orders.length === 0 ? <p className="text-muted-foreground text-center py-12 text-sm">Henüz sipariş yok.</p> : (
          <div className="divide-y divide-white/5">
            {stats.recent_orders.map((o) => (
              <div key={o.order_id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{o.user_name || o.user_email}</p>
                  <p className="text-xs text-muted-foreground">{o.items?.map((i) => i.title).join(", ")} · {formatDate(o.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-heading font-bold text-gold text-sm">{formatPrice(o.total)} ₺</span>
                  <Badge className={o.status === "paid" ? "bg-green-500/15 text-green-400 border-green-500/20" : "bg-gold/15 text-gold border-gold/20"}>{o.status === "paid" ? "Ödendi" : o.status === "pending" ? "Bekliyor" : "Başarısız"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
