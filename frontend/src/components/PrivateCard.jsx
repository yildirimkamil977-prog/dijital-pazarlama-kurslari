import { Link } from "react-router-dom";
import { Video, CalendarClock, PhoneCall, UserCheck, Briefcase, ListOrdered, Route, Timer, HardDriveDownload, MessageCircleQuestion, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/api";
import { optImg } from "@/lib/page";

export const privateFeatures = (p) => [
  { icon: Video, title: "Google Meet üzerinden canlı", text: "Tüm dersler eğitmenle birebir, canlı olarak yapılır." },
  { icon: CalendarClock, title: "Senin programına göre", text: "Dersler müsait olduğun gün ve saatlere göre planlanır." },
  { icon: PhoneCall, title: "Hemen planlama", text: "Kaydının hemen ardından seninle iletişime geçip programı birlikte oluştururuz." },
  { icon: UserCheck, title: `Eğitmen: ${p?.instructor?.name || "Kamil Yıldırım"}`, text: "Sektör deneyimini doğrudan senin hesabına aktarır." },
  { icon: Briefcase, title: "Tamamen uygulamalı", text: "Gerçek işletme hesapları üzerinden ilerlenir." },
  { icon: ListOrdered, title: `${p?.lesson_count || 8} ders`, text: "Net, planlı ve hedef odaklı bir ders paketi." },
  { icon: Route, title: "İhtiyacına göre müfredat", text: "Hazır müfredat var; istersen tamamen senin ihtiyacına göre ilerleriz." },
  { icon: Timer, title: p?.lesson_duration || "60-90 dakika", text: "Her ders 1 ile 1,5 saat arasında sürer." },
  { icon: HardDriveDownload, title: "Ömür boyu ders kayıtları", text: "Tüm dersler kaydedilir, öğrenci panelinden ömür boyu izlenir." },
  { icon: MessageCircleQuestion, title: "1 ay soru hakkı", text: "Eğitim bittikten sonra 1 ay boyunca soru sorabilirsin." },
];

export function PrivateCard({ p, testId }) {
  const save = p.effective_price < p.price;
  return (
    <Link to={`/bire-bir-canli-egitimler/${p.slug}`} className="group bg-ink-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-gold/30 transition-colors duration-300" data-testid={testId || `private-card-${p.private_id}`}>
      <div className="relative aspect-video bg-ink-elevated overflow-hidden">
        {p.image && <img src={optImg(p.image, 800)} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-ink/85 backdrop-blur text-[11px] font-bold px-2.5 py-1 rounded-full border border-gold/30 text-gold">1:1 CANLI</span>
        {p.sale_stopped && <span className="absolute bottom-3 left-3 bg-secondary text-white text-[11px] font-bold px-2.5 py-1 rounded-full">Bu ayın kontenjanı doldu</span>}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-heading font-bold text-lg leading-snug group-hover:text-gold transition-colors duration-200">{p.title}</h3>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
        <p className="text-xs text-muted-foreground mt-3">{p.lesson_count} ders · {p.lesson_duration} · Google Meet</p>
        <div className="mt-auto pt-4 flex items-end justify-between">
          <div>
            {save && <span className="text-xs text-muted-foreground line-through mr-2">{formatPrice(p.price)} ₺</span>}
            <span className="font-heading font-black text-xl text-gold">{formatPrice(p.effective_price)} ₺</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gold group-hover:translate-x-1 transition-transform duration-200" />
        </div>
      </div>
    </Link>
  );
}
