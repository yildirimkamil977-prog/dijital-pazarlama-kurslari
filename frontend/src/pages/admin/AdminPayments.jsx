import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Loader2, Upload, Trash2, Download, CheckCircle2, Search, TrendingUp, ShoppingBag, Wallet, Clock, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api, { formatPrice, formatDate, apiError, API } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const statusMap = {
  paid: ["Ödendi", "bg-green-500/15 text-green-400 border-green-500/20"],
  awaiting_transfer: ["Havale Bekleniyor", "bg-blue-500/15 text-blue-300 border-blue-500/20"],
  pending: ["Bekliyor", "bg-gold/15 text-gold border-gold/20"],
  failed: ["Başarısız", "bg-destructive/15 text-red-400 border-destructive/20"],
  token_failed: ["Token Hatası", "bg-destructive/15 text-red-400 border-destructive/20"],
};

const toISODate = (d) => d.toISOString().slice(0, 10);
const presets = [
  ["all", "Tümü"],
  ["7", "Son 7 Gün"],
  ["30", "Son 30 Gün"],
  ["month", "Bu Ay"],
];

export default function AdminPayments() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [preset, setPreset] = useState("all");
  const [uploading, setUploading] = useState(null);
  const fileRefs = useRef({});

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (debounced.trim()) params.search = debounced.trim();
    api.get("/admin/payments", { params }).then(({ data }) => setOrders(data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  }, [startDate, endDate, debounced]);

  useEffect(() => { document.title = "Yönetim - Ödemeler"; }, []);
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { load(); }, [load]);

  const applyPreset = (key) => {
    setPreset(key);
    const now = new Date();
    if (key === "all") { setStartDate(""); setEndDate(""); return; }
    if (key === "month") {
      setStartDate(toISODate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(toISODate(now));
      return;
    }
    const days = parseInt(key, 10);
    const start = new Date(now); start.setDate(now.getDate() - days + 1);
    setStartDate(toISODate(start)); setEndDate(toISODate(now));
  };

  const clearFilters = () => { setSearch(""); setStartDate(""); setEndDate(""); setPreset("all"); setStatusFilter("all"); };

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  const analytics = useMemo(() => {
    const paid = orders.filter((o) => o.status === "paid");
    const revenue = paid.reduce((s, o) => s + (o.total || 0), 0);
    const awaiting = orders.filter((o) => o.status === "awaiting_transfer");
    const awaitingTotal = awaiting.reduce((s, o) => s + (o.total || 0), 0);
    const byDay = {};
    paid.forEach((o) => {
      const day = (o.created_at || "").slice(0, 10);
      if (!day) return;
      byDay[day] = (byDay[day] || 0) + (o.total || 0);
    });
    const timeseries = Object.keys(byDay).sort().map((d) => ({
      date: d.slice(5).replace("-", "/"),
      revenue: Math.round(byDay[d]),
    }));
    return {
      revenue, orderCount: paid.length,
      avg: paid.length ? revenue / paid.length : 0,
      awaitingCount: awaiting.length, awaitingTotal, timeseries,
    };
  }, [orders]);

  const upload = async (orderId, file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Lütfen PDF dosyası yükleyin"); return; }
    setUploading(orderId);
    const fd = new FormData(); fd.append("file", file);
    try { await api.post(`/admin/payments/${orderId}/invoice`, fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Fatura yüklendi, öğrenciye bildirildi"); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setUploading(null); }
  };

  const removeInvoice = async (orderId) => { await api.delete(`/admin/payments/${orderId}/invoice`); toast.success("Fatura kaldırıldı"); load(); };

  const approve = async (orderId) => {
    if (!window.confirm("Havale ödemesi onaylanacak ve öğrencinin eğitim erişimi açılacak. Onaylıyor musunuz?")) return;
    try { await api.post(`/admin/payments/${orderId}/mark-paid`); toast.success("Ödeme onaylandı, öğrenci kaydedildi"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const stats = [
    { icon: Wallet, label: "Toplam Gelir", value: `${formatPrice(analytics.revenue)} ₺`, tone: "text-gold", testid: "stat-revenue" },
    { icon: ShoppingBag, label: "Ödenen Sipariş", value: analytics.orderCount, tone: "text-green-400", testid: "stat-orders" },
    { icon: TrendingUp, label: "Ortalama Sepet", value: `${formatPrice(analytics.avg)} ₺`, tone: "text-white", testid: "stat-avg" },
    { icon: Clock, label: "Havale Bekleyen", value: `${analytics.awaitingCount} · ${formatPrice(analytics.awaitingTotal)} ₺`, tone: "text-blue-300", testid: "stat-awaiting" },
  ];

  const hasFilters = search || startDate || endDate || statusFilter !== "all";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Ödemeler & Gelir Analizi</h1>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((s) => (
          <div key={s.testid} data-testid={s.testid} className="bg-ink-surface border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><s.icon className="w-4 h-4" /> {s.label}</div>
            <p className={`font-heading font-black text-lg sm:text-xl ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-ink-surface border border-white/5 rounded-2xl p-4 mb-6" data-testid="revenue-chart">
        <p className="text-sm font-medium mb-3 text-muted-foreground">Günlük Gelir {startDate || endDate ? "(seçili aralık)" : ""}</p>
        {analytics.timeseries.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 text-sm">Bu aralıkta gelir verisi yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.timeseries} margin={{ left: -20, right: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFB800" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FFB800" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#8a8a8a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8a8a8a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#14141a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} labelStyle={{ color: "#fff" }} formatter={(v) => [`${formatPrice(v)} ₺`, "Gelir"]} />
              <Area type="monotone" dataKey="revenue" stroke="#FFB800" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Filters */}
      <div className="bg-ink-surface border border-white/5 rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="payment-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Öğrenci adı, e-posta veya sipariş no..." className="pl-9 bg-ink border-white/10" />
          </div>
          <div className="flex items-center gap-2">
            <Input data-testid="payment-start-date" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPreset(""); }} className="bg-ink border-white/10 w-[150px]" />
            <span className="text-muted-foreground text-sm">–</span>
            <Input data-testid="payment-end-date" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPreset(""); }} className="bg-ink border-white/10 w-[150px]" />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="clear-filters" className="text-muted-foreground"><X className="w-4 h-4 mr-1" /> Temizle</Button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {presets.map(([k, l]) => (
            <button key={k} onClick={() => applyPreset(k)} data-testid={`preset-${k}`} className={`px-3 py-1.5 rounded-full text-xs ${preset === k ? "bg-gold text-ink" : "bg-ink border border-white/10 text-muted-foreground"}`}>{l}</button>
          ))}
          <div className="w-px bg-white/10 mx-1" />
          {[["all", "Tüm Durumlar"], ["awaiting_transfer", "Havale Bekleyen"], ["paid", "Ödendi"]].map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)} data-testid={`payment-filter-${k}`} className={`px-3 py-1.5 rounded-full text-xs ${statusFilter === k ? "bg-white text-ink" : "bg-ink border border-white/10 text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
      ) : (
        <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? <p className="text-muted-foreground text-center py-16" data-testid="no-payments">Kayıt bulunamadı.</p> : (
            <div className="divide-y divide-white/5">
              {filtered.map((o) => {
                const [t, c] = statusMap[o.status] || [o.status, "bg-secondary"];
                return (
                  <div key={o.order_id} className="flex items-center justify-between p-4 gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{o.user_name || o.user_email}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.items?.map((i) => i.title).join(", ")}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">#{o.order_id} · {formatDate(o.created_at)}{o.discount_code ? ` · Kod: ${o.discount_code}` : ""}{o.payment_method === "transfer" ? " · Havale/EFT" : ""}</p>
                      {o.status === "awaiting_transfer" && o.transfer_notified && (
                        <div className="mt-2 text-[11px] bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5 text-blue-300" data-testid={`transfer-notification-${o.order_id}`}>
                          <span className="font-semibold">Havale bildirimi alındı</span>
                          {o.transfer_notification && (o.transfer_notification.sender_name || o.transfer_notification.amount || o.transfer_notification.transfer_date) && (
                            <span> · {[o.transfer_notification.sender_name, o.transfer_notification.amount && `${o.transfer_notification.amount} ₺`, o.transfer_notification.transfer_date].filter(Boolean).join(" · ")}</span>
                          )}
                          {o.transfer_notification?.note && <span className="block text-blue-300/80 mt-0.5">Not: {o.transfer_notification.note}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right"><p className="font-heading font-bold text-gold">{formatPrice(o.total)} ₺</p><Badge className={`${c} mt-1`}>{t}</Badge></div>
                      {o.status === "awaiting_transfer" && (
                        <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white font-semibold h-8" onClick={() => approve(o.order_id)} data-testid={`approve-transfer-${o.order_id}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Onayla
                        </Button>
                      )}
                      {o.status === "paid" && (
                        <div className="flex items-center gap-2">
                          <input type="file" accept="application/pdf" className="hidden" ref={(el) => (fileRefs.current[o.order_id] = el)} onChange={(e) => upload(o.order_id, e.target.files[0])} />
                          {o.has_invoice ? (
                            <>
                              <a href={`${API}/my/invoice/${o.order_id}`} target="_blank" rel="noreferrer" className="text-xs text-gold border border-gold/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Fatura</a>
                              <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => removeInvoice(o.order_id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" className="border-white/15 h-8" disabled={uploading === o.order_id} onClick={() => fileRefs.current[o.order_id]?.click()} data-testid={`upload-invoice-${o.order_id}`}>
                              {uploading === o.order_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Fatura Yükle</>}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
