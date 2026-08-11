import { useEffect, useState } from "react";
import { Users, BookOpen, CreditCard, TrendingUp, Loader2, Clock, GraduationCap } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api, { formatPrice, formatDate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const ChartTip = ({ active, payload, label, suffix }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-ink-elevated border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-gold">{payload[0].value}{suffix}</p>
    </div>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { document.title = "Yönetim - Genel Bakış"; api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {}); }, []);
  if (!stats) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  const cards = [
    { label: "Toplam Gelir", value: `${formatPrice(stats.revenue)} ₺`, icon: TrendingUp, sub: `${stats.total_sales} satış` },
    { label: "Öğrenci", value: stats.total_students, icon: Users, sub: `${stats.total_enrollments} kayıt` },
    { label: "Kurs", value: `${stats.published_courses}/${stats.total_courses}`, icon: BookOpen, sub: "yayında/toplam" },
    { label: "Bekleyen", value: stats.pending_count, icon: Clock, sub: "ödeme" },
  ];

  return (
    <div>
      <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter mb-8">Genel Bakış</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="relative bg-ink-surface border border-white/5 rounded-2xl p-6 overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-gold/5 rounded-full blur-2xl" />
            <c.icon className="w-5 h-5 text-gold" />
            <p className="font-heading font-black text-3xl mt-4">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-1">Gelir (Son 14 Gün)</h2>
          <p className="text-xs text-muted-foreground mb-4">Günlük tahsil edilen tutar</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.timeseries} margin={{ left: -20, right: 8 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFB800" stopOpacity={0.5} /><stop offset="100%" stopColor="#FFB800" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip suffix=" ₺" />} />
              <Area type="monotone" dataKey="revenue" stroke="#FFB800" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-1">En Popüler Eğitimler</h2>
          <p className="text-xs text-muted-foreground mb-4">Kayıt sayısına göre</p>
          {stats.top_courses.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Henüz veri yok.</p> : (
            <div className="space-y-3">
              {stats.top_courses.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-gold/10 text-gold text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm truncate">{t.title}</p></div>
                  <Badge className="bg-secondary shrink-0">{t.enrollments}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="font-heading font-semibold text-lg mb-4">Son Siparişler</h2>
      <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
        {stats.recent_orders.length === 0 ? <p className="text-muted-foreground text-center py-12 text-sm">Henüz sipariş yok.</p> : (
          <div className="divide-y divide-white/5">
            {stats.recent_orders.map((o) => (
              <div key={o.order_id} className="flex items-center justify-between p-4">
                <div><p className="text-sm font-medium">{o.user_name || o.user_email}</p>
                  <p className="text-xs text-muted-foreground">{o.items?.map((i) => i.title).join(", ")} · {formatDate(o.created_at)}</p></div>
                <div className="flex items-center gap-3">
                  <span className="font-heading font-bold text-gold text-sm">{formatPrice(o.total)} ₺</span>
                  <Badge className={o.status === "paid" ? "bg-green-500/15 text-green-400 border-green-500/20" : o.status === "pending" ? "bg-gold/15 text-gold border-gold/20" : "bg-destructive/15 text-red-400 border-destructive/20"}>{o.status === "paid" ? "Ödendi" : o.status === "pending" ? "Bekliyor" : "Başarısız"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
