import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Layers, Clock, CheckCircle2, ArrowRight, Award, Infinity as InfinityIcon } from "lucide-react";
import api, { formatPrice, formatDuration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    document.title = "Kurslar - Dijital Pazarlama Kursları";
    api.get("/courses").then(({ data }) => setCourses(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isFreeCourse = (c) => (c.discount_price != null && c.discount_price < c.price ? c.discount_price : c.price) === 0;
  const freeCount = courses.filter(isFreeCourse).length;
  const filtered = filter === "free" ? courses.filter(isFreeCourse) : filter === "paid" ? courses.filter((c) => !isFreeCourse(c)) : courses;

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
      <div className="max-w-2xl mb-8">
        <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">Butik eğitim programları</h1>
        <p className="mt-4 text-muted-foreground text-lg">Az ama öz. Her biri sahadan gelen gerçek deneyimle, baştan sona uygulamalı hazırlanmış özenli eğitimler.</p>
      </div>

      {!loading && courses.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-12">
          {[["all", `Tümü (${courses.length})`], ["free", `Ücretsiz${freeCount ? ` (${freeCount})` : ""}`], ["paid", "Ücretli"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} data-testid={`course-filter-${k}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${filter === k ? (k === "free" ? "bg-green-500 text-white" : "bg-gold text-ink") : "bg-ink-surface border border-white/10 text-muted-foreground hover:border-white/25"}`}>{l}</button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
      ) : courses.length === 0 ? (
        <p className="text-center text-muted-foreground py-24">Yakında yeni eğitimler eklenecek.</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-24" data-testid="no-courses">Bu filtreye uygun eğitim yok.</p>
      ) : (
        <div className="space-y-10">
          {filtered.map((c, idx) => {
            const hasDiscount = c.discount_price != null && c.discount_price < c.price;
            const price = hasDiscount ? c.discount_price : c.price;
            const isFree = price === 0;
            return (
              <motion.div key={c.course_id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
                data-testid={`course-card-${c.slug}`}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center bg-ink-surface border border-white/5 rounded-3xl overflow-hidden p-4 lg:p-6 hover:border-gold/20 transition-colors duration-300 ${idx % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <Link to={`/kurslar/${c.slug}`} className="relative block rounded-2xl overflow-hidden group aspect-video">
                  <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
                  {isFree ? (
                    <Badge className="absolute top-4 right-4 bg-green-500 text-white font-bold border-0 shadow-lg">Ücretsiz</Badge>
                  ) : hasDiscount && <Badge className="absolute top-4 right-4 bg-gold text-ink font-bold">%{Math.round((1 - c.discount_price / c.price) * 100)} indirim</Badge>}
                </Link>

                <div className="p-2 lg:p-4">
                  <h2 className="font-heading font-bold text-2xl sm:text-3xl tracking-tight leading-tight">{c.title}</h2>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{c.subtitle}</p>

                  <div className="flex flex-wrap items-center gap-4 mt-5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-gold" /> {c.lesson_count} ders</span>
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> {formatDuration(c.total_seconds)}</span>
                    <span className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Sertifikalı</span>
                    <span className="flex items-center gap-2"><InfinityIcon className="w-4 h-4 text-gold" /> Ömür boyu</span>
                  </div>

                  {c.what_you_learn?.length > 0 && (
                    <ul className="mt-5 grid sm:grid-cols-2 gap-2">
                      {c.what_you_learn.slice(0, 4).map((w) => (
                        <li key={w} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" /><span className="text-foreground/85">{w}</span></li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/5">
                    <div className="flex items-end gap-2">
                      {hasDiscount && <span className="text-sm text-muted-foreground line-through">{formatPrice(c.price)} ₺</span>}
                      <span className="font-heading font-black text-3xl text-gold">{price === 0 ? "Ücretsiz" : `${formatPrice(price)} ₺`}</span>
                    </div>
                    <Link to={`/kurslar/${c.slug}`}><Button className="bg-gold hover:bg-gold-hover text-ink font-semibold rounded-full">İncele <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
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
