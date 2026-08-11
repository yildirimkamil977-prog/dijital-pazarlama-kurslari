import { Link } from "react-router-dom";
import { GraduationCap, Mail, Phone, MapPin } from "lucide-react";
import { useSite } from "@/context/SiteContext";

const legal = [
  { to: "/sozlesmeler/kvkk", label: "KVKK Aydınlatma Metni" },
  { to: "/sozlesmeler/gizlilik", label: "Gizlilik Politikası" },
  { to: "/sozlesmeler/uyelik", label: "Üyelik Sözleşmesi" },
  { to: "/sozlesmeler/mesafeli-satis", label: "Mesafeli Satış Sözleşmesi" },
];

export function Footer() {
  const { settings } = useSite();
  return (
    <footer className="relative border-t border-white/10 bg-ink-surface/50 mt-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-ink" strokeWidth={2.5} />
            </span>
            <span className="font-heading font-bold text-lg">{settings.site_name}</span>
          </Link>
          <p className="mt-5 text-sm text-muted-foreground max-w-sm leading-relaxed">
            {settings.tagline || "Dijital pazarlamada uygulamalı, güncel ve sonuç odaklı eğitimler."}
          </p>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            {settings.contact_email && (
              <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 hover:text-gold transition-colors duration-200">
                <Mail className="w-4 h-4" /> {settings.contact_email}
              </a>
            )}
            {settings.support_phone && (
              <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> {settings.support_phone}</span>
            )}
            {settings.address && (
              <span className="flex items-start gap-2"><MapPin className="w-4 h-4 shrink-0 mt-0.5" /> {settings.address}</span>
            )}
          </div>
        </div>

        <div className="md:col-span-3">
          <h4 className="overline text-gold mb-4">Keşfet</h4>
          <ul className="space-y-3 text-sm">
            <li><Link to="/kurslar" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Tüm Kurslar</Link></li>
            <li><Link to="/hakkimda" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Hakkımda</Link></li>
            <li><Link to="/giris" className="text-muted-foreground hover:text-foreground transition-colors duration-200">Öğrenci Girişi</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h4 className="overline text-gold mb-4">Yasal</h4>
          <ul className="space-y-3 text-sm">
            {legal.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-muted-foreground hover:text-foreground transition-colors duration-200">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} {settings.site_name}. Tüm hakları saklıdır.</span>
          <div className="flex gap-4"><Link to="/iletisim" className="hover:text-gold">İletişim</Link><span>Güvenli ödeme: PayTR & Havale/EFT</span></div>
        </div>
      </div>
    </footer>
  );
}
