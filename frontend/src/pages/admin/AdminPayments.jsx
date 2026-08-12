import { useEffect, useState, useRef } from "react";
import { Loader2, Upload, FileText, Trash2, Download, CheckCircle2 } from "lucide-react";
import api, { formatPrice, formatDate, apiError, API } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const [uploading, setUploading] = useState(null);
  const fileRefs = useRef({});

  const load = () => api.get("/admin/payments").then(({ data }) => setOrders(data)).finally(() => setLoading(false));
  useEffect(() => { document.title = "Yönetim - Ödemeler"; load(); }, []);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const revenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + (o.total || 0), 0);

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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Ödemeler</h1>
        <div className="text-right"><p className="text-xs text-muted-foreground">Toplam Gelir</p><p className="font-heading font-black text-2xl text-gold">{formatPrice(revenue)} ₺</p></div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[["all", "Tümü"], ["awaiting_transfer", "Havale Bekleyen"], ["paid", "Ödendi"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`payment-filter-${k}`} className={`px-4 py-2 rounded-full text-sm ${filter === k ? "bg-gold text-ink" : "bg-ink-surface border border-white/10 text-muted-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? <p className="text-muted-foreground text-center py-16">Kayıt bulunamadı.</p> : (
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
    </div>
  );
}
