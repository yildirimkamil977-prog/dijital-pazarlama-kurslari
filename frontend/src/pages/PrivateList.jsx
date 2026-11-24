import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { PrivateCard, privateFeatures } from "@/components/PrivateCard";
import { Seo } from "@/components/Seo";

export default function PrivateList() {
  const [list, setList] = useState(null);
  useEffect(() => { api.get("/private-trainings").then(({ data }) => setList(data)).catch(() => setList([])); }, []);
  const feats = privateFeatures(list?.[0]).slice(0, 4);
  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16" data-testid="private-list-page">
      <Seo title="Bire Bir Canlı Eğitimler" description="Google Meet üzerinden, senin programına göre planlanan, tamamen uygulamalı bire bir canlı eğitimler." />
      <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase">Sadece sana özel</p>
      <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight mt-3 max-w-3xl">Bire Bir Canlı Eğitimler</h1>
      <p className="text-muted-foreground mt-5 max-w-2xl text-base">Eğitmenle birebir, Google Meet üzerinden canlı dersler. Program senin müsait olduğun gün ve saatlere göre planlanır, tüm ders kayıtları panelinde ömür boyu seninle kalır.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
        {feats.map((f) => <div key={f.title} className="bg-ink-surface border border-white/5 rounded-xl p-4 flex items-start gap-3"><f.icon className="w-5 h-5 text-gold shrink-0" /><div><p className="text-sm font-semibold">{f.title}</p><p className="text-xs text-muted-foreground mt-0.5">{f.text}</p></div></div>)}
      </div>
      {!list ? <div className="py-24 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-gold" /></div> : list.length === 0 ? (
        <p className="text-muted-foreground mt-14" data-testid="private-empty">Yakında bire bir canlı eğitimler burada olacak.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">{list.map((p) => <PrivateCard key={p.private_id} p={p} />)}</div>
      )}
    </div>
  );
}
