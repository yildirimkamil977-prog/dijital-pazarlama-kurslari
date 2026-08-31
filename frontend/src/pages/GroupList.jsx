import { useEffect, useState } from "react";
import { Loader2, Radio, Users, MessageCircle, Award } from "lucide-react";
import api from "@/lib/api";
import { GroupCard } from "@/components/GroupCard";

const MEET_LOGO = "https://cdn.simpleicons.org/googlemeet";

export default function GroupList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { document.title = "Canlı Grup Eğitimleri"; api.get("/group-trainings").then(({ data }) => setItems(data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="relative">
      {/* HERO */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-12">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-bold">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
              CANLI EĞİTİMLER
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium">
              <img src={MEET_LOGO} alt="Google Meet" className="w-4 h-4" /> Google Meet
            </span>
          </div>
          <h1 className="mt-5 font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter leading-[0.98]">Canlı Grup Eğitimleri</h1>
          <p className="mt-5 text-muted-foreground text-base sm:text-lg max-w-2xl leading-relaxed">Sınırlı kontenjanlı, canlı ve etkileşimli grup eğitimleriyle birlikte öğren. Google Meet üzerinden gerçek zamanlı soru-cevap ve uygulama.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-gold" /> Canlı & interaktif dersler</span>
            <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-gold" /> Gerçek zamanlı soru-cevap</span>
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-gold" /> Sınırlı kontenjan</span>
            <span className="flex items-center gap-2"><Award className="w-4 h-4 text-gold" /> Katılım sertifikası</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        {loading ? <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
          : items.length === 0 ? (
            <div className="text-center py-24 bg-ink-surface border border-white/5 rounded-3xl">
              <Radio className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground mt-4 text-lg">Yakında yeni canlı eğitimler eklenecek.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((g, i) => <GroupCard key={g.group_id} g={g} index={i} />)}
            </div>
          )}
      </div>
    </div>
  );
}
