import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, Check, ShoppingCart, BellRing, CalendarCheck, PhoneCall, Video, MessageCircleQuestion, Play } from "lucide-react";
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
  return (
    <div className="bg-ink-surface border border-white/10 rounded-2xl p-6 lg:sticky lg:top-24" data-testid="private-buy-box">
      <div className="flex items-end gap-3">
        <span className="font-heading font-black text-4xl text-gold" data-testid="private-price">{formatPrice(p.effective_price)} ₺</span>
        {save && <span className="text-muted-foreground line-through mb-1">{formatPrice(p.price)} ₺</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{p.lesson_count} ders · {p.lesson_duration} · Google Meet</p>
      {p.sale_stopped ? <Waitlist p={p} /> : (
        <div className="mt-5 space-y-3">
          <Button onClick={onBuy} className="w-full h-12 bg-gold hover:bg-gold-hover text-ink font-bold" data-testid="private-buy">Hemen Kaydol</Button>
          <Button onClick={onAdd} disabled={inCart} variant="outline" className="w-full h-11 border-white/15" data-testid="private-add-to-cart">{inCart ? <><Check className="w-4 h-4 mr-2" /> Sepette</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Sepete Ekle</>}</Button>
        </div>
      )}
      <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
        {["Kontenjan yok, herkes katılabilir", "Ders kayıtlarına ömür boyu erişim", "Eğitim sonrası 1 ay soru hakkı"].map((t) => <li key={t} className="flex items-center gap-2"><CalendarCheck className="w-3.5 h-3.5 text-gold" /> {t}</li>)}
      </ul>
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
    <div data-testid="private-detail-page">
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
          <div className="lg:hidden mt-8"><BuyBox p={p} inCart={inCart} onBuy={buy} onAdd={add} /></div>

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
      <VideoDialog url={p.promo_video} open={video} onOpenChange={setVideo} title={p.title} testId="private-promo" />
    </div>
  );
}
