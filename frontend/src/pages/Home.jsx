import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, Radio, FileText, Award, MessageCircle, CheckCircle2, Play, Star, TrendingUp, Target, Zap, LayoutDashboard, Rocket, ShieldCheck, Flame, Trophy, Quote, Gift, Compass, GraduationCap, Send } from "lucide-react";
import api from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/CourseCard";
import { GroupCard } from "@/components/GroupCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Seo } from "@/components/Seo";

const perks = [
  { icon: MessageCircle, title: "1 Saat Ücretsiz Danışmanlık", text: "Başlamadan önce hedeflerini netleştir, sana uygun eğitim yolunu birlikte planlayalım." },
  { icon: Users, title: "Özel Telegram Topluluğu", text: "Sadece eğitim değil; beraber ilerleyen bir topluluğa dahil ol, network kur." },
  { icon: Radio, title: "Her Ay Canlı Yayın", text: "Güncel konulara aylık canlı yayınlarla dokun, sorularını anında sor." },
  { icon: FileText, title: "Onlarca Şablon & Checklist", text: "Uygulamada hız kazandıran hazır yapılar ve kontrol listeleriyle daha hızlı sonuç al." },
  { icon: Award, title: "Doğrulanabilir Sertifika", text: "Eğitimi tamamladığında QR kod ile doğrulanabilen bir başarı sertifikası kazan." },
  { icon: Sparkles, title: "Ömür Boyu Güncel Erişim", text: "Yeni eklenen tüm derslere ve kaynaklara ek ücret ödemeden erişmeye devam et." },
];
const tools = [
  { name: "Google Ads", slug: "googleads" },
  { name: "Meta Business", slug: "meta" },
  { name: "Google Analytics", slug: "googleanalytics" },
  { name: "Search Console", slug: "googlesearchconsole" },
  { name: "Tag Manager", slug: "googletagmanager" },
  { name: "Semrush", slug: "semrush" },
  { name: "Ahrefs", slug: null },
  { name: "Screaming Frog", slug: null },
];
const HERO_AVATARS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=faces&fit=crop&w=96&h=96&q=80",
  "https://images.unsplash.com/photo-1604904612715-47bf9d9bc670?crop=faces&fit=crop&w=96&h=96&q=80",
  "https://images.pexels.com/photos/37148308/pexels-photo-37148308.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=96&h=96",
  "https://images.unsplash.com/photo-1758600587730-a11917c13b85?crop=faces&fit=crop&w=96&h=96&q=80",
];
const outcomes = [
  { icon: GraduationCap, title: "Uzman ve deneyimli eğitmenler" },
  { icon: Send, title: "Telegram üzerinden sorularını sorma imkanı" },
  { icon: MessageCircle, title: "Dilediğin zaman 1 saatlik bire bir danışmanlık hakkı" },
];
const faqs = [
  { q: "Eğitimler nasıl gerçekleşiyor?", a: "Eğitimi satın aldıktan sonra öğrenci paneline giriş yaparak dilediğin zaman, dilediğin cihazdan izlemeye başlayabilirsin." },
  { q: "Eğitimlere ne kadar süre erişebilirim?", a: "Eğitimlere ömür boyu erişebilirsin. Yeni eklenen derslere ve kaynaklara da ücretsiz olarak erişmeye devam edersin." },
  { q: "Eğitimler hangi seviyeye uygun?", a: "Eğitimler sıfırdan başlar; kurulumlardan ileri seviye stratejilere kadar uygulamalı olarak ilerler. Ön bilgi gerekmez." },
  { q: "Sertifika veriyor musunuz?", a: "Evet. Eğitimi tamamladığında QR kod ile doğrulanabilen bir başarı sertifikası almaya hak kazanırsın." },
  { q: "Ödeme tek seferlik mi?", a: "Evet, tek seferlik ödeme yaparsın ve ömür boyu güncellenen içeriklere erişirsin." },
];
const roadmap = [
  { icon: Compass, step: "01", title: "Hedefini Belirle", text: "Ücretsiz danışmanlıkla nereden başlayacağını netleştir; sana özel bir yol haritası çizelim." },
  { icon: GraduationCap, step: "02", title: "Uygulamalı Öğren", text: "Gerçek kampanyalar üzerinden, izleyip aynı anda uygulayarak öğren. Ezber yok, saha var." },
  { icon: Rocket, step: "03", title: "Uygula & Ölçekle", text: "Şablonlar ve checklist'lerle kendi projelerinde sonuç al, bütçeni verimli büyüt." },
  { icon: Trophy, step: "04", title: "Sertifikanı Al", text: "Eğitimi tamamla, QR ile doğrulanabilen sertifikanı kazan ve kariyerinde öne geç." },
];
const valueStack = [
  "Uçtan uca video eğitim kütüphanesi",
  "1 saat birebir ücretsiz danışmanlık",
  "Özel Telegram topluluğuna erişim",
  "Her ay güncel canlı yayınlar",
  "Onlarca hazır şablon & checklist",
  "Doğrulanabilir başarı sertifikası",
];

export default function Home() {
  const { settings } = useSite();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState("");

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data)).catch(() => {});
    api.get("/group-trainings").then(({ data }) => setGroups(data)).catch(() => {});
    document.title = `${settings.site_name || "Akademi"} - Dijital Pazarlama Eğitimleri`;
  }, [settings.site_name]);

  const toEmbed = (url) => {
    if (!url) return "";
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      if (u.hostname.includes("youtube.com")) {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (u.hostname.includes("vimeo.com") && !u.hostname.includes("player")) {
        const id = u.pathname.split("/").filter(Boolean).pop();
        return `https://player.vimeo.com/video/${id}`;
      }
    } catch { /* ignore */ }
    return url;
  };
  const openVideo = (url) => { setActiveVideo(toEmbed(url)); setVideoOpen(true); };
  const testimonials = settings.testimonials || [];
  const shuffledT = useMemo(() => [...testimonials].sort(() => Math.random() - 0.5), [testimonials.length]);
  const [tStart, setTStart] = useState(0);
  useEffect(() => { if (shuffledT.length <= 4) return; const id = setInterval(() => setTStart((s) => (s + 4) % shuffledT.length), 5000); return () => clearInterval(id); }, [shuffledT.length]);
  const visibleTestimonials = shuffledT.length <= 4 ? shuffledT : Array.from({ length: 4 }, (_, k) => shuffledT[(tStart + k) % shuffledT.length]);

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
            <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-[0.95]">
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
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Uygulamalı dersler</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Ömür boyu erişim</span>
              <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-gold" /> Her ay canlı yayın</span>
              <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-gold" /> 1 saat ücretsiz danışmanlık</span>
            </div>
            {groups.length > 0 && (
              <Link to="/canli-grup-egitimleri" data-testid="hero-group-cta" className="mt-8 inline-flex items-center gap-3 bg-gradient-to-r from-red-500/10 to-gold/10 border border-white/10 rounded-2xl pl-3 pr-4 py-2.5 hover:border-gold/40 transition-colors duration-200 group">
                <span className="inline-flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-bold px-2 py-1 rounded-full">
                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span> CANLI
                </span>
                <span className="text-sm text-foreground/90">Google Meet ile <b className="text-gold">Canlı Grup Eğitimleri</b> başladı</span>
                <ArrowRight className="w-4 h-4 text-gold group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            )}
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
                  {HERO_AVATARS.map((src, i) => <img key={i} src={src} alt="öğrenci" className="w-7 h-7 rounded-full object-cover border-2 border-ink" />)}
                </div>
                <span className="text-xs text-foreground/90">5.000'den fazla öğrenci şimdiden izliyor</span>
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
                <p className="font-heading font-bold text-base leading-snug">{o.title}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10 mt-2">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 overline text-gold"><Target className="w-3.5 h-3.5" /> Öğreneceğin Araçlar</span>
            <h2 className="mt-3 font-heading font-bold text-2xl sm:text-3xl tracking-tight">Sektörün profesyonel araçlarını uygulamalı öğren</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tools.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                data-testid={`tool-${i}`} className="flex flex-col items-center justify-center gap-3 bg-ink-surface/60 border border-white/5 rounded-2xl py-8 px-4 hover:border-gold/30 transition-colors duration-200">
                {t.slug
                  ? <img src={`https://cdn.simpleicons.org/${t.slug}`} alt={t.name} title={t.name} className="h-10 w-auto" />
                  : <span className="h-10 flex items-center font-heading font-black text-xl text-foreground/85 text-center">{t.name}</span>}
                <span className="text-xs sm:text-sm text-muted-foreground text-center">{t.name}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70 text-center mt-6 max-w-3xl mx-auto leading-relaxed">
            Belirtilen marka adları ve logoları yalnızca eğitim içeriğinde ele alınan araçları tanıtmak amacıyla kullanılmıştır. Bu markaların sahipleriyle herhangi bir resmî iş birliği, sponsorluk veya onay ilişkisi bulunmamaktadır.
          </p>
        </div>
      </section>

      {/* PERKS */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 overline text-gold"><Zap className="w-3.5 h-3.5" /> Neler Kazanırsın</span>
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

      {/* ROADMAP */}
      <section className="relative border-y border-white/10 bg-ink-surface/30 py-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gold/5 rounded-full blur-[160px]" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 overline text-gold"><Compass className="w-3.5 h-3.5" /> Nasıl İlerliyoruz</span>
            <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Sıfırdan sonuca, 4 net adımda.</h2>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
            <div className="hidden lg:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            {roadmap.map((r, i) => (
              <motion.div key={r.step} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative bg-ink border border-white/8 rounded-2xl p-7 hover:border-gold/30 transition-colors duration-300" data-testid={`roadmap-step-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="relative w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center"><r.icon className="w-7 h-7 text-gold" /></span>
                  <span className="font-heading font-black text-4xl text-white/8">{r.step}</span>
                </div>
                <h3 className="mt-5 font-heading font-semibold text-lg tracking-tight">{r.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{r.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSES */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 overline text-gold"><GraduationCap className="w-3.5 h-3.5" /> Eğitimler</span>
            <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Öğrenme yolculuğunu bütünsel kur.</h2></div>
          <Link to="/kurslar"><Button variant="outline" className="rounded-full border-white/15" data-testid="home-all-courses">Tümünü Gör <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 6).map((c, i) => <CourseCard key={c.course_id} course={c} index={i} />)}
        </div>
      </section>

      {/* LIVE GROUP TRAININGS */}
      {groups.length > 0 && (
        <section className="relative border-y border-white/10 bg-ink-surface/30 py-24 overflow-hidden" data-testid="home-group-section">
          <div className="absolute -top-20 right-0 w-[520px] h-[520px] bg-red-600/10 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 -left-32 w-[420px] h-[420px] bg-gold/10 rounded-full blur-[150px]" />
          <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 overline text-gold"><Radio className="w-3.5 h-3.5" /> Canlı Eğitimler</span>
                <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Google Meet ile canlı, birlikte öğren.</h2>
                <p className="mt-3 text-muted-foreground max-w-xl leading-relaxed">Sınırlı kontenjan, gerçek zamanlı soru-cevap ve uygulamalı canlı derslerle bir topluluğun parçası ol.</p>
              </div>
              <Link to="/canli-grup-egitimleri"><Button variant="outline" className="rounded-full border-white/15" data-testid="home-all-groups">Tümünü Gör <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.slice(0, 3).map((g, i) => <GroupCard key={g.group_id} g={g} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* VIDEO TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="relative py-24 border-y border-white/10 bg-ink-surface/30">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="inline-flex items-center gap-2 overline text-gold"><Quote className="w-3.5 h-3.5" /> Öğrenci Yorumları</span>
              <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Onlar başardı, sıra sende.</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {visibleTestimonials.map((t, i) => (
                <motion.div key={`${tStart}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
                  className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden group">
                  <div className="relative aspect-video cursor-pointer overflow-hidden" onClick={() => t.video_url && openVideo(t.video_url)} data-testid={`testimonial-video-${i}`}>
                    {t.thumbnail && <img src={t.thumbnail} alt={t.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                    {t.video_url && <div className="absolute inset-0 bg-ink/30 flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-gold/90 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"><Play className="w-5 h-5 text-ink ml-0.5" fill="currentColor" /></span>
                    </div>}
                  </div>
                  <div className="p-5">
                    <div className="flex gap-0.5 mb-2">{Array.from({ length: t.rating || 5 }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-gold" fill="currentColor" />)}</div>
                    <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4">"{t.quote}"</p>
                    <div className="mt-3 pt-3 border-t border-white/5"><p className="font-heading font-semibold text-sm">{t.name}</p><p className="text-xs text-muted-foreground">{t.role}</p></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VALUE STACK + GUARANTEE */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-surface via-ink-surface to-blue-950/20 p-8 md:p-14 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-gold/10 rounded-full blur-[120px]" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 overline text-gold"><Gift className="w-3.5 h-3.5" /> Pakete Dahil</span>
            <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Tek ödeme, ömür boyu değer.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">Sadece bir video eğitim değil; seni sonuca taşıyan eksiksiz bir sistem alıyorsun.</p>
            <div className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {valueStack.map((v, i) => (
                <motion.div key={v} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                  className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-gold/15 flex items-center justify-center shrink-0 mt-0.5"><CheckCircle2 className="w-4 h-4 text-gold" /></span>
                  <span className="text-sm text-foreground/90">{v}</span>
                </motion.div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="relative bg-ink border border-gold/20 rounded-2xl p-8 gold-glow">
            <span className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center"><ShieldCheck className="w-7 h-7 text-gold" /></span>
            <h3 className="mt-5 font-heading font-bold text-xl tracking-tight">İçeriğe güveniyoruz</h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">13+ yıllık saha tecrübesiyle hazırlanan, binlerce öğrencinin sonuç aldığı güncel bir müfredat. Tüm sorularını topluluk ve canlı yayınlarda yanıtlıyoruz.</p>
            <div className="mt-6 flex items-center gap-3 pt-6 border-t border-white/5">
              <span className="flex items-center gap-1.5 text-sm text-gold"><Flame className="w-4 h-4" /> {settings.students_count || "10.000+"} öğrenci</span>
              <span className="flex items-center gap-1.5 text-sm text-gold"><Trophy className="w-4 h-4" /> Sertifikalı</span>
            </div>
            <Link to={user ? "/panel" : "/kurslar"}><Button className="w-full mt-6 bg-gold hover:bg-gold-hover text-ink font-bold rounded-full h-12 group" data-testid="valuestack-cta">
              {user ? "Öğrenmeye Devam Et" : "Eğitimleri İncele"} <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
            </Button></Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-24">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 overline text-gold"><MessageCircle className="w-3.5 h-3.5" /> SSS</span>
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