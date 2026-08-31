import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Video, Users, CalendarDays, Clock, AlertTriangle, CreditCard, User, PlayCircle } from "lucide-react";
import api, { formatPrice, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toEmbed } from "@/lib/video";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" }); } catch { return d; } };

export default function GroupDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [g, setG] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLoading(true); api.get(`/group-trainings/${slug}`).then(({ data }) => { setG(data); document.title = data.title; }).catch(() => setG(null)).finally(() => setLoading(false)); }, [slug]);

  const buy = async () => {
    if (!user) { navigate("/giris"); return; }
    setBusy(true);
    try { const { data } = await api.post(`/group-trainings/${g.group_id}/purchase`); if (data.iframe_url) window.location.href = data.iframe_url; }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!g) return <div className="text-center py-40 text-muted-foreground">Eğitim bulunamadı.</div>;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
      <span className="inline-flex items-center gap-2 overline text-gold"><Video className="w-3.5 h-3.5" /> Canlı · Google Meet</span>
      <h1 className="mt-3 font-heading font-black text-3xl sm:text-4xl tracking-tighter">{g.title}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-ink border border-white/10">
            {g.promo_video ? <iframe title="Tanıtım" src={toEmbed(g.promo_video)} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen data-testid="group-promo" />
              : g.image ? <img src={g.image} alt={g.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><PlayCircle className="w-12 h-12 text-muted-foreground" /></div>}
          </div>
          <div className="bg-ink-surface border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-bold text-xl mb-3">Eğitim Hakkında</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{g.description}</p>
          </div>
          <div className="bg-ink-surface border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-bold text-xl mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-gold" /> Ders Takvimi</h2>
            <div className="space-y-2" data-testid="group-schedule">
              {g.lessons.length === 0 ? <p className="text-sm text-muted-foreground">Program yakında açıklanacak.</p>
                : g.lessons.map((l, i) => (
                  <div key={l.id || i} className="flex items-center justify-between bg-ink border border-white/8 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3"><span className="w-7 h-7 rounded-lg bg-gold/10 text-gold text-xs font-bold flex items-center justify-center">{i + 1}</span><p className="text-sm font-medium">{l.title}</p></div>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 capitalize"><Clock className="w-3.5 h-3.5" /> {trDate(l.date)} · {l.time}</p>
                  </div>
                ))}
            </div>
          </div>
          {g.instructor && (
            <Link to={`/egitmen/${g.instructor.slug}`} className="flex items-center gap-4 bg-gradient-to-br from-gold/10 to-ink-surface border border-gold/15 rounded-2xl p-5 hover:border-gold/40 transition-colors">
              {g.instructor.avatar ? <img src={g.instructor.avatar} alt={g.instructor.name} className="w-16 h-16 rounded-2xl object-cover" /> : <span className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center"><User className="w-7 h-7 text-gold" /></span>}
              <div><p className="font-heading font-semibold">{g.instructor.name}</p>{g.instructor.title && <p className="text-sm text-gold">{g.instructor.title}</p>}</div>
            </Link>
          )}
        </div>

        <div className="lg:sticky lg:top-24 h-fit bg-ink-surface border border-white/10 rounded-2xl p-6">
          <span className="font-heading font-black text-4xl text-gold">{formatPrice(g.price)} ₺</span>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Kontenjan</span><span>{g.capacity} kişi</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Kalan</span><span data-testid="group-remaining" className={g.low_stock ? "text-red-400 font-bold" : "font-medium"}>{g.remaining} kişi</span></div>
          </div>
          {g.low_stock && !g.sold_out && (
            <div data-testid="group-urgency" className="mt-4 flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl px-3 py-2.5 text-sm font-semibold animate-pulse">
              <AlertTriangle className="w-4 h-4" /> Acele et! Son {g.remaining} kontenjan kaldı
            </div>
          )}
          {g.sold_out ? (
            <Button disabled className="w-full mt-6 h-12" data-testid="group-soldout">Kontenjan Doldu</Button>
          ) : (
            <Button onClick={buy} disabled={busy} data-testid="group-buy" className="w-full mt-6 h-12 bg-gold hover:bg-gold-hover text-ink font-bold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4 mr-2" /> Kredi Kartı ile Kaydol</>}
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">Katılım linkleri kayıt sonrası panelinde görünür.</p>
        </div>
      </div>
    </div>
  );
}
