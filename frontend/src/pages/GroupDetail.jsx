import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { m as motion } from "framer-motion";
import { Loader2, Video, Users, CalendarDays, Clock, AlertTriangle, User, PlayCircle, CheckCircle2, ListChecks, ShieldCheck, Award, Radio, Star, Sparkles, Check, ShoppingCart } from "lucide-react";
import api, { formatPrice } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CleanPlayer } from "@/components/CleanPlayer";
import { ReviewMedia } from "@/components/ReviewMedia";
import { RichContent } from "@/components/RichContent";
import { optImg, takeInitial, usePageSeo } from "@/lib/page";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSite } from "@/context/SiteContext";
import { Seo } from "@/components/Seo";
import { SocialLinks } from "@/components/SocialLinks";
import { toast } from "sonner";

const MEET_LOGO = "https://cdn.simpleicons.org/googlemeet";
const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" }); } catch { return d; } };

export default function GroupDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addGroup, has } = useCart();
  const { settings } = useSite();
  const navigate = useNavigate();
  const [g, setG] = useState(() => takeInitial(`group:${slug}`));
  const [loading, setLoading] = useState(!g);
  const [playPromo, setPlayPromo] = useState(false);
  const seo = usePageSeo(`/canli-grup-egitimleri/${slug}`);

  useEffect(() => { api.get(`/group-trainings/${slug}`).then(({ data }) => setG(data)).catch(() => setG((cur) => cur)).finally(() => setLoading(false)); }, [slug]);

  const inCart = g ? has(g.group_id) : false;
  const buy = () => { if (!inCart) addGroup(g); navigate(user ? "/odeme" : "/giris"); };
  const addToCart = () => { addGroup(g); toast.success("Sepete eklendi"); };

  if (loading) return <div className="flex justify-center py-40 min-h-[80vh]"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  if (!g) return <div className="text-center py-40 text-muted-foreground">Eğitim bulunamadı.</div>;

  const siteName = settings.site_name || "Akademi";
  const price = g.effective_price ?? g.price;
  const hasDiscount = price < g.price;
  const savePct = hasDiscount && g.price > 0 ? Math.round((1 - price / g.price) * 100) : 0;

  const fade = () => ({});

  return (
    <div className="relative pb-28 lg:pb-0">
      <Seo
        title={seo?.title || `${g.title} | Canlı Grup Eğitimi | ${siteName}`}
        description={seo?.description || (g.description || "").slice(0, 155)}
        keywords={seo?.keywords}
        image={seo?.image}
        url={seo?.canonical}
        jsonLd={seo?.jsonld}
      />

      {/* HERO */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-10">
          <nav className="text-xs text-muted-foreground flex items-center gap-2 mb-6">
            <Link to="/" className="hover:text-gold">Anasayfa</Link><span>/</span>
            <Link to="/canli-grup-egitimleri" className="hover:text-gold">Canlı Grup Eğitimleri</Link><span>/</span>
            <span className="text-foreground/80 truncate">{g.title}</span>
          </nav>
          <div className="grid lg:grid-cols-3 gap-6 items-end">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-bold">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
                  CANLI YAYIN
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium">
                  <img src={MEET_LOGO} alt="Google Meet" className="w-4 h-4" /> Google Meet
                </span>
              </div>
              <h1 className="mt-5 font-heading font-black text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[1.05]">{g.title}</h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                {g.start_date && <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-gold" /> Başlangıç: {trDate(g.start_date)}</span>}
                <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-gold" /> {g.lessons.length} canlı oturum</span>
                <span className="flex items-center gap-2"><Users className="w-4 h-4 text-gold" /> {g.capacity} kişilik kontenjan</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-10">
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-ink border border-white/10 shadow-2xl">
              {g.promo_video && playPromo ? <CleanPlayer url={g.promo_video} title="Tanıtım" testId="group-promo" />
                : (
                  <button type="button" className="group w-full h-full relative" onClick={() => g.promo_video && setPlayPromo(true)} aria-label="Tanıtım videosunu oynat" data-testid="group-promo-poster" disabled={!g.promo_video}>
                    {(g.promo_thumb || g.image) ? <img src={optImg(g.promo_thumb || g.image, 1200)} alt={g.title} fetchpriority="high" width="1200" height="675" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gold/10 to-ink" />}
                    {g.promo_video && <span className="absolute inset-0 flex items-center justify-center bg-ink/30"><span className="w-20 h-20 rounded-full bg-gold text-ink flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-110"><PlayCircle className="w-10 h-10" /></span></span>}
                  </button>
                )}
            </div>

            {/* Google Meet strip */}
            <motion.div {...fade(1)} className="flex items-center gap-4 bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-white/10 rounded-2xl p-5">
              <img src={MEET_LOGO} alt="Google Meet" className="w-11 h-11 shrink-0" />
              <div>
                <p className="font-heading font-semibold">Google Meet üzerinden canlı</p>
                <p className="text-sm text-muted-foreground">Eğitmenle gerçek zamanlı, soru-cevaplı interaktif dersler. Katılım linkleri kayıt sonrası panelinde.</p>
              </div>
            </motion.div>

            {/* Eğitim Takvimi */}
            <div>
              <h2 className="font-heading font-bold text-2xl tracking-tight mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-gold" /> Eğitim Takvimi</h2>
              <div className="space-y-3" data-testid="group-schedule">
                {g.lessons.length === 0 ? <p className="text-sm text-muted-foreground bg-ink-surface border border-white/5 rounded-2xl p-6">Program yakında açıklanacak.</p>
                  : g.lessons.map((l, i) => (
                    <div key={l.id || i} className="group flex items-center justify-between gap-4 bg-ink-surface border border-white/8 rounded-2xl px-5 py-4 hover:border-gold/30 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-gold/10 text-gold text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{l.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 capitalize"><Clock className="w-3.5 h-3.5" /> {trDate(l.date)} · {l.time}{l.end_time ? ` – ${l.end_time}` : ""}</p>
                        </div>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 shrink-0">
                        <img src={MEET_LOGO} alt="" className="w-3.5 h-3.5" /> Canlı
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {g.description && (
              <motion.div {...fade(2)}>
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-4">Eğitim Hakkında</h2>
                <div className="bg-ink-surface border border-white/5 rounded-2xl p-7">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{g.description}</p>
                </div>
              </motion.div>
            )}

            {/* Neler öğreneceksin */}
            {g.what_you_learn?.length > 0 && (
              <motion.div {...fade(0)}>
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-gold" /> Neler Öğreneceksin</h2>
                <div className="grid sm:grid-cols-2 gap-3" data-testid="group-outcomes">
                  {g.what_you_learn.map((w, i) => (
                    <div key={i} className="flex items-start gap-3 bg-ink-surface border border-white/5 rounded-xl px-4 py-3.5">
                      <CheckCircle2 className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/90">{w}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Müfredat */}
            {g.curriculum?.length > 0 && (
              <div data-testid="group-curriculum">
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-4 flex items-center gap-2"><ListChecks className="w-5 h-5 text-gold" /> Müfredat</h2>
                <Accordion type="multiple" defaultValue={g.curriculum.slice(0, 1).map((m) => m.id)} className="space-y-3">
                  {g.curriculum.map((m, i) => (
                    <AccordionItem key={m.id} value={m.id} className="bg-ink-surface border border-white/8 rounded-2xl px-5" data-testid={`group-curriculum-module-${i}`}>
                      <AccordionTrigger className="hover:no-underline py-4 text-left">
                        <span className="flex items-center gap-4"><span className="w-9 h-9 rounded-xl bg-gold/10 text-gold text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span><span className="font-semibold text-sm sm:text-base">{m.title}</span></span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 pb-2 pl-1">
                          {m.topics.map((t, j) => <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-gold mt-0.5 shrink-0" /> {t}</li>)}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {g.long_description && (
              <section className="bg-ink-surface border border-white/5 rounded-2xl p-7" data-testid="group-long-description-section">
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-5">Eğitim Hakkında Detaylı Bilgi</h2>
                <RichContent html={g.long_description} testId="group-long-description" />
              </section>
            )}
            {g.requirements?.length > 0 && (
              <motion.div {...fade(0)}>
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-4 flex items-center gap-2"><ListChecks className="w-5 h-5 text-gold" /> Gereksinimler</h2>
                <ul className="space-y-2.5 bg-ink-surface border border-white/5 rounded-2xl p-6" data-testid="group-requirements">
                  {g.requirements.map((r, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" /> {r}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Eğitmen */}
            {g.instructor && (
              <motion.div {...fade(1)} data-testid="group-instructor-card">
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-4">Eğitmenin</h2>
                <div className="bg-gradient-to-br from-gold/10 to-ink-surface border border-gold/15 rounded-3xl p-7">
                  <div className="flex items-start gap-5">
                    <Link to={`/egitmen/${g.instructor.slug}`} className="shrink-0">
                      {g.instructor.avatar ? <img src={optImg(g.instructor.avatar, 160)} alt={g.instructor.name} loading="lazy" width="80" height="80" className="w-20 h-20 rounded-2xl object-cover border border-white/10" /> : <span className="w-20 h-20 rounded-2xl bg-gold/10 flex items-center justify-center"><User className="w-9 h-9 text-gold" /></span>}
                    </Link>
                    <div className="min-w-0">
                      <Link to={`/egitmen/${g.instructor.slug}`} className="font-heading font-semibold text-lg hover:text-gold transition-colors">{g.instructor.name}</Link>
                      {g.instructor.title && <p className="text-sm text-gold">{g.instructor.title}</p>}
                      {g.instructor.bio && <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-4">{g.instructor.bio}</p>}
                      <div className="mt-4 flex items-center gap-4 flex-wrap">
                        <SocialLinks links={g.instructor.social_links} />
                        <Link to={`/egitmen/${g.instructor.slug}`} className="text-xs text-gold font-medium hover:underline">Profili görüntüle →</Link>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Video yorumlar */}
            {g.reviews?.length > 0 && (
              <motion.div {...fade(0)}>
                <h2 className="font-heading font-bold text-2xl tracking-tight mb-5 flex items-center gap-2"><Star className="w-5 h-5 text-gold" fill="currentColor" /> Öğrenci Yorumları</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {g.reviews.map((r, i) => (
                    <div key={i} className="bg-ink-surface border border-white/5 rounded-2xl overflow-hidden" data-testid={`group-review-${i}`}>
                      <ReviewMedia review={r} testId={`group-review-${i}`} />
                      <div className="p-4">
                        <div className="flex gap-0.5 mb-2">{Array.from({ length: r.rating || 5 }).map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-gold" fill="currentColor" />)}</div>
                        <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4">"{r.quote}"</p>
                        <div className="mt-3 pt-3 border-t border-white/5"><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">{r.role}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="lg:col-span-1">
            <motion.div className="lg:sticky lg:top-28 bg-ink-surface border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-br from-gold/15 to-transparent px-6 pt-6 pb-5 border-b border-white/8">
                <span className="overline text-gold text-[11px]">Canlı Grup Eğitimi</span>
                <div className="mt-2 flex items-end gap-3 flex-wrap">
                  {hasDiscount && <span className="text-muted-foreground line-through text-lg whitespace-nowrap" data-testid="group-original-price">{formatPrice(g.price)} ₺</span>}
                  <span className="font-heading font-black text-4xl text-gold whitespace-nowrap" data-testid="group-price-display">{formatPrice(price)} ₺</span>
                  {savePct > 0 && <span className="mb-1.5 bg-gold text-ink rounded-md px-2 py-0.5 text-xs font-black whitespace-nowrap" data-testid="group-discount-badge">%{savePct} indirim</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tek seferlik ödeme · Ömür boyu topluluk</p>
              </div>

              <div className="p-6">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Kontenjan</span><span className="font-medium">{g.capacity} kişi</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><Radio className="w-4 h-4" /> Kalan Yer</span><span data-testid="group-remaining" className={g.low_stock ? "text-red-400 font-bold" : "font-medium text-green-400"}>{g.remaining} kişi</span></div>
                  {g.start_date && <div className="flex items-center justify-between"><span className="text-muted-foreground flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Başlangıç</span><span className="font-medium text-right text-xs">{trDate(g.start_date)}</span></div>}
                </div>

                {/* kontenjan bar */}
                {g.capacity > 0 && (
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                      <div className={`h-full rounded-full ${g.low_stock ? "bg-red-500" : "bg-gold"}`} style={{ width: `${Math.min(100, Math.round((g.enrolled / g.capacity) * 100))}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{g.enrolled}/{g.capacity} kayıt dolu</p>
                  </div>
                )}

                {g.low_stock && !g.sold_out && (
                  <div data-testid="group-urgency" className="mt-4 flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl px-3 py-2.5 text-sm font-semibold animate-pulse">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Acele et! Son {g.remaining} kontenjan kaldı
                  </div>
                )}

                {g.sold_out ? (
                  <Button disabled className="w-full mt-5 h-13 py-3.5" data-testid="group-soldout">Kontenjan Doldu</Button>
                ) : (
                  <div className="mt-5 space-y-3">
                    <Button onClick={buy} data-testid="group-buy" className="w-full h-13 py-3.5 bg-gold hover:bg-gold-hover text-ink font-bold text-base">Eğitime Kaydol</Button>
                    <Button onClick={addToCart} disabled={inCart} variant="outline" data-testid="group-add-to-cart" className="w-full h-12 border-white/15">
                      {inCart ? <><Check className="w-4 h-4 mr-2" /> Sepette</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Sepete Ekle</>}
                    </Button>
                  </div>
                )}

                <div className="mt-5 space-y-2.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><img src={MEET_LOGO} alt="" className="w-4 h-4" /> Google Meet ile canlı katılım</p>
                  <p className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Katılım sonrası katılım belgesi</p>
                  <p className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gold" /> Güvenli ödeme · Kredi kartı</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-4 text-center border-t border-white/5 pt-4">Katılım linkleri kayıt sonrası öğrenci panelinde görünür.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center gap-4" data-testid="group-mobile-bar">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {hasDiscount && <span className="text-xs text-muted-foreground line-through whitespace-nowrap">{formatPrice(g.price)} ₺</span>}
            <span className="font-heading font-black text-xl text-gold whitespace-nowrap" data-testid="group-mobile-price">{formatPrice(price)} ₺</span>
            {savePct > 0 && <Badge className="text-[10px] bg-destructive/15 text-red-400 border-destructive/20" data-testid="group-mobile-discount-badge">%{savePct} indirim</Badge>}
          </div>
          <p className={`text-[11px] ${g.low_stock ? "text-red-400" : "text-muted-foreground"}`}>{g.remaining} kontenjan kaldı</p>
        </div>
        {g.sold_out ? (
          <Button disabled className="flex-1 h-12" data-testid="group-mobile-soldout">Kontenjan Doldu</Button>
        ) : (
          <Button onClick={buy} data-testid="group-mobile-buy" className="flex-1 h-12 bg-gold hover:bg-gold-hover text-ink font-bold">Eğitime Kaydol</Button>
        )}
      </div>
    </div>
  );
}
