import { useEffect, useState } from "react";
import { Loader2, CalendarDays, Clock, Ticket, CreditCard, CheckCircle2, X, Video } from "lucide-react";
import api, { formatPrice, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const STATUS_STYLE = {
  pending: "bg-gold/15 text-gold border-gold/20",
  approved: "bg-green-500/15 text-green-400 border-green-500/20",
  rejected: "bg-destructive/15 text-red-400 border-destructive/20",
  rescheduled: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  cancelled: "bg-secondary text-muted-foreground",
  completed: "bg-green-500/15 text-green-400 border-green-500/20",
};
const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", weekday: "long" }); } catch { return d; } };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ConsultingPanel() {
  const [data, setData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/consulting/summary").then(({ data }) => setData(data)),
      api.get("/consulting/slots").then(({ data }) => setSlots(data)).catch(() => setSlots([])),
    ]).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const book = async () => {
    setBusy(true);
    try { await api.post("/consulting/book", { date: confirm.date, time: confirm.time }); toast.success("Talebin oluşturuldu, onay bekleniyor"); setConfirm(null); setSelected(null); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  const respond = async (id, action) => { try { await api.post(`/consulting/bookings/${id}/respond`, { action }); toast.success(action === "accept" ? "Önerilen saat onaylandı" : "Öneri reddedildi"); load(); } catch (e) { toast.error(apiError(e)); } };
  const cancel = async (id) => { if (!window.confirm("Bu talebi iptal etmek istiyor musun?")) return; try { await api.post(`/consulting/bookings/${id}/cancel`); toast.success("Talep iptal edildi"); load(); } catch (e) { toast.error(apiError(e)); } };
  const buy = async () => {
    setBusy(true);
    try { const { data } = await api.post("/consulting/purchase"); if (data.iframe_url) window.location.href = data.iframe_url; }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 text-gold animate-spin" /></div>;
  if (!data?.enabled) return <p className="text-muted-foreground text-center py-16">Bire bir danışmanlık şu anda aktif değil.</p>;

  const credits = data.available_credits;
  const byDate = slots.reduce((acc, s) => { (acc[s.date] = acc[s.date] || []).push(s); return acc; }, {});
  const availableDates = Object.keys(byDate);
  const availableSet = new Set(availableDates);
  const selectedIso = selected ? iso(selected) : null;
  const dayTimes = selectedIso ? (byDate[selectedIso] || []) : [];
  const minDate = new Date(); minDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-gold/10 to-ink-surface border border-gold/15 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl bg-gold/15 flex items-center justify-center"><Ticket className="w-7 h-7 text-gold" /></span>
          <div>
            <p className="text-sm text-muted-foreground">Kullanılabilir Danışmanlık Hakkın</p>
            <p className="font-heading font-black text-3xl text-gold" data-testid="consulting-credits">{credits} <span className="text-lg text-foreground">saat</span></p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Video className="w-3.5 h-3.5 text-gold" /> Görüşmeler Google Meet üzerinden yapılır.</p>
          </div>
        </div>
        {data.price > 0 && (
          <Button onClick={buy} disabled={busy} data-testid="buy-consulting" className="bg-gold hover:bg-gold-hover text-ink font-bold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4 mr-2" /> Kredi Kartı ile Hak Al · {formatPrice(data.price)} ₺</>}
          </Button>
        )}
      </div>

      <div>
        <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-gold" /> Randevu Takvimi</h3>
        {credits <= 0 ? (
          <p className="text-sm text-muted-foreground">Randevu oluşturmak için bir eğitim satın alarak veya kredi kartıyla hak alarak danışmanlık hakkı kazanabilirsin.</p>
        ) : availableDates.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="no-slots">Şu an uygun boş zaman dilimi bulunmuyor. Lütfen daha sonra tekrar kontrol et.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-ink-surface border border-white/5 rounded-2xl p-4 flex justify-center" data-testid="consulting-calendar">
              <Calendar mode="single" selected={selected} onSelect={setSelected} fromDate={minDate} toDate={maxDate}
                disabled={(d) => !availableSet.has(iso(d))}
                modifiers={{ available: (d) => availableSet.has(iso(d)) }}
                modifiersClassNames={{ available: "font-bold text-gold" }} />
            </div>
            <div className="bg-ink-surface border border-white/5 rounded-2xl p-5">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Takvimden altın renkli (müsait) bir gün seç.</p>
              ) : dayTimes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu gün için boş saat kalmadı.</p>
              ) : (
                <>
                  <p className="text-sm font-medium mb-3 capitalize">{trDate(selectedIso)}</p>
                  <div className="flex flex-wrap gap-2">
                    {dayTimes.map((s) => (
                      <button key={s.time} onClick={() => setConfirm(s)} data-testid={`slot-${s.date}-${s.time}`}
                        className="px-3 py-2 rounded-lg text-sm bg-ink border border-white/10 hover:border-gold hover:text-gold transition-colors duration-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {s.time}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-heading font-semibold text-lg mb-4">Randevularım</h3>
        {data.bookings.length === 0 ? <p className="text-sm text-muted-foreground">Henüz bir danışmanlık talebin yok.</p> : (
          <div className="space-y-3">
            {data.bookings.map((b) => (
              <div key={b.booking_id} data-testid={`booking-${b.booking_id}`} className="bg-ink-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium capitalize">{trDate(b.date)} · {b.time}</p>
                  {b.status === "rescheduled" && b.proposed_date && <p className="text-xs text-blue-300 mt-1">Önerilen: <span className="capitalize">{trDate(b.proposed_date)}</span> · {b.proposed_time}</p>}
                  {b.admin_note && <p className="text-xs text-muted-foreground mt-1">Not: {b.admin_note}</p>}
                  {["approved", "completed"].includes(b.status) && !b.meet_link && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Google Meet linki randevu saatinden önce burada görünecek.</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={STATUS_STYLE[b.status] || "bg-secondary"}>{b.status_label}</Badge>
                  {["approved", "completed"].includes(b.status) && b.meet_link && (
                    <a href={b.meet_link} target="_blank" rel="noreferrer" data-testid={`consulting-meet-${b.booking_id}`}>
                      <Button size="sm" className="h-8 bg-gold hover:bg-gold-hover text-ink font-semibold"><Video className="w-3.5 h-3.5 mr-1.5" /> Google Meet'e Katıl</Button>
                    </a>
                  )}
                  {b.status === "rescheduled" && (
                    <>
                      <Button size="sm" className="h-8 bg-green-500 hover:bg-green-600 text-white" onClick={() => respond(b.booking_id, "accept")} data-testid={`accept-${b.booking_id}`}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Kabul</Button>
                      <Button size="sm" variant="outline" className="h-8 border-white/15" onClick={() => respond(b.booking_id, "decline")}><X className="w-3.5 h-3.5" /></Button>
                    </>
                  )}
                  {b.status === "pending" && <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => cancel(b.booking_id)}>İptal</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm bg-ink-surface border-white/10">
          <DialogHeader><DialogTitle>Randevu Onayı</DialogTitle></DialogHeader>
          {confirm && <p className="text-sm text-muted-foreground"><span className="capitalize text-foreground font-medium">{trDate(confirm.date)}</span> günü saat <span className="text-foreground font-medium">{confirm.time}</span> için 1 saatlik bire bir danışmanlık talebi oluşturulacak. Onaylıyor musun?</p>}
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" className="border-white/15" onClick={() => setConfirm(null)}>Vazgeç</Button>
            <Button onClick={book} disabled={busy} data-testid="confirm-booking" className="bg-gold hover:bg-gold-hover text-ink font-semibold">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Talep Oluştur"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
