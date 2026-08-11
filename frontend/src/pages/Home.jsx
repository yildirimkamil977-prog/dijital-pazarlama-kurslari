import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, Radio, FileText, Award, MessageCircle, CheckCircle2, Star } from "lucide-react";
import api from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/CourseCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const perks = [
  { icon: MessageCircle, title: "1 Saat Ücretsiz Danışmanlık", text: "Başlamadan önce hedeflerini netleştir, sana uygun eğitim yolunu birlikte planlayalım." },
  { icon: Users, title: "Özel Telegram Topluluğu", text: "Sadece eğitim değil; beraber ilerleyen bir topluluğa dahil ol, network kur." },
  { icon: Radio, title: "Her Ay Canlı Yayın", text: "Güncel konulara aylık canlı yayınlarla dokun, sorularını anında sor." },
  { icon: FileText, title: "Onlarca Şablon & Checklist", text: "Uygulamada hız kazandıran hazır yapılar ve kontrol listeleriyle daha hızlı sonuç al." },
  { icon: Award, title: "Doğrulanabilir Sertifika", text: "Eğitimi tamamladığında QR kod ile doğrulanabilen bir başarı sertifikası kazan." },
  { icon: Sparkles, title: "Ömür Boyu Güncel Erişim", text: "Yeni eklenen tüm derslere ve kaynaklara ek ücret ödemeden erişmeye devam et." },
];

const brands = ["Google Ads", "Meta Ads", "TikTok Ads", "Google Analytics", "Search Console", "Tag Manager", "SEMrush", "Ahrefs"];

const faqs = [
  { q: "Eğitimler nasıl gerçekleşiyor?", a: "Eğitimi satın aldıktan sonra öğrenci paneline giriş yaparak dilediğin zaman, dilediğin cihazdan izlemeye başlayabilirsin." },
  { q: "Eğitimlere ne kadar süre erişebilirim?", a: "Eğitimlere ömür boyu erişebilirsin. Yeni eklenen derslere ve kaynaklara da ücretsiz olarak erişmeye devam edersin." },
  { q: "Eğitimler hangi seviyeye uygun?", a: "Eğitimler sıfırdan başlar; kurulumlardan ileri seviye stratejilere kadar uygulamalı olarak ilerler. Ön bilgi gerekmez." },
  { q: "Sertifika veriyor musunuz?", a: "Evet. Eğitimi tamamladığında QR kod ile doğrulanabilen bir başarı sertifikası almaya hak kazanırsın." },
  { q: "Ödeme tek seferlik mi?", a: "Evet, tek seferlik ödeme yaparsın ve ömür boyu güncellenen içeriklere erişirsin." },
  { q: "Mobil cihazdan izleyebilir miyim?", a: "Elbette. Site bilgisayar, tablet ve telefon için özenle tasarlandı; her cihazdan rahatça ders izleyebilirsin." },
];

export default function Home() {
  const { settings } = useSite();
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data)).catch(() => {});
    document.title = `${settings.site_name || "Akademi"} - Dijital Pazarlama Eğitimleri`;
  }, [settings.site_name]);

  return (
    <div className="relative overflow-hidden">
      {/* HERO */}
      <section className="relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gold/10 rounded-full blur-[140px] -z-0" />
        <div className="absolute top-40 -left-40 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[140px] -z-0" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-20 pb-16 md:pt-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 overline text-gold border border-gold/30 rounded-full px-4 py-1.5 bg-gold/5">
              <Sparkles className="w-3.5 h-3.5" /> {settings.students_count || "10.000+"} öğrenci
            </span>
            <h1 className="mt-6 font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-none">
              {settings.hero_title}
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              {settings.hero_subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/kurslar">
                <Button data-testid="hero-cta-courses" size="lg" className="bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-8 gold-glow group">
                  Eğitimleri Gör <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </Link>
              <Link to="/hakkimda">
                <Button data-testid="hero-cta-about" size="lg" variant="outline" className="rounded-full px-8 border-white/15 hover:bg-secondary">
                  Hakkımda
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Uygulamalı dersler</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-gold" /> Ömür boyu erişim</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="lg:col-span-5">
            <div className="relative grid grid-cols-2 gap-4">
              <div className="col-span-2 relative rounded-2xl overflow-hidden border border-white/10 gold-glow">
                <img src="https://images.pexels.com/photos/15555796/pexels-photo-15555796.jpeg" alt="Dijital pazarlama" className="w-full h-56 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
              </div>
              <div className="rounded-2xl bg-ink-surface border border-white/5 p-5">
                <p className="font-heading font-black text-3xl text-gold">13+</p>
                <p className="text-xs text-muted-foreground mt-1">yıllık saha tecrübesi</p>
              </div>
              <div className="rounded-2xl bg-ink-surface border border-white/5 p-5">
                <p className="font-heading font-black text-3xl text-gold">1000+</p>
                <p className="text-xs text-muted-foreground mt-1">danışılan marka</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Brands marquee */}
        <div className="relative border-y border-white/10 py-6 overflow-hidden">
          <div className="flex gap-12 animate-marquee whitespace-nowrap w-max">
            {[...brands, ...brands].map((b, i) => (
              <span key={i} className="overline text-muted-foreground/50">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PERKS */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-24">
        <div className="max-w-2xl">
          <span className="overline text-gold">Neler Kazanırsın?</span>
          <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Sadece video değil, uçtan uca bir öğrenme deneyimi.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {perks.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-ink-surface border border-white/5 rounded-2xl p-7 hover:border-gold/30 transition-colors duration-300">
              <span className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                <p.icon className="w-6 h-6 text-gold" />
              </span>
              <h3 className="mt-5 font-heading font-semibold text-lg tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* COURSES */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div className="max-w-2xl">
            <span className="overline text-gold">Eğitimler</span>
            <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Öğrenme yolculuğunu bütünsel kur.</h2>
          </div>
          <Link to="/kurslar"><Button variant="outline" className="rounded-full border-white/15" data-testid="home-all-courses">Tümünü Gör <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 6).map((c, i) => <CourseCard key={c.course_id} course={c} index={i} />)}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 pb-24">
        <div className="text-center mb-12">
          <span className="overline text-gold">SSS</span>
          <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Sıkça Sorulan Sorular</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="bg-ink-surface border border-white/5 rounded-xl px-6 data-[state=open]:border-gold/30">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-5" data-testid={`faq-${i}`}>{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
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
    </div>
  );
}
