import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Layers, Clock, CheckCircle2, ArrowRight, Award, Infinity as InfinityIcon, User } from "lucide-react";
import api, { formatPrice, formatDuration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/Countdown";

const fmtDate = (s) => { try { return new Date(s).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }); } catch { return s; } };

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Kurslar - Dijital Pazarlama Kursları";
    api.get("/courses").then(({ data }) => setCourses(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
      <div className="max-w-2xl mb-16">
        <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">Butik eğitim programları</h1>
        <p className="mt-4 text-muted-foreground text-lg">Az ama öz. Her biri sahadan gelen gerçek deneyimle, baştan sona uygulamalı hazırlanmış özenli eğitimler.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
      ) : courses.length === 0 ? (
        <p className="text-center text-muted-foreground py-24">Yakında yeni eğitimler eklenecek.</p>
      ) : (
        <div className="space-y-10">
          {courses.map((c, idx) => {
            const upcoming = c.is_upcoming;
            const price = c.effective_price != null ? c.effective_price : c.price;
            const regular = c.regular_price != null ? c.regular_price : c.price;
            const base = upcoming ? regular : c.price;
            const savePct = base > 0 && price < base ? Math.round((1 - price / base) * 100) : 0;
            const hasDiscount = price < base;
            const isFree = price === 0;
            return (
              <motion.div key={c.course_id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
                data-testid={`course-card-${c.slug}`}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-ink-surface border border-white/5 rounded-3xl overflow-hidden p-4 lg:p-6 hover:border-gold/20 transition-colors duration-300 ${idx % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <Link to={`/kurslar/${c.slug}`} className="relative block rounded-2xl overflow-hidden group aspect-video">
                  <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                  {upcoming && <Badge className="absolute top-4 left-4 bg-blue-500 text-white font-bold border-0 shadow-lg" data-testid={`coming-soon-${c.slug}`}>Yakında Yayında</Badge>}
                  {isFree ? (
                    <Badge className="absolute top-4 right-4 bg-green-500 text-white font-bold border-0 shadow-lg">Ücretsiz</Badge>
                  ) : upcoming ? (
                    <Badge className="absolute top-4 right-4 bg-gold text-ink font-black shadow-lg">{savePct > 0 ? `%${savePct} Erken Kayıt` : "Erken Kayıt"}</Badge>
                  ) : hasDiscount && <Badge className="absolute top-4 right-4 bg-gold text-ink font-bold">%{savePct} indirim</Badge>}
                </Link>

                <div className="p-2 lg:p-4">
                  <h2 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight leading-tight">{c.title}</h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{c.subtitle}</p>

                  {c.instructor && (
                    <Link to={`/egitmen/${c.instructor.slug}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2.5 mt-4 w-fit hover:opacity-80 transition-opacity duration-200" data-testid={`course-instructor-${c.slug}`}>
                      {c.instructor.avatar ? <img src={c.instructor.avatar} alt={c.instructor.name} className="w-9 h-9 rounded-full object-cover border border-white/10" /> : <span className="w-9 h-9 rounded-full bg-gold/15 flex items-center justify-center"><User className="w-4 h-4 text-gold" /></span>}
                      <span className="leading-tight"><span className="block text-sm font-medium text-foreground">{c.instructor.name}</span>{c.instructor.title && <span className="block text-xs text-muted-foreground">{c.instructor.title}</span>}</span>
                    </Link>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-gold" /> {c.lesson_count} ders</span>
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> {formatDuration(c.total_seconds)}</span>
                    <span className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Katılım belgesi</span>
                    <span className="flex items-center gap-2"><InfinityIcon className="w-4 h-4 text-gold" /> Ömür boyu</span>
                  </div>

                  {upcoming && (
                    <div className="mt-5 rounded-xl bg-gradient-to-br from-gold/15 to-blue-500/10 border border-gold/25 p-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                        <span className="text-xs text-gold font-black uppercase tracking-wide flex items-center gap-2"><Clock className="w-4 h-4" /> Yakında · Ön Kayıt Fırsatı</span>
                        {savePct > 0 && <span className="bg-gold text-ink text-xs font-black px-2.5 py-1 rounded-full">%{savePct} indirim</span>}
                      </div>
                      <Countdown target={c.publish_at} />
                      <p className="text-[11px] text-muted-foreground mt-2">Yayın: {fmtDate(c.publish_at)} · Yayınlandığında <b className="text-foreground/90">{formatPrice(regular)} ₺</b> olacak</p>
                    </div>
                  )}

                  {c.what_you_learn?.length > 0 && (
                    <ul className="mt-5 grid sm:grid-cols-2 gap-2">
                      {c.what_you_learn.slice(0, 4).map((w) => (
                        <li key={w} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" /><span className="text-foreground/85">{w}</span></li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                    <div className="flex flex-col">
                      <div className="flex items-end gap-2">
                        {hasDiscount && <span className="text-sm text-muted-foreground line-through">{formatPrice(base)} ₺</span>}
                        <span className="font-heading font-black text-3xl text-gold">{price === 0 ? "Ücretsiz" : `${formatPrice(price)} ₺`}</span>
                        {savePct > 0 && <span className="mb-1 bg-gold/15 text-gold border border-gold/25 rounded-md px-2 py-0.5 text-xs font-bold">%{savePct}</span>}
                      </div>
                      {upcoming && <span className="text-[11px] text-gold mt-1">Erken kayıt fiyatı</span>}
                    </div>
                    <Link to={`/kurslar/${c.slug}`}><Button className="bg-gold hover:bg-gold-hover text-ink font-semibold rounded-full">{upcoming ? "Ön Kayıt" : "İncele"} <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
