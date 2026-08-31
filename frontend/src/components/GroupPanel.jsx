import { useEffect, useState } from "react";
import { Loader2, Video, CalendarDays, Clock, ExternalLink, Users, PlayCircle } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" }); } catch { return d; } };
const isPast = (d, t) => { try { return new Date(`${d}T${t || "00:00"}:00`) < new Date(); } catch { return false; } };

export default function GroupPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/my/group-trainings").then(({ data }) => setItems(data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 text-gold animate-spin" /></div>;
  if (items.length === 0) return <p className="text-muted-foreground text-center py-16" data-testid="no-group">Henüz bir canlı grup eğitimine kayıtlı değilsin.</p>;

  return (
    <div className="space-y-6">
      {items.map((g) => (
        <div key={g.group_id} data-testid={`my-group-${g.group_id}`} className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-400"><Video className="w-3.5 h-3.5" /> CANLI · Google Meet</span>
              <h3 className="font-heading font-bold text-xl mt-1">{g.title}</h3>
              {g.instructor && <p className="text-sm text-muted-foreground mt-1">Eğitmen: {g.instructor.name}</p>}
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {g.enrolled} katılımcı</span>
          </div>
          <div className="p-6">
            <p className="text-sm font-medium mb-4 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-gold" /> Ders Takvimi</p>
            <div className="space-y-2">
              {g.lessons.map((l, i) => {
                const past = isPast(l.date, l.time);
                return (
                  <div key={l.id || i} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${past ? "border-white/5 opacity-60" : "border-white/10 bg-ink"}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 capitalize"><Clock className="w-3 h-3" /> {trDate(l.date)} · {l.time}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {l.recording_url && (
                        <a href={l.recording_url} target="_blank" rel="noreferrer" data-testid={`recording-link-${l.id}`}>
                          <Button size="sm" variant="outline" className="border-white/15 h-8"><PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Kaydı İzle</Button>
                        </a>
                      )}
                      {l.meet_link ? (
                        <a href={l.meet_link} target="_blank" rel="noreferrer" data-testid={`meet-link-${l.id}`}>
                          <Button size="sm" disabled={past} className="bg-gold hover:bg-gold-hover text-ink font-semibold h-8"><ExternalLink className="w-3.5 h-3.5 mr-1.5" /> {past ? "Tamamlandı" : "Katıl"}</Button>
                        </a>
                      ) : !l.recording_url ? <span className="text-xs text-muted-foreground">Link yakında eklenecek</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
