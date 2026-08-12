import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, Radio, FileText, Award, MessageCircle, CheckCircle2, Play, Star, TrendingUp, Target, Zap, LayoutDashboard } from "lucide-react";
import api from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/CourseCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const perks = [
  { icon: MessageCircle, title: "1 Saat Ücretsiz Danışmanlık", text: "Başlamadan önce hedeflerini netleştir, sana uygun eğitim yolunu birlikte planlayalım." },
  { icon: Users, title: "Özel Telegram Topluluğu", text: "Sadece eğitim değil; beraber ilerleyen bir topluluğa dahil ol, network kur." },
  { icon: Radio, title: "Her Ay Canlı Yayın", text: "Güncel konulara aylık canlı yayınlarla dokun, sorularını anında sor." },
  { icon: FileText, title: "Onlarca Şablon & Checklist", text: "Uygulamada hız kazandıran hazır yapılar ve kontrol listeleriyle daha hızlı sonuç al." },
  { icon: Award, title: "Doğrulanabilir Sertifika", text: "Eğitimi tamamladığında QR kod ile doğrulanabilen bir başarı sertifikası kazan." },
  { icon: Sparkles, title: "Ömür Boyu Güncel Erişim", text: "Yeni eklenen tüm derslere ve kaynaklara ek ücret ödemeden erişmeye devam et." },
];
const brandLogos = [
  { name: "Google Ads", slug: "googleads" },
  { name: "Meta", slug: "meta" },
  { name: "TikTok", slug: "tiktok" },
  { name: "Google Analytics", slug: "googleanalytics" },
  { name: "Tag Manager", slug: "googletagmanager" },
  { name: "Semrush", slug: "semrush" },
  { name: "Ahrefs", slug: "ahrefs" },
  { name: "HubSpot", slug: "hubspot" },
  { name: "Mailchimp", slug: "mailchimp" },
  { name: "WordPress", slug: "wordpress" },
];
const outcomes = [
  { icon: TrendingUp, stat: "%40", label: "ortalama reklam maliyeti düşüşü" },
  { icon: Target, stat: "3x", label: "organik trafik artışı" },
  { icon: Zap, stat: "13+", label: "yıllık saha tecrübesi" },
];
const faqs = [
  { q: "Eğitimler nasıl gerçekleşiyor?", a: "Eğitimi satın aldıktan sonra öğrenci paneline giriş yaparak dilediğin zaman, dilediğin cihazdan izlemeye başlayabilirsin." },
  { q: "Eğitimlere ne kadar süre erişebilirim?", a: "Eğitimlere ömür boyu erişebilirsin. Yeni eklenen derslere ve kaynaklara da ücretsiz olarak erişmeye devam edersin." },
  { q: "Eğitimler hangi seviyeye uygun?", a: "Eğitimler sıfırdan başlar; kurulumlardan ileri seviye stratejilere kadar uygulamalı olarak ilerler. Ön bilgi gerekmez." },
  { q: "Sertifika veriyor musunuz?", a: "Evet. Eğitimi tamamladığında QR kod ile doğrulanabilen bir başarı sertifikası almaya hak kazanırsın." },
  { q: "Ödeme tek seferlik mi?", a: "Evet, tek seferlik ödeme yaparsın ve ömür boyu güncellenen içeriklere erişirsin." },
];

export default function Home() {
  const { settings } = useSite();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState("");

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data)).catch(() => {});
    document.title = `${settings.site_name || "Akademi"} - Dijital Pazarlama Eğitimleri`;
  }, [settings.site_name]);

  const openVideo = (url) => { setActiveVideo(url); setVideoOpen(true); };
  const testimonials = settings.testimonials || [];

  return (
    <div className="relative overflow-hidden">
      {/* HERO - video focused */}
      <section className="relative">
        <div className="absolute inset-0 -z-0">
          {settings.hero_poster && <img src={settings.hero_poster} alt="" className="w-full h-full object-cover opacity-20" />}
          <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/85 to-ink" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gold/15 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[150px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20 md:pt-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 overline text-gold">
              <Sparkles className="w-3.5 h-3.5" /> {settings.students_count || "10.000+"} öğrenci
            </span>
            <h1 className="mt-6 font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-[0.95]">
              {settings.hero_title}
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">{settings.hero_subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              {user ? (
                <Link to="/panel"><Button data-testid="hero-cta-panel" size="lg" className="bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-8 gold-glow group">
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Öğrenmeye Devam Et <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button></Link>
              ) : (
                <Link to="/kurslar"><Button data-testid="hero-cta-courses" size="lg" className="bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-8 gold-glow group">
                  Eğitimleri Gör <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button></Link>
              )}
              {settings.hero_video_url && (
                <Button onClick={() => openVideo(settings.hero_video_url)} data-testid="hero-play-video" size="lg" variant="outline" className="rounded-full px-6 border-white/15 hover:bg-secondary group">
                  <span className="w-7 h-7 rounded-full bg-gold text-ink flex items-center justify-center mr-2 group-hover:scale-110 transition-transform duration-200"><Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" /></span> Tanıtımı İzle
                </Button>
              )}
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Uygulamalı dersler</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Ömür boyu erişim</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="lg:col-span-6">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 gold-glow group cursor-pointer" onClick={() => settings.hero_video_url && openVideo(settings.hero_video_url)} data-testid="hero-video-thumb">
              <img src={settings.hero_poster || "https://images.pexels.com/photos/15555796/pexels-photo-15555796.jpeg"} alt="Eğitim" className="w-full h-[300px] sm:h-[420px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-20 h-20 rounded-full bg-gold/90 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform duration-300 gold-glow">
                  <Play className="w-8 h-8 text-ink ml-1" fill="currentColor" />
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 glass rounded-xl p-3">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => <span key={i} className="w-7 h-7 rounded-full bg-gold/80 border-2 border-ink" />)}
                </div>
                <span className="text-xs text-foreground/90">Binlerce öğrenci şimdiden izliyor</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* outcomes */}
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {outcomes.map((o, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 bg-ink-surface/70 backdrop-blur border border-white/5 rounded-2xl p-5">
                <span className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center shrink-0"><o.icon className="w-6 h-6 text-gold" /></span>
                <div><p className="font-heading font-black text-2xl leading-none">{o.stat}</p><p className="text-xs text-muted-foreground mt-1">{o.label}</p></div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative border-y border-white/10 py-7 overflow-hidden mt-6">
          <div className="flex items-center gap-16 animate-marquee w-max">
            {[...brandLogos, ...brandLogos].map((b, i) => (
              <img key={i} src={`https://cdn.simpleicons.org/${b.slug}/94a3b8`} alt={b.name} title={b.name}
                className="h-6 sm:h-7 w-auto opacity-50 hover:opacity-100 transition-opacity duration-200 shrink-0" />
            ))}
          </div>
        </div>
      </section>

      {/* PERKS */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
        <div className="max-w-2xl">
          <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Sadece video değil, uçtan uca bir öğrenme deneyimi.</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {perks.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group relative bg-ink-surface border border-white/5 rounded-2xl p-7 hover:border-gold/30 transition-colors duration-300 overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-gold/5 rounded-full blur-2xl group-hover:bg-gold/10 transition-colors duration-300" />
              <span className="relative w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center"><p.icon className="w-6 h-6 text-gold" /></span>
              <h3 className="relative mt-5 font-heading font-semibold text-lg tracking-tight">{p.title}</h3>
              <p className="relative mt-2 text-sm text-muted-foreground leading-relaxed">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* COURSES */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div className="max-w-2xl">
            <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Öğrenme yolculuğunu bütünsel kur.</h2></div>
          <Link to="/kurslar"><Button variant="outline" className="rounded-full border-white/15" data-testid="home-all-courses">Tümünü Gör <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 6).map((c, i) => <CourseCard key={c.course_id} course={c} index={i} />)}
        </div>
      </section>

      {/* VIDEO TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="relative py-24 border-y border-white/10 bg-ink-surface/30">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Onlar başardı, sıra sende.</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                  className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden group">
                  <div className="relative aspect-video cursor-pointer overflow-hidden" onClick={() => t.video_url && openVideo(t.video_url)} data-testid={`testimonial-video-${i}`}>
                    {t.thumbnail && <img src={t.thumbnail} alt={t.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    <div className="absolute inset-0 bg-ink/30 flex items-center justify-center">
                      <span className="w-14 h-14 rounded-full bg-gold/90 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"><Play className="w-6 h-6 text-ink ml-0.5" fill="currentColor" /></span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex gap-0.5 mb-3">{Array.from({ length: t.rating || 5 }).map((_, j) => <Star key={j} className="w-4 h-4 text-gold" fill="currentColor" />)}</div>
                    <p className="text-sm text-foreground/90 leading-relaxed">"{t.quote}"</p>
                    <div className="mt-4 pt-4 border-t border-white/5"><p className="font-heading font-semibold text-sm">{t.name}</p><p className="text-xs text-muted-foreground">{t.role}</p></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-24">
        <div className="text-center mb-12">
          <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Sıkça Sorulan Sorular</h2></div>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="bg-ink-surface border border-white/5 rounded-xl px-6 data-[state=open]:border-gold/30">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-5" data-testid={`faq-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA - personalized */}
      {!user && (
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold/20 via-ink-surface to-ink-surface border border-gold/20 p-10 md:p-16 text-center">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-gold/20 rounded-full blur-[100px]" />
            <div className="relative">
              <h2 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter max-w-2xl mx-auto">Bugün başla, kariyerine altın bilezik tak.</h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Uygulamalı eğitimler, canlı yayınlar ve doğrulanabilir sertifika seni bekliyor.</p>
              <Link to="/kayit-ol"><Button size="lg" className="mt-8 bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-10 gold-glow" data-testid="cta-register">Hemen Üye Ol</Button></Link>
            </div>
          </div>
        </section>
      )}

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0 bg-black border-white/10 overflow-hidden">
          <DialogTitle className="sr-only">Tanıtım Videosu</DialogTitle>
          <div className="aspect-video">{activeVideo && <iframe title="Video" src={activeVideo + (activeVideo.includes("?") ? "&" : "?") + "autoplay=1"} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
