import { useEffect, useState } from "react";
import { Loader2, Video, CalendarClock, ExternalLink, Save, CheckCircle2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" }); } catch { return d; } };
const STATUS = { approved: ["Onaylandı", "bg-green-500/15 text-green-400 border-green-500/20"], completed: ["Tamamlandı", "bg-green-500/15 text-green-400 border-green-500/20"] };

export default function AdminApprovedConsulting() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/consulting/bookings")
      .then(({ data }) => {
        const approved = data.filter((b) => ["approved", "completed"].includes(b.status));
        setItems(approved);
        setLinks(Object.fromEntries(approved.map((b) => [b.booking_id, b.meet_link || ""])));
      })
      .catch((e) => toast.error(apiError(e))).finally(() => setLoading(false));
  };
  useEffect(() => { document.title = "Yönetim - Onaylı Danışmanlıklar"; load(); }, []);

  const saveMeet = async (id) => {
    setSavingId(id);
    try {
      await api.post(`/admin/consulting/bookings/${id}/meet`, { meet_link: links[id] || "" });
      toast.success((links[id] || "").trim() ? "Google Meet linki kaydedildi ve öğrenciye bildirildi" : "Link temizlendi");
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setSavingId(null); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Onaylı Danışmanlıklar</h1>
        <p className="text-sm text-muted-foreground mt-1">Onayladığın bire bir danışmanlıklar. Her görüşme için Google Meet linki ekle; kaydedince öğrenciye otomatik e-posta gönderilir.</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-ink-surface border border-white/5 rounded-2xl">
          <CalendarClock className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground mt-4">Henüz onaylanmış danışmanlık yok.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((b) => {
            const [t, c] = STATUS[b.status] || [b.status, "bg-secondary"];
            return (
              <div key={b.booking_id} data-testid={`approved-booking-${b.booking_id}`} className="bg-ink-surface border border-white/8 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">{b.user_name} <span className="text-muted-foreground font-normal">· {b.user_email}</span></p>
                    <p className="text-xs text-muted-foreground mt-1 capitalize flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> {trDate(b.date)} · {b.time}</p>
                  </div>
                  <Badge className={c}>{t}</Badge>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <label className="text-xs font-medium text-gold flex items-center gap-1.5 mb-2"><Video className="w-4 h-4" /> Google Meet Katılım Linki</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                      <Video className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={links[b.booking_id] || ""} onChange={(e) => setLinks((l) => ({ ...l, [b.booking_id]: e.target.value }))}
                        placeholder="https://meet.google.com/xxx-xxxx-xxx" className="bg-ink border-white/10 pl-9" data-testid={`meet-input-${b.booking_id}`} />
                    </div>
                    <Button onClick={() => saveMeet(b.booking_id)} disabled={savingId === b.booking_id} data-testid={`save-meet-${b.booking_id}`} className="bg-gold hover:bg-gold-hover text-ink font-semibold">
                      {savingId === b.booking_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet & Bildir</>}
                    </Button>
                    {b.meet_link && (
                      <a href={b.meet_link} target="_blank" rel="noreferrer" data-testid={`open-meet-${b.booking_id}`}>
                        <Button variant="outline" className="border-white/15"><ExternalLink className="w-4 h-4 mr-2" /> Meet'i Aç</Button>
                      </a>
                    )}
                  </div>
                  {b.meet_link && <p className="text-xs text-green-400 mt-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Link öğrenci paneline eklendi ve bildirildi.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
