import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, PlayCircle, Clock, Layers, CheckCircle2, Lock, ShoppingCart, Check, Award, Infinity as InfinityIcon, FileText } from "lucide-react";
import api, { formatPrice, formatDuration } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add, has } = useCart();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/courses/${slug}`).then(({ data }) => { setCourse(data); document.title = `${data.title} - Akademi`; })
      .catch(() => toast.error("Eğitim bulunamadı")).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!course) return <div className="text-center py-40 text-muted-foreground">Eğitim bulunamadı.</div>;

  const hasDiscount = course.discount_price != null && course.discount_price < course.price;
  const price = hasDiscount ? course.discount_price : course.price;
  const inCart = has(course.course_id);

  const handleAdd = () => { add(course); toast.success("Sepete eklendi"); };
  const handleBuy = () => { if (!inCart) add(course); navigate(user ? "/odeme" : "/giris"); };

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-gold/5 rounded-full blur-[120px]" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left */}
        <div className="lg:col-span-7">
          {course.category && <Badge className="bg-gold/10 text-gold border-gold/20">{course.category}</Badge>}
          <h1 className="mt-4 font-heading font-black text-3xl sm:text-4xl tracking-tighter leading-tight">{course.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{course.subtitle}</p>
          <div className="flex flex-wrap items-center gap-5 mt-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-gold" /> {course.lesson_count} ders</span>
            <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> {formatDuration(course.total_seconds)}</span>
            <span className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Sertifikalı</span>
            <span className="flex items-center gap-2"><InfinityIcon className="w-4 h-4 text-gold" /> Ömür boyu erişim</span>
          </div>

          {course.what_you_learn?.length > 0 && (
            <div className="mt-12 bg-ink-surface border border-white/5 rounded-2xl p-7">
              <h2 className="font-heading font-bold text-xl tracking-tight">Neler öğreneceksin?</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {course.what_you_learn.map((w) => (
                  <div key={w} className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-gold shrink-0 mt-0.5" /><span className="text-sm">{w}</span></div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="font-heading font-bold text-xl tracking-tight mb-5">Müfredat</h2>
            <Accordion type="multiple" className="space-y-3">
              {course.modules?.map((m, mi) => (
                <AccordionItem key={m.id} value={m.id} className="bg-ink-surface border border-white/5 rounded-xl px-5">
                  <AccordionTrigger className="hover:no-underline py-4" data-testid={`module-${mi}`}>
                    <span className="text-left font-medium">{m.title} <span className="text-muted-foreground text-sm font-normal">· {m.lessons.length} ders</span></span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <ul className="space-y-1">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors duration-200">
                          <span className="flex items-center gap-3 text-sm">
                            {l.is_preview || course.enrolled ? <PlayCircle className="w-4 h-4 text-gold" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                            {l.title}
                            {l.has_resources && <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                          </span>
                          <span className="flex items-center gap-3">
                            {l.is_preview && <Badge variant="outline" className="text-[10px] border-gold/30 text-gold">Önizleme</Badge>}
                            <span className="text-xs text-muted-foreground">{formatDuration(l.duration_seconds)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {course.requirements?.length > 0 && (
            <div className="mt-10">
              <h2 className="font-heading font-bold text-xl tracking-tight mb-4">Gereksinimler</h2>
              <ul className="space-y-2">
                {course.requirements.map((r) => <li key={r} className="flex items-center gap-3 text-sm text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-gold" /> {r}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-10 bg-ink-surface border border-white/5 rounded-2xl p-7">
            <h2 className="font-heading font-bold text-xl tracking-tight mb-3">Açıklama</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{course.description}</p>
          </div>
        </div>

        {/* Right sticky card */}
        <div className="lg:col-span-5">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:sticky lg:top-24 bg-ink-surface border border-white/10 rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-ink-elevated">
              {course.thumbnail && <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-ink/30 flex items-center justify-center"><PlayCircle className="w-14 h-14 text-white/90" /></div>
            </div>
            <div className="p-7">
              {course.enrolled ? (
                <>
                  <Badge className="bg-green-500/15 text-green-400 border-green-500/20 mb-4">Bu eğitime kayıtlısın</Badge>
                  <Button onClick={() => navigate(`/panel/izle/${course.course_id}`)} data-testid="go-to-player" className="w-full bg-gold hover:bg-gold-hover text-ink font-bold h-12">Eğitime Devam Et</Button>
                </>
              ) : (
                <>
                  <div className="flex items-end gap-3">
                    {hasDiscount && <span className="text-muted-foreground line-through">{formatPrice(course.price)} ₺</span>}
                    <span className="font-heading font-black text-4xl text-gold">{price === 0 ? "Ücretsiz" : `${formatPrice(price)} ₺`}</span>
                  </div>
                  {hasDiscount && <Badge className="mt-2 bg-destructive/15 text-red-400 border-destructive/20">%{Math.round((1 - course.discount_price / course.price) * 100)} indirim</Badge>}
                  <div className="mt-6 space-y-3">
                    <Button onClick={handleBuy} data-testid="buy-now" className="w-full bg-gold hover:bg-gold-hover text-ink font-bold h-12">Hemen Satın Al</Button>
                    <Button onClick={handleAdd} disabled={inCart} variant="outline" data-testid="add-to-cart" className="w-full h-12 border-white/15">
                      {inCart ? <><Check className="w-4 h-4 mr-2" /> Sepette</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Sepete Ekle</>}
                    </Button>
                  </div>
                </>
              )}
              <div className="mt-6 pt-6 border-t border-white/5 space-y-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-3"><InfinityIcon className="w-4 h-4 text-gold" /> Ömür boyu erişim</span>
                <span className="flex items-center gap-3"><Award className="w-4 h-4 text-gold" /> Tamamlama sertifikası</span>
                <span className="flex items-center gap-3"><PlayCircle className="w-4 h-4 text-gold" /> Tüm cihazlardan izle</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
