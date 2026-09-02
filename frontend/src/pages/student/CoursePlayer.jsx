import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Circle, ChevronLeft, Download, FileText, Menu, X, Award, PlayCircle } from "lucide-react";
import api, { apiError, formatDuration } from "@/lib/api";
import { toEmbed } from "@/lib/video";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function CoursePlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [sidebar, setSidebar] = useState(true);

  const flatLessons = data ? data.modules.flatMap((m) => m.lessons) : [];

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/my/courses/${courseId}/player`);
      setData(data);
      const all = data.modules.flatMap((m) => m.lessons);
      const firstIncomplete = all.find((l) => !l.completed) || all[0];
      setActive((prev) => prev || firstIncomplete);
      document.title = `${data.title} - İzle`;
    } catch (e) {
      toast.error(apiError(e, "Eğitime erişilemedi"));
      navigate("/panel");
    } finally { setLoading(false); }
  }, [courseId, navigate]);

  useEffect(() => { load(); }, [load]);

  const markComplete = async () => {
    if (!active) return;
    try {
      const { data: res } = await api.post("/my/progress", { course_id: courseId, lesson_id: active.id, completed: true });
      toast.success("Ders tamamlandı olarak işaretlendi");
      if (res.certificate_issued) toast.success("🎓 Tebrikler! Katılım belgeni kazandın.", { duration: 6000 });
      await load();
      const idx = flatLessons.findIndex((l) => l.id === active.id);
      const next = flatLessons[idx + 1];
      if (next) setActive({ ...next, completed: true });
    } catch (e) { toast.error(apiError(e)); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="glass border-b border-white/10 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/panel" className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200" data-testid="player-back"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <h1 className="font-heading font-semibold text-sm sm:text-base truncate">{data.title}</h1>
            <p className="text-xs text-muted-foreground">%{data.progress_pct} tamamlandı · {data.completed_lessons}/{data.lesson_count} ders</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block w-32"><Progress value={data.progress_pct} className="h-1.5" /></div>
          <button onClick={() => setSidebar(!sidebar)} className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200 lg:hidden" data-testid="toggle-sidebar">
            {sidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="relative bg-black aspect-video max-h-[70vh] w-full select-none" onContextMenu={(e) => e.preventDefault()} data-testid="player-video-area">
            {active?.video_url ? (
              <iframe key={active.id} title={active.title} src={toEmbed(active.video_url)} referrerPolicy="no-referrer" className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen data-testid="lesson-video" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground"><PlayCircle className="w-12 h-12" /></div>
            )}
            {user && (
              <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] text-white/10 text-2xl sm:text-4xl font-bold whitespace-nowrap select-none">{user.email}</span>
                <span className="absolute bottom-3 right-3 text-white/30 text-[11px] font-mono bg-black/30 px-2 py-0.5 rounded" data-testid="video-watermark">{user.email}</span>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-8 max-w-3xl">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-heading font-bold text-xl sm:text-2xl tracking-tight">{active?.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{formatDuration(active?.duration_seconds)}</p>
              </div>
              <Button onClick={markComplete} data-testid="mark-complete" disabled={active?.completed}
                className={active?.completed ? "bg-green-500/15 text-green-400 hover:bg-green-500/15" : "bg-gold hover:bg-gold-hover text-ink font-semibold"}>
                {active?.completed ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Tamamlandı</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Tamamlandı İşaretle</>}
              </Button>
            </div>

            {active?.description && (
              <div className="mt-6">
                <h3 className="overline text-gold mb-2">Ders Açıklaması</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{active.description}</p>
              </div>
            )}

            {active?.notes && (
              <div className="mt-8 bg-ink-surface border border-white/5 rounded-2xl p-6">
                <h3 className="overline text-gold mb-3">Ders Notları</h3>
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{active.notes}</div>
              </div>
            )}

            {active?.resources?.length > 0 && (
              <div className="mt-8">
                <h3 className="overline text-gold mb-3">Kaynaklar</h3>
                <div className="space-y-2">
                  {active.resources.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noreferrer" download data-testid={`resource-${i}`}
                      className="flex items-center justify-between bg-ink-surface border border-white/5 rounded-xl p-4 hover:border-gold/30 transition-colors duration-200 group">
                      <span className="flex items-center gap-3 text-sm"><FileText className="w-4 h-4 text-gold" /> {r.name}</span>
                      <Download className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors duration-200" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {data.certificate && (
              <div className="mt-8 bg-gradient-to-br from-gold/15 to-ink-surface border border-gold/20 rounded-2xl p-6 flex items-center gap-4">
                <Award className="w-9 h-9 text-gold shrink-0" />
                <div>
                  <p className="font-heading font-semibold">Bu eğitimi tamamladın!</p>
                  <p className="text-sm text-muted-foreground">Belge kodu: <span className="font-mono">{data.certificate.code}</span></p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {sidebar && (
          <motion.aside initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="w-full lg:w-80 shrink-0 border-l border-white/10 bg-ink-surface/50 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] overflow-y-auto absolute lg:relative inset-y-0 right-0 z-30 lg:z-0">
            <div className="p-4">
              <h3 className="overline text-gold mb-4 px-2">Müfredat</h3>
              {data.modules.map((m, mi) => (
                <div key={m.id} className="mb-5">
                  <p className="text-xs font-semibold text-muted-foreground px-2 mb-2">{mi + 1}. {m.title}</p>
                  <ul className="space-y-0.5">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <button onClick={() => { setActive(l); if (window.innerWidth < 1024) setSidebar(false); }} data-testid={`lesson-item-${l.id}`}
                          className={`w-full flex items-start gap-3 text-left p-2.5 rounded-lg transition-colors duration-200 ${active?.id === l.id ? "bg-gold/10 text-gold" : "hover:bg-secondary/50 text-foreground/80"}`}>
                          {l.completed ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                          <span className="text-sm leading-snug flex-1">{l.title}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatDuration(l.duration_seconds)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}
