import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, Check, ShoppingCart, BellRing, CalendarCheck, PhoneCall, Video, MessageCircleQuestion, Play, ShieldCheck, Infinity as InfinityIcon, Sparkles, UserRound, CreditCard, Landmark } from "lucide-react";
import api, { formatPrice, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { RichContent } from "@/components/RichContent";
import { VideoDialog } from "@/components/CleanPlayer";
import { privateFeatures } from "@/components/PrivateCard";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { optImg } from "@/lib/page";
import { Seo } from "@/components/Seo";
import { trackViewContent } from "@/lib/track";
import { toast } from "sonner";

const STEPS = [
  { icon: CheckCircle2, t: "Kaydını oluştur", d: "Güvenli ödeme ile yerini ayırt." },
  { icon: PhoneCall, t: "Planlama görüşmesi", d: "Hemen seninle iletişime geçip müsait gün ve saatlerini alırız." },
  { icon: Video, t: "Canlı dersler", d: "Google Meet üzerinden, gerçek hesaplarda uygulamalı ilerleriz." },
  { icon: MessageCircleQuestion, t: "1 ay destek", d: "Eğitim sonrası 1 ay soru hakkı, kayıtlar ömür boyu panelinde." },
];
const FAQ = [
  ["Dersler ne zaman yapılıyor?", "Kaydının ardından seninle iletişime geçiyoruz ve dersleri senin müsait olduğun gün ve saatlere göre planlıyoruz."],
  ["Ders kayıtlarına nasıl ulaşırım?", "Tüm canlı dersler kaydedilir ve öğrenci panelindeki Bire Bir Eğitimlerim bölümünde ömür boyu erişimine açılır."],
  ["Müfredat dışına çıkabilir miyiz?", "Evet. Hazır bir müfredatımız var, ancak talep edersen tamamen senin işletmenin ve hedeflerinin ihtiyacına göre ilerleriz."],
  ["Eğitim bittikten sonra destek var mı?", "Eğitim tamamlandıktan sonra 1 ay boyunca soru sorma hakkın bulunur."],
];

function Waitlist({ p }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const join = async (e) => {
    e.preventDefault();
    try { await api.post(`/private-trainings/${p.private_id}/notify`, { email }); setDone(true); } catch (err) { toast.error(apiError(err)); }
  };
  return (
    <div className="mt-5 bg-gold/5 border border-gold/20 rounded-xl p-4" data-testid="private-waitlist">
      <p className="text-sm font-semibold flex items-center gap-2"><BellRing className="w-4 h-4 text-gold" /> Bu ayki kontenjanımız dolmuştur</p>
      <p className="text-xs text-muted-foreground mt-1">Kısa süre içerisinde tekrar kayıtlar açılacaktır. Açıldığında sana haber verelim.</p>
      {done ? <p className="text-sm text-green-400 mt-3" data-testid="private-waitlist-done">Listeye eklendin, kontenjan açılınca e-posta alacaksın.</p> : (
        <form onSubmit={join} className="flex gap-2 mt-3">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta adresin" className="bg-ink border-white/10 h-10" data-testid="private-waitlist-email" />
          <Button type="submit" className="bg-gold text-ink font-semibold h-10 shrink-0" data-testid="private-waitlist-submit">Açılınca Haber Ver</Button>
        </form>
      )}
    </div>
  );
}

function BuyBox({ p, inCart, onBuy, onAdd }) {
  const save = p.effective_price < p.price;
  const pct = save ? Math.round(100 * (1 - p.effective_price / p.price)) : 0;
  const perLesson = p.lesson_count ? p.effective_price / p.lesson_count : 0;
  const includes = [
    { icon: Video, t: `${p.lesson_count} canlı ders`, d: "Google Meet üzerinden, sadece sen ve eğitmen" },
    { icon: CalendarCheck, t: "Sana uygun gün ve saatler", d: "Program müsaitliğine göre planlanır" },
    { icon: Sparkles, t: "Sana özel müfredat", d: "İstersen işletmene göre uyarlanır" },
    { icon: InfinityIcon, t: "Ömür boyu kayıt erişimi", d: "Tüm dersler panelinde kalır" },
    { icon: MessageCircleQuestion, t: "1 ay soru hakkı", d: "Eğitim sonrası doğrudan destek" },
  ];
  return (
    <div className="relative bg-ink-surface border border-white/10 rounded-2xl overflow-hidden lg:sticky lg:top-24" data-testid="private-buy-box">
      <div className="h-1 bg-gradient-to-r from-gold/0 via-gold to-gold/0" />
      <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
      <div className="relative p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold"><UserRound className="w-3.5 h-3.5" /> Bire Bir · Canlı</span>
        {save && <span className="text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-2.5 py-1" data-testid="private-discount-badge">%{pct} İNDİRİM</span>}
      </div>
      <div className="flex items-end gap-3 mt-3">
        <span className="font-heading font-black text-4xl text-gold" data-testid="private-price">{formatPrice(p.effective_price)} ₺</span>
        {save && <span className="text-muted-foreground line-through mb-1">{formatPrice(p.price)} ₺</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
        {save && <span className="text-green-400 font-semibold" data-testid="private-saving">{formatPrice(p.price - p.effective_price)} ₺ tasarruf</span>}
        {perLesson > 0 && <span className="text-muted-foreground">Ders başı {formatPrice(Math.round(perLesson))} ₺</span>}
      </div>
      {p.sale_stopped ? <Waitlist p={p} /> : (
        <div className="mt-5 space-y-3">
          <Button onClick={onBuy} className="w-full h-12 bg-gold hover:bg-gold-hover text-ink font-bold" data-testid="private-buy">Hemen Kaydol</Button>
          <Button onClick={onAdd} disabled={inCart} variant="outline" className="w-full h-11 border-white/15" data-testid="private-add-to-cart">{inCart ? <><Check className="w-4 h-4 mr-2" /> Sepette</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Sepete Ekle</>}</Button>
        </div>
      )}
      <div className="mt-6 pt-5 border-t border-white/5">
        <p className="text-xs font-semibold text-foreground mb-3">Bu eğitime neler dahil?</p>
        <ul className="space-y-3" data-testid="private-includes">
          {includes.map((it) => (
            <li key={it.t} className="flex gap-3">
              <span className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0"><it.icon className="w-4 h-4 text-gold" /></span>
              <div><p className="text-sm font-medium leading-tight">{it.t}</p><p className="text-[11px] text-muted-foreground mt-0.5">{it.d}</p></div>
            </li>
          ))}
        </ul>
      </div>
      {p.instructor && (
        <div className="mt-5 flex items-center gap-3 bg-ink rounded-xl p-3" data-testid="private-buybox-instructor">
          {p.instructor.avatar && <img src={p.instructor.avatar} alt={p.instructor.name} className="w-10 h-10 rounded-full object-cover" />}
          <div className="min-w-0"><p className="text-[11px] text-muted-foreground">Eğitmenin</p><p className="text-sm font-semibold truncate">{p.instructor.name}</p></div>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Güvenli ödeme</span>
        <span className="inline-flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Kredi kartı</span>
        <span className="inline-flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> Havale / EFT</span>
      </div>
      </div>
    </div>
  );
}

function MobileBar({ p, onBuy }) {
  const save = p.effective_price < p.price;
  const pct = save ? Math.round(100 * (1 - p.effective_price / p.price)) : 0;
  const toBox = () => document.getElementById("private-buy-mobile")?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ink/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center gap-3" data-testid="private-mobile-bar">
      <div className="flex-1 min-w-0">
        {p.sale_stopped ? <p className="text-sm font-semibold text-gold" data-testid="private-mobile-full">Kontenjan doldu</p> : (
          <>
            {save && <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground line-through whitespace-nowrap">{formatPrice(p.price)} ₺</span><span className="text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-2 py-0.5 whitespace-nowrap" data-testid="private-mobile-discount">%{pct} indirim</span></div>}
            <span className="font-heading font-black text-xl text-gold whitespace-nowrap leading-tight" data-testid="private-mobile-price">{formatPrice(p.effective_price)} ₺</span>
          </>
        )}
        {(!save || p.sale_stopped) && <p className="text-[11px] text-muted-foreground truncate">{p.lesson_count} canlı ders · Bire bir</p>}
      </div>
      {p.sale_stopped
        ? <Button onClick={toBox} className="bg-gold text-ink font-bold rounded-full px-5 shrink-0" data-testid="private-mobile-notify"><BellRing className="w-4 h-4 mr-1.5" /> Haber Ver</Button>
        : <Button onClick={onBuy} className="bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-6 shrink-0" data-testid="private-mobile-buy">Hemen Kaydol</Button>}
    </div>
  );
}

export default function PrivateDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addPrivate, has } = useCart();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  const [video, setVideo] = useState(false);
  useEffect(() => {
    api.get(`/private-trainings/${slug}`).then(({ data }) => { setP(data); trackViewContent({ id: data.private_id, title: data.title, price: data.effective_price, category: "Bire Bir Canlı Eğitim" }); }).catch(() => setErr(true));
  }, [slug]);
  if (err) return <div className="py-32 text-center text-muted-foreground">Eğitim bulunamadı. <Link to="/bire-bir-canli-egitimler" className="text-gold">Tüm bire bir eğitimler</Link></div>;
  if (!p) return <div className="py-32 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-gold" /></div>;
  const inCart = has(p.private_id);
  const buy = () => { if (!inCart) addPrivate(p); navigate(user ? "/odeme" : "/giris"); };
  const add = () => { addPrivate(p); toast.success("Sepete eklendi"); };

  return (
    <div data-testid="private-detail-page" className="pb-24 lg:pb-0">
      <Seo title={p.title} description={p.description} image={p.image} />
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-16 grid lg:grid-cols-[1fr_380px] gap-10">
        <div>
          <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase">Bire Bir Canlı Eğitim</p>
          <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tight mt-3" data-testid="private-title">{p.title}</h1>
          <p className="text-muted-foreground mt-4 text-base max-w-2xl">{p.description}</p>
          <div className={`relative aspect-video rounded-2xl overflow-hidden bg-ink-elevated mt-8 ${p.promo_video ? "cursor-pointer group" : ""}`} onClick={() => p.promo_video && setVideo(true)} data-testid="private-cover">
            {p.image && <img src={optImg(p.image, 1200)} alt={p.title} className="w-full h-full object-cover" />}
            {p.promo_video && <div className="absolute inset-0 bg-ink/40 flex items-center justify-center"><span className="w-16 h-16 rounded-full bg-gold flex items-center justify-center group-hover:scale-110 transition-transform duration-300"><Play className="w-7 h-7 text-ink ml-1" fill="currentColor" /></span></div>}
          </div>
          <div className="lg:hidden mt-8" id="private-buy-mobile"><BuyBox p={p} inCart={inCart} onBuy={buy} onAdd={add} /></div>

          <h2 className="font-heading font-bold text-2xl mt-14 mb-6">Bu eğitimde seni neler bekliyor?</h2>
          <div className="grid sm:grid-cols-2 gap-3" data-testid="private-features">
            {privateFeatures(p).map((f) => <div key={f.title} className="bg-ink-surface border border-white/5 rounded-xl p-4 flex gap-3 hover:border-gold/20 transition-colors duration-200"><span className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0"><f.icon className="w-5 h-5 text-gold" /></span><div><p className="text-sm font-semibold">{f.title}</p><p className="text-xs text-muted-foreground mt-1">{f.text}</p></div></div>)}
          </div>

          <h2 className="font-heading font-bold text-2xl mt-14 mb-6">Süreç nasıl ilerliyor?</h2>
          <ol className="grid sm:grid-cols-4 gap-4">
            {STEPS.map((s, i) => <li key={s.t} className="relative bg-ink-surface border border-white/5 rounded-xl p-4"><span className="text-[11px] font-bold text-gold">0{i + 1}</span><s.icon className="w-5 h-5 text-gold mt-2" /><p className="text-sm font-semibold mt-2">{s.t}</p><p className="text-xs text-muted-foreground mt-1">{s.d}</p></li>)}
          </ol>

          {p.long_description && <div className="mt-14"><RichContent html={p.long_description} /></div>}

          {p.curriculum?.length > 0 && (
            <>
              <h2 className="font-heading font-bold text-2xl mt-14 mb-2">Müfredat</h2>
              <p className="text-sm text-muted-foreground mb-5">İstersen müfredatı tamamen senin ihtiyacına göre uyarlarız.</p>
              <Accordion type="multiple" className="space-y-2" data-testid="private-curriculum">
                {p.curriculum.map((m, i) => (
                  <AccordionItem key={i} value={`m${i}`} className="bg-ink-surface border border-white/5 rounded-xl px-4">
                    <AccordionTrigger className="font-semibold text-sm">{m.title}</AccordionTrigger>
                    <AccordionContent><ul className="space-y-2">{(m.topics || []).map((t, j) => <li key={j} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="w-4 h-4 text-gold mt-0.5 shrink-0" /> {t}</li>)}</ul></AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}

          {p.instructor && (
            <div className="mt-14 bg-ink-surface border border-white/5 rounded-2xl p-6 flex gap-5 items-start" data-testid="private-instructor">
              {p.instructor.avatar && <img src={p.instructor.avatar} alt={p.instructor.name} className="w-20 h-20 rounded-2xl object-cover" />}
              <div><p className="text-xs text-gold font-bold uppercase tracking-wider">Eğitmenin</p><Link to={`/egitmen/${p.instructor.slug}`} className="font-heading font-bold text-xl hover:text-gold">{p.instructor.name}</Link><p className="text-sm text-muted-foreground">{p.instructor.title}</p><p className="text-sm text-muted-foreground mt-2 line-clamp-4">{p.instructor.bio}</p></div>
            </div>
          )}

          <h2 className="font-heading font-bold text-2xl mt-14 mb-5">Sık Sorulan Sorular</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ.map(([q, a], i) => <AccordionItem key={i} value={`f${i}`} className="bg-ink-surface border border-white/5 rounded-xl px-4"><AccordionTrigger className="text-sm font-semibold text-left">{q}</AccordionTrigger><AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent></AccordionItem>)}
          </Accordion>
        </div>
        <div className="hidden lg:block"><BuyBox p={p} inCart={inCart} onBuy={buy} onAdd={add} /></div>
      </section>
      <MobileBar p={p} onBuy={buy} />
      <VideoDialog url={p.promo_video} open={video} onOpenChange={setVideo} title={p.title} testId="private-promo" />
    </div>
  );
}
