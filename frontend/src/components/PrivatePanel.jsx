import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Video, HardDriveDownload, MessageCircleQuestion, PhoneCall } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/api";

export default function PrivatePanel() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/my/private-trainings").then(({ data }) => setList(data)).catch(() => setList([])); }, []);
  if (!list) return null;
  if (list.length === 0) return <p className="text-muted-foreground text-center py-16">Henüz bir bire bir eğitimin yok. <Link to="/bire-bir-canli-egitimler" className="text-gold">Bire bir eğitimleri incele</Link></p>;
  return (
    <div className="space-y-5" data-testid="private-panel">
      {list.map((e) => (
        <div key={e.enr_id} className="bg-ink-surface border border-white/5 rounded-2xl p-6" data-testid={`my-private-${e.private_id}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[11px] text-gold font-bold uppercase tracking-wider">Bire Bir Canlı Eğitim</p><h3 className="font-heading font-bold text-lg mt-1">{e.title}</h3><p className="text-xs text-muted-foreground mt-1">{e.lesson_count} ders · {e.lesson_duration} · Google Meet</p></div>
            {e.questions_until ? <span className="inline-flex items-center gap-1.5 text-xs bg-gold/10 text-gold border border-gold/20 rounded-full px-3 py-1" data-testid="private-questions-until"><MessageCircleQuestion className="w-3.5 h-3.5" /> Soru hakkı: {formatDate(e.questions_until)} tarihine kadar</span> : null}
          </div>
          {e.recordings.length === 0 && <p className="text-sm text-muted-foreground mt-4 flex items-start gap-2"><PhoneCall className="w-4 h-4 text-gold mt-0.5 shrink-0" /> Ders programını planlamak için seninle iletişime geçeceğiz. Ders kayıtların burada görünecek.</p>}
          {e.recordings.length > 0 && (
            <div className="mt-5"><p className="text-sm font-semibold flex items-center gap-2 mb-3"><HardDriveDownload className="w-4 h-4 text-gold" /> Ders Kayıtların</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {e.recordings.map((r, i) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-ink border border-white/5 rounded-lg p-3 hover:border-gold/30 transition-colors duration-200" data-testid={`private-recording-${i}`}><Video className="w-4 h-4 text-gold shrink-0" /><span className="text-sm truncate">{r.title || `${i + 1}. Ders`}</span>{r.date && <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{formatDate(r.date)}</span>}</a>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
