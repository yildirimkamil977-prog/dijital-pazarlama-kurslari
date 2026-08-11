import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Award, Users, TrendingUp } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { Button } from "@/components/ui/button";

const stats = [
  { icon: TrendingUp, value: "13+", label: "Yıllık Tecrübe" },
  { icon: Users, value: "10.000+", label: "Öğrenci" },
  { icon: Award, value: "1000+", label: "Marka" },
];

const values = [
  "Gerçek marka hesapları üzerinden uygulamalı anlatım",
  "Sıfırdan ileri seviyeye kadar yapılandırılmış müfredat",
  "Her ay güncellenen ve genişleyen ders içerikleri",
  "Öğrenciye özel canlı yayın ve danışmanlık desteği",
];

export default function About() {
  const { settings } = useSite();
  useEffect(() => { document.title = `Hakkımda - ${settings.site_name || "Akademi"}`; }, [settings.site_name]);

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-6">
          <h1 className="mt-4 font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">Merhaba, ben Kamil Yıldırım.</h1>
          <p className="mt-6 text-muted-foreground leading-relaxed text-lg">{settings.about_text}</p>
          <div className="mt-8 space-y-3">
            {values.map((v) => (
              <div key={v} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-gold shrink-0 mt-0.5" />
                <span className="text-sm text-foreground/90">{v}</span>
              </div>
            ))}
          </div>
          <Link to="/kurslar"><Button className="mt-8 bg-gold hover:bg-gold-hover text-ink font-semibold rounded-full px-8" data-testid="about-cta">Eğitimlerimi Keşfet</Button></Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7 }} className="lg:col-span-6">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 gold-glow">
            <img src="https://images.pexels.com/photos/4260481/pexels-photo-4260481.jpeg" alt="Kamil Yıldırım" className="w-full h-[480px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="bg-ink-surface border border-white/5 rounded-2xl p-8 text-center">
            <s.icon className="w-8 h-8 text-gold mx-auto" />
            <p className="mt-4 font-heading font-black text-4xl">{s.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
