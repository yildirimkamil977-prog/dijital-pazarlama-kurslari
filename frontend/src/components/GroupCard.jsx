import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, CalendarDays, ArrowRight, Radio } from "lucide-react";
import { formatPrice } from "@/lib/api";

const MEET_LOGO = "https://cdn.simpleicons.org/googlemeet";
const trDate = (d) => { try { return new Date(d + "T00:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }); } catch { return d; } };

export function GroupCard({ g, index = 0 }) {
  const pct = g.capacity > 0 ? Math.min(100, Math.round((g.enrolled / g.capacity) * 100)) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: index * 0.08 }} className="h-full">
      <Link to={`/canli-grup-egitimleri/${g.slug}`} data-testid={`group-card-${g.slug}`} className="group flex flex-col h-full bg-ink-surface border border-white/8 rounded-3xl overflow-hidden hover:border-gold/40 transition-colors duration-300">
        <div className="relative aspect-video bg-ink overflow-hidden">
          {g.image ? <img src={g.image} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center"><Radio className="w-10 h-10 text-muted-foreground" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
          <span className="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span> CANLI
          </span>
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-ink/80 backdrop-blur text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/10"><img src={MEET_LOGO} alt="" className="w-3.5 h-3.5" /> Google Meet</span>
          {g.sold_out ? <span className="absolute bottom-3 left-3 bg-secondary text-white text-[11px] font-bold px-2.5 py-1 rounded-full">Kontenjan Doldu</span>
            : g.low_stock && <span className="absolute bottom-3 left-3 bg-gold text-ink text-[11px] font-bold px-2.5 py-1 rounded-full animate-pulse">Son {g.remaining} kontenjan!</span>}
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-heading font-semibold text-lg leading-snug line-clamp-2 group-hover:text-gold transition-colors duration-200">{g.title}</h3>
          {g.instructor && (
            <div className="flex items-center gap-2 mt-3">
              {g.instructor.avatar ? <img src={g.instructor.avatar} alt={g.instructor.name} className="w-6 h-6 rounded-full object-cover border border-white/10" /> : <span className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center"><Users className="w-3 h-3 text-gold" /></span>}
              <span className="text-xs text-muted-foreground truncate">{g.instructor.name}</span>
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {g.start_date ? trDate(g.start_date) : "Yakında"}</span>
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {g.remaining}/{g.capacity} kontenjan</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/8 overflow-hidden"><div className={`h-full rounded-full ${g.low_stock ? "bg-red-500" : "bg-gold"}`} style={{ width: `${pct}%` }} /></div>
          <div className="flex items-center justify-between mt-auto pt-4 mt-4 border-t border-white/5">
            <span className="font-heading font-black text-xl text-gold">{formatPrice(g.price)} ₺</span>
            <span className="text-sm text-gold flex items-center gap-1 group-hover:gap-2 transition-all duration-200">İncele <ArrowRight className="w-4 h-4" /></span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
