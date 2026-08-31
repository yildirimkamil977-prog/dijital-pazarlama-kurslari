import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, CheckCircle2, XCircle, CalendarClock, Ticket } from "lucide-react";
import api, { formatPrice, formatDate, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06..23
const trDate = (d) => { try { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", weekday: "long" }); } catch { return d; } };
const B_STATUS = { pending: ["Beklemede", "bg-gold/15 text-gold border-gold/20"], approved: ["Onaylandı", "bg-green-500/15 text-green-400 border-green-500/20"], rejected: ["Reddedildi", "bg-destructive/15 text-red-400 border-destructive/20"], rescheduled: ["Öneri Gönderildi", "bg-blue-500/15 text-blue-300 border-blue-500/20"], cancelled: ["İptal", "bg-secondary"], completed: ["Tamamlandı", "bg-green-500/15 text-green-400 border-green-500/20"] };

export default function AdminConsulting() {
  const [cfg, setCfg] = useState({ enabled: true, price: 0, weekly: {} });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposeState, setProposeState] = useState(null); // {id, date, time, note}

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/admin/consulting/config").then(({ data }) => setCfg({ enabled: data.enabled, price: data.price, weekly: data.weekly || {} })),
      api.get("/admin/consulting/bookings").then(({ data }) => setBookings(data)),
    ]).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  };
  useEffect(() => { document.title = "Yönetim - Danışmanlık"; load(); }, []);

  const addRange = (wd) => setCfg((c) => ({ ...c, weekly: { ...c.weekly, [wd]: [...(c.weekly[wd] || []), { start: "10:00", end: "15:00" }] } }));
  const updRange = (wd, i, k, v) => setCfg((c) => { const arr = [...(c.weekly[wd] || [])]; arr[i] = { ...arr[i], [k]: v }; return { ...c, weekly: { ...c.weekly, [wd]: arr } }; });
  const delRange = (wd, i) => setCfg((c) => { const arr = (c.weekly[wd] || []).filter((_, idx) => idx !== i); return { ...c, weekly: { ...c.weekly, [wd]: arr } }; });

  const save = async () => {
    setSaving(true);
    try { await api.put("/admin/consulting/config", { enabled: cfg.enabled, price: Number(cfg.price) || 0, weekly: cfg.weekly }); toast.success("Müsaitlik ayarları kaydedildi"); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const act = async (url, okMsg, body) => { try { await api.post(url, body || {}); toast.success(okMsg); load(); } catch (e) { toast.error(apiError(e)); } };
  const reject = (id) => { const note = window.prompt("Reddetme notu (opsiyonel):", "") ?? ""; act(`/admin/consulting/bookings/${id}/reject`, "Talep reddedildi", { note }); };
  const propose = (id) => setProposeState({ id, date: "", time: "10:00", note: "" });
  const submitPropose = async () => {
    if (!proposeState.date) { toast.error("Lütfen bir tarih seç"); return; }
    try {
      await api.post(`/admin/consulting/bookings/${proposeState.id}/propose`, { date: proposeState.date, time: proposeState.time, note: proposeState.note });
      toast.success("Yeni saat önerildi, öğrenciye e-posta gönderildi"); setProposeState(null); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  const requests = bookings.filter((b) => !["approved", "completed"].includes(b.status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Bire Bir Danışmanlık</h1>
        <p className="text-sm text-muted-foreground mt-1">Müsait gün/saatlerini belirle, talepleri yönet.</p>
      </div>

      {/* Availability config */}
      <div className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: v }))} data-testid="consulting-enabled" />
            <Label>Danışmanlık aktif</Label>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm whitespace-nowrap">1 Saatlik Ücret (₺)</Label>
            <Input type="number" value={cfg.price} onChange={(e) => setCfg((c) => ({ ...c, price: e.target.value }))} className="w-32 bg-ink border-white/10" data-testid="consulting-price" />
          </div>
          <Button onClick={save} disabled={saving} data-testid="save-consulting-config" className="bg-gold hover:bg-gold-hover text-ink font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DAYS.map((day, wd) => (
            <div key={wd} className="bg-ink border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{day}</p>
                <Button size="sm" variant="ghost" className="h-7 text-gold" onClick={() => addRange(String(wd))} data-testid={`add-range-${wd}`}><Plus className="w-3.5 h-3.5 mr-1" /> Aralık</Button>
              </div>
              {(cfg.weekly[String(wd)] || []).length === 0 ? <p className="text-xs text-muted-foreground">Bu gün müsait değil</p> : (
                <div className="space-y-2">
                  {(cfg.weekly[String(wd)] || []).map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select value={r.start} onChange={(e) => updRange(String(wd), i, "start", e.target.value)} className="bg-ink-surface border border-white/10 rounded-md h-9 px-2 text-sm">
                        {HOURS.map((h) => <option key={h} value={`${String(h).padStart(2, "0")}:00`}>{String(h).padStart(2, "0")}:00</option>)}
                      </select>
                      <span className="text-muted-foreground text-sm">–</span>
                      <select value={r.end} onChange={(e) => updRange(String(wd), i, "end", e.target.value)} className="bg-ink-surface border border-white/10 rounded-md h-9 px-2 text-sm">
                        {HOURS.map((h) => <option key={h} value={`${String(h).padStart(2, "0")}:00`}>{String(h).padStart(2, "0")}:00</option>)}
                      </select>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => delRange(String(wd), i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Her aralık 1 saatlik dilimlere bölünür (ör. 10:00–15:00 → 10, 11, 12, 13, 14). Slotlar önümüzdeki 4 hafta için gösterilir.</p>
      </div>

      {/* Bookings */}
      <div>
        <h2 className="font-heading font-bold text-xl mb-4 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-gold" /> Randevu Talepleri</h2>
        <p className="text-xs text-muted-foreground -mt-2 mb-4">Onayladığın danışmanlıklar <strong>Onaylı Danışmanlıklar</strong> sayfasında görünür; Google Meet linkini oradan ekleyebilirsin.</p>
        {requests.length === 0 ? <p className="text-muted-foreground text-sm">Bekleyen talep yok.</p> : (
          <div className="space-y-3">
            {requests.map((b) => {
              const [t, c] = B_STATUS[b.status] || [b.status, "bg-secondary"];
              return (
                <div key={b.booking_id} data-testid={`admin-booking-${b.booking_id}`} className="bg-ink-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">{b.user_name} <span className="text-muted-foreground font-normal">· {b.user_email}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{trDate(b.date)} · {b.time}{b.status === "rescheduled" && b.proposed_date ? ` → Öneri: ${trDate(b.proposed_date)} ${b.proposed_time}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={c}>{t}</Badge>
                    {["pending", "rescheduled"].includes(b.status) && (
                      <>
                        <Button size="sm" className="h-8 bg-green-500 hover:bg-green-600 text-white" onClick={() => act(`/admin/consulting/bookings/${b.booking_id}/approve`, "Onaylandı")} data-testid={`approve-booking-${b.booking_id}`}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Onayla</Button>
                        <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={() => propose(b.booking_id)} data-testid={`propose-booking-${b.booking_id}`}>Farklı Saat Öner</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => reject(b.booking_id)} data-testid={`reject-booking-${b.booking_id}`}><XCircle className="w-3.5 h-3.5 mr-1" /> Reddet</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Propose modal */}
      <Dialog open={!!proposeState} onOpenChange={(o) => !o && setProposeState(null)}>
        <DialogContent className="max-w-sm bg-ink-surface border-white/10">
          <DialogHeader><DialogTitle>Farklı Gün ve Saat Öner</DialogTitle></DialogHeader>
          {proposeState && (
            <div className="space-y-3">
              <div><Label className="text-sm">Tarih</Label><Input type="date" value={proposeState.date} onChange={(e) => setProposeState((s) => ({ ...s, date: e.target.value }))} className="mt-1.5 bg-ink border-white/10" data-testid="propose-date" /></div>
              <div><Label className="text-sm">Saat</Label>
                <select value={proposeState.time} onChange={(e) => setProposeState((s) => ({ ...s, time: e.target.value }))} className="w-full bg-ink border border-white/10 rounded-md h-10 px-3 mt-1.5 text-sm" data-testid="propose-time">
                  {HOURS.map((h) => <option key={h} value={`${String(h).padStart(2, "0")}:00`}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </div>
              <div><Label className="text-sm">Not (opsiyonel)</Label><Input value={proposeState.note} onChange={(e) => setProposeState((s) => ({ ...s, note: e.target.value }))} className="mt-1.5 bg-ink border-white/10" placeholder="Öğrenciye iletilecek not" data-testid="propose-note" /></div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" className="border-white/15" onClick={() => setProposeState(null)}>Vazgeç</Button>
                <Button onClick={submitPropose} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="submit-propose">Öner ve Bildir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
