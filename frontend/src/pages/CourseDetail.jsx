import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toEmbed } from "@/lib/video";
import { motion } from "framer-motion";
import { Loader2, PlayCircle, Clock, Layers, CheckCircle2, Lock, ShoppingCart, Check, Award, Infinity as InfinityIcon, FileText, Play, Star, ShieldCheck, Gift, Rocket, Users, MessageCircle, Zap, GraduationCap } from "lucide-react";
import api, { formatPrice, formatDuration, apiError } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Seo } from "@/components/Seo";
import { SocialLinks } from "@/components/SocialLinks";
import { Countdown } from "@/components/Countdown";
import { useSite } from "@/context/SiteContext";
import { trackInitiateCheckout, trackPurchase } from "@/lib/track";
import { toast } from "sonner";

const fmtDate = (s) => { try { return new Date(s).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }); } catch { return s; } };

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { add, has } = useCart();
  const { user } = useAuth();
  const { settings } = useSite();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/courses/${slug}`).then(({ data }) => { setCourse(data); document.title = `${data.title} - Akademi`; })
      .catch(() => toast.error("Eğitim bulunamadı")).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex justify-center py-40"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!course) return <div className="text-center py-40 text-muted-foreground">Eğitim bulunamadı.</div>;

  const upcoming = course.is_upcoming;
  const price = course.effective_price != null ? course.effective_price : course.price;
  const regular = course.regular_price != null ? course.regular_price : course.price;
  const base = upcoming ? regular : course.price;
  const savePct = base > 0 && price < base ? Math.round((1 - price / base) * 100) : 0;
  const hasDiscount = price < base;
  const inCart = has(course.course_id);
  const isFree = price === 0;
  const handleAdd = () => { add(course); toast.success("Sepete eklendi"); };
  const handleBuy = () => { if (!inCart) add(course); trackInitiateCheckout({ value: price, numItems: 1 }); navigate(user ? "/odeme" : "/giris"); };
  const handleFreeEnroll = async () => {
    if (!user) { if (!inCart) add(course); navigate("/odeme"); return; }
    setEnrolling(true);
    try {
      const { data } = await api.post("/payments/checkout", { items: [{ course_id: course.course_id }], payment_method: "paytr", billing: {} });
      trackPurchase({ orderId: data.order_id, value: 0, items: [{ id: course.course_id, title: course.title, price: 0 }] });
      toast.success("Kayıt tamamlandı! Eğitime yönlendiriliyorsun.");
      navigate(`/panel/izle/${course.course_id}`);
    } catch (e) { toast.error(apiError(e)); } finally { setEnrolling(false); }
  };
  const openPreview = (l) => { if ((l.is_preview || course.enrolled) && l.video_url) setPreview(l); };

  return (
    <div className="relative pb-24 lg:pb-0">
      <Seo
        title={`${course.seo?.meta_title || course.title} | ${settings.site_name || "Akademi"}`}
        description={course.seo?.meta_description || course.subtitle || (course.description || "").slice(0, 155)}
        keywords={course.seo?.meta_keywords}
        image={course.thumbnail}
        jsonLd={[
          { "@context": "https://schema.org", "@type": "Course", "name": course.title, "description": course.seo?.meta_description || course.subtitle || course.description, "provider": { "@type": "Organization", "name": settings.site_name || "Akademi" } },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Ana Sayfa", "item": window.location.origin },
            { "@type": "ListItem", "position": 2, "name": "Eğitimler", "item": `${window.location.origin}/kurslar` },
            { "@type": "ListItem", "position": 3, "name": course.title },
          ] },
        ]}
      />
      {/* Colorful gradient hero band */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          {course.thumbnail && <img src={course.thumbnail} alt="" className="w-full h-full object-cover opacity-15" />}
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/90 to-blue-950/40" />
          <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-gold/15 rounded-full blur-[130px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            {upcoming && (
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-200 text-xs font-bold" data-testid="detail-coming-soon-badge">
                <Clock className="w-3.5 h-3.5" /> YAKINDA YAYINDA · {fmtDate(course.publish_at)}
              </div>
            )}
            <h1 className="font-heading font-black text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95]">{course.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl">{course.subtitle}</p>
            <div className="flex flex-wrap items-center gap-5 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-gold" /> {course.lesson_count} ders</span>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> {formatDuration(course.total_seconds)}</span>
              <span className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Sertifikalı</span>
              <span className="flex items-center gap-2"><InfinityIcon className="w-4 h-4 text-gold" /> Ömür boyu erişim</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          {course.what_you_learn?.length > 0 && (
            <div className="bg-gradient-to-br from-gold/10 to-ink-surface border border-gold/15 rounded-2xl p-7">
              <h2 className="font-heading font-bold text-xl tracking-tight flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-gold" /> Neler öğreneceksin?</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {course.what_you_learn.map((w) => (<div key={w} className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-gold shrink-0 mt-0.5" /><span className="text-sm">{w}</span></div>))}
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="font-heading font-bold text-xl tracking-tight mb-5">Müfredat</h2>
            <Accordion type="multiple" defaultValue={course.modules?.map((m) => m.id)} className="space-y-3">
              {course.modules?.map((m, mi) => (
                <AccordionItem key={m.id} value={m.id} className="bg-ink-surface border border-white/5 rounded-xl px-5 data-[state=open]:border-gold/20">
                  <AccordionTrigger className="hover:no-underline py-4" data-testid={`module-${mi}`}>
                    <span className="text-left font-medium flex items-center gap-3"><span className="w-7 h-7 rounded-lg bg-gold/10 text-gold text-xs flex items-center justify-center font-bold shrink-0">{mi + 1}</span>{m.title} <span className="text-muted-foreground text-sm font-normal">· {m.lessons.length} ders</span></span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <ul className="space-y-1">
                      {m.lessons.map((l) => {
                        const canPlay = l.is_preview || course.enrolled;
                        return (
                          <li key={l.id} onClick={() => openPreview(l)} data-testid={`lesson-row-${l.id}`}
                            className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors duration-200 ${canPlay ? "hover:bg-gold/5 cursor-pointer" : "opacity-70"}`}>
                            <span className="flex items-center gap-3 text-sm">
                              {canPlay ? <PlayCircle className="w-4 h-4 text-gold" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                              {l.title}
                              {l.has_resources && <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
                            </span>
                            <span className="flex items-center gap-3">
                              {l.is_preview && !course.enrolled && <Badge variant="outline" className="text-[10px] border-gold/40 text-gold">Ücretsiz Önizle</Badge>}
                              <span className="text-xs text-muted-foreground">{formatDuration(l.duration_seconds)}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {course.requirements?.length > 0 && (
            <div className="mt-10"><h2 className="font-heading font-bold text-xl tracking-tight mb-4">Gereksinimler</h2>
              <ul className="space-y-2">{course.requirements.map((r) => <li key={r} className="flex items-center gap-3 text-sm text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-gold" /> {r}</li>)}</ul></div>
          )}

          <div className="mt-10 bg-ink-surface border border-white/5 rounded-2xl p-7">
            <h2 className="font-heading font-bold text-xl tracking-tight mb-3">Açıklama</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{course.description}</p>
          </div>

          {course.instructor && (
            <div className="mt-10" data-testid="course-instructor-card">
              <h2 className="font-heading font-bold text-xl tracking-tight mb-4">Eğitmen</h2>
              <div className="bg-gradient-to-br from-gold/10 to-ink-surface border border-gold/15 rounded-2xl p-6">
                <div className="flex items-start gap-5">
                  <Link to={`/egitmen/${course.instructor.slug}`} className="shrink-0 group">
                    {course.instructor.avatar ? (
                      <img src={course.instructor.avatar} alt={course.instructor.name} className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
                    ) : (
                      <span className="w-20 h-20 rounded-2xl bg-gold/10 flex items-center justify-center"><Users className="w-9 h-9 text-gold" /></span>
                    )}
                  </Link>
                  <div className="min-w-0">
                    <Link to={`/egitmen/${course.instructor.slug}`} className="font-heading font-semibold text-lg hover:text-gold transition-colors duration-200">{course.instructor.name}</Link>
                    {course.instructor.title && <p className="text-sm text-gold">{course.instructor.title}</p>}
                    {course.instructor.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3">{course.instructor.bio}</p>}
                    <div className="mt-3 flex items-center gap-4 flex-wrap">
                      <SocialLinks links={course.instructor.social_links} />
                      <Link to={`/egitmen/${course.instructor.slug}`} className="text-xs text-gold font-medium hover:underline">Profili görüntüle →</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {course.reviews?.length > 0 && (
            <div className="mt-10">
              <h2 className="font-heading font-bold text-xl tracking-tight mb-5 flex items-center gap-2"><Star className="w-5 h-5 text-gold" fill="currentColor" /> Öğrenci Yorumları</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {course.reviews.map((r, i) => (
                  <div key={i} className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden" data-testid={`course-review-${i}`}>
                    {r.video_url ? (
                      <div className="relative aspect-[9/16] bg-black"><iframe title={`review-${i}`} src={r.video_url} className="w-full h-full" allow="encrypted-media; fullscreen" allowFullScreen /></div>
                    ) : r.thumbnail ? (
                      <div className="aspect-[9/16]"><img src={r.thumbnail} alt={r.name} className="w-full h-full object-cover" /></div>
                    ) : null}
                    <div className="p-4">
                      <div className="flex gap-0.5 mb-2">{Array.from({ length: r.rating || 5 }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-gold" fill="currentColor" />)}</div>
                      <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4">"{r.quote}"</p>
                      <div className="mt-3 pt-3 border-t border-white/5"><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">{r.role}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky card */}
        <div className="lg:col-span-5">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:sticky lg:top-28 bg-ink-surface border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="relative aspect-video bg-ink-elevated cursor-pointer group" onClick={() => { const first = course.modules?.flatMap(m => m.lessons).find(l => l.is_preview || course.enrolled); if (first) openPreview(first); }}>
              {course.thumbnail && <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-ink/40 flex items-center justify-center">
                <span className="w-16 h-16 rounded-full bg-gold/90 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"><Play className="w-7 h-7 text-ink ml-1" fill="currentColor" /></span>
              </div>
              <Badge className="absolute top-3 left-3 bg-ink/80 text-foreground border-white/10">Önizlemeyi izle</Badge>
            </div>
            <div className="p-7">
              {course.enrolled ? (
                <>
                  <Badge className="bg-green-500/15 text-green-400 border-green-500/20 mb-4">Bu eğitime kayıtlısın</Badge>
                  <Button onClick={() => navigate(`/panel/izle/${course.course_id}`)} data-testid="go-to-player" className="w-full bg-gold hover:bg-gold-hover text-ink font-bold h-12">Eğitime Devam Et</Button>
                </>
              ) : (
                <>
                  {upcoming && (
                    <div className="mb-5 rounded-2xl bg-gradient-to-br from-gold/20 to-blue-500/10 border border-gold/30 p-5" data-testid="course-upcoming-box">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-2 text-xs font-black text-gold uppercase tracking-wide"><Clock className="w-4 h-4" /> Yakında Yayında · Ön Kayıt</span>
                        {savePct > 0 && <span className="bg-gold text-ink font-black text-sm px-3 py-1 rounded-full">%{savePct} İNDİRİM</span>}
                      </div>
                      <p className="text-sm text-foreground/90 mt-3 leading-relaxed">Bu eğitim henüz yayında değil. <b className="text-gold">{fmtDate(course.publish_at)}</b> tarihinde yayınlanacak. Ön kayıt ol, erken kayıt fiyatını kaçırma — fiyat yayınla birlikte artacak.</p>
                      <Countdown target={course.publish_at} className="mt-4" />
                    </div>
                  )}
                  <div className="flex items-end gap-3 flex-wrap">
                    {hasDiscount && <span className="text-muted-foreground line-through text-lg">{formatPrice(base)} ₺</span>}
                    <span className="font-heading font-black text-4xl text-gold">{price === 0 ? "Ücretsiz" : `${formatPrice(price)} ₺`}</span>
                    {savePct > 0 && <span className="mb-1.5 bg-gold text-ink rounded-md px-2 py-0.5 text-xs font-black">%{savePct} indirim</span>}
                  </div>
                  {upcoming && (
                    <p className="text-xs text-muted-foreground mt-2">Bu erken kayıt fiyatıdır · Yayınlandığında <b className="text-foreground/90">{formatPrice(regular)} ₺</b> olacak</p>
                  )}
                  <div className="mt-6 space-y-3">
                    {isFree ? (
                      <Button onClick={handleFreeEnroll} disabled={enrolling} data-testid="free-enroll" className="w-full bg-gold hover:bg-gold-hover text-ink font-bold h-12">
                        {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GraduationCap className="w-4 h-4 mr-2" /> Ücretsiz Kayıt Ol</>}
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleBuy} data-testid="buy-now" className="w-full bg-gold hover:bg-gold-hover text-ink font-bold h-12">{upcoming ? "Ön Kayıt Ol" : "Hemen Kayıt Ol"}</Button>
                        <Button onClick={handleAdd} disabled={inCart} variant="outline" data-testid="add-to-cart" className="w-full h-12 border-white/15">
                          {inCart ? <><Check className="w-4 h-4 mr-2" /> Sepette</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Sepete Ekle</>}
                        </Button>
                        {upcoming && <p className="text-[11px] text-muted-foreground text-center">Ön kayıt: Şimdi öde, yayınlandığında anında eriş.</p>}
                      </>
                    )}
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

      {/* RICH PERSUASION BAND */}
      <section className="relative border-y border-white/10 bg-ink-surface/30 py-20 overflow-hidden">
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-gold/8 rounded-full blur-[150px]" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-2 overline text-gold"><Gift className="w-3.5 h-3.5" /> Bu Eğitimle</span>
            <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">Öğrenmekten fazlası: sonuç odaklı bir sistem.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Rocket, title: "Uygulamalı & Güncel", text: "İzle-uygula formatında, güncel araçlar ve gerçek kampanyalarla ilerleyen dersler." },
              { icon: MessageCircle, title: "Yalnız Değilsin", text: "Özel topluluk ve aylık canlı yayınlarda tüm sorularına yanıt bulursun." },
              { icon: ShieldCheck, title: "Ömür Boyu Erişim", text: "Bir kez satın al, güncellenen tüm içeriklere ek ücret ödemeden eriş." },
            ].map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}
                className="bg-ink border border-white/8 rounded-2xl p-7 hover:border-gold/30 transition-colors duration-300" data-testid={`detail-feature-${i}`}>
                <span className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center"><f.icon className="w-7 h-7 text-gold" /></span>
                <h3 className="mt-5 font-heading font-semibold text-lg tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-gold" /> {settings.students_count || "10.000+"} öğrenci</span>
            <span className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Doğrulanabilir sertifika</span>
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-gold" /> Anında erişim</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20 pt-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold/20 via-ink-surface to-ink-surface border border-gold/20 p-10 text-center">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-gold/20 rounded-full blur-[100px]" />
          <div className="relative">
            <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Bu eğitimle bir adım öne geç.</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Ömür boyu erişim, doğrulanabilir sertifika ve uygulamalı içerikler seni bekliyor.</p>
            {!course.enrolled && <Button onClick={isFree ? handleFreeEnroll : handleBuy} disabled={enrolling} className="mt-6 bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-8 gold-glow" data-testid="cta-buy-bottom">{isFree ? "Ücretsiz Kayıt Ol" : `Hemen Kayıt Ol · ${formatPrice(price)} ₺`}</Button>}
          </div>
        </div>
      </section>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0 bg-black border-white/10 overflow-hidden">
          <DialogTitle className="sr-only">{preview?.title || "Video önizleme"}</DialogTitle>
          <div className="aspect-video">{preview?.video_url && <iframe title={preview.title} src={`${toEmbed(preview.video_url)}${toEmbed(preview.video_url).includes("?") ? "&" : "?"}autoplay=1`} className="w-full h-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen data-testid="preview-iframe" />}</div>
          <div className="p-4 bg-ink-surface"><p className="font-heading font-semibold text-sm">{preview?.title}</p></div>
        </DialogContent>
      </Dialog>

      {/* MOBILE STICKY BUY BAR */}
      {!course.enrolled && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center gap-3" data-testid="mobile-buy-bar">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {hasDiscount && <span className="text-xs text-muted-foreground line-through">{formatPrice(course.price)} ₺</span>}
              <span className="font-heading font-black text-xl text-gold" data-testid="mobile-price">{isFree ? "Ücretsiz" : `${formatPrice(price)} ₺`}</span>
              {hasDiscount && <Badge className="bg-destructive/15 text-red-400 border-destructive/20 text-[10px]">%{Math.round((1 - course.discount_price / course.price) * 100)} indirim</Badge>}
            </div>
          </div>
          <Button onClick={isFree ? handleFreeEnroll : handleBuy} disabled={enrolling} data-testid="mobile-enroll-btn" className="bg-gold hover:bg-gold-hover text-ink font-bold h-11 px-6 shrink-0">
            {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : isFree ? "Ücretsiz Kayıt Ol" : "Kayıt Ol"}
          </Button>
        </div>
      )}
    </div>
  );
}
