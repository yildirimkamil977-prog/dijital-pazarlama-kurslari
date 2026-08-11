import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api, { formatPrice, formatDate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const statusMap = {
  paid: ["Ödendi", "bg-green-500/15 text-green-400 border-green-500/20"],
  pending: ["Bekliyor", "bg-gold/15 text-gold border-gold/20"],
  failed: ["Başarısız", "bg-destructive/15 text-red-400 border-destructive/20"],
  token_failed: ["Token Hatası", "bg-destructive/15 text-red-400 border-destructive/20"],
};

export default function AdminPayments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => { document.title = "Yönetim - Ödemeler"; api.get("/admin/payments").then(({ data }) => setOrders(data)).finally(() => setLoading(false)); }, []);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + (o.total || 0), 0);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Ödemeler</h1>
        <div className="text-right"><p className="text-xs text-muted-foreground">Toplam Gelir</p><p className="font-heading font-black text-2xl text-gold">{formatPrice(revenue)} ₺</p></div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[["all", "Tümü"], ["paid", "Ödendi"], ["pending", "Bekliyor"], ["failed", "Başarısız"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`payment-filter-${k}`} className={`px-4 py-2 rounded-full text-sm ${filter === k ? "bg-gold text-ink" : "bg-ink-surface border border-white/10 text-muted-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? <p className="text-muted-foreground text-center py-16">Kayıt bulunamadı.</p> : (
          <div className="divide-y divide-white/5">
            {filtered.map((o) => {
              const [t, c] = statusMap[o.status] || [o.status, "bg-secondary"];
              return (
                <div key={o.order_id} className="flex items-center justify-between p-4 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.user_name || o.user_email}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.items?.map((i) => i.title).join(", ")}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">#{o.order_id} · {formatDate(o.created_at)}{o.discount_code ? ` · Kod: ${o.discount_code}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-heading font-bold text-gold">{formatPrice(o.total)} ₺</p>
                    <Badge className={`${c} mt-1`}>{t}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
