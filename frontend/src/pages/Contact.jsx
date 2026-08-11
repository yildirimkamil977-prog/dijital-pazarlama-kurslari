import { useEffect } from "react";
import { Mail, Phone, MapPin, MessageCircle, Clock } from "lucide-react";
import { useSite } from "@/context/SiteContext";

export default function Contact() {
  const { settings } = useSite();
  useEffect(() => { document.title = `İletişim - ${settings.site_name || "Akademi"}`; window.scrollTo(0, 0); }, [settings.site_name]);
  const wa = (settings.whatsapp_number || settings.support_phone || "").replace(/\D/g, "");

  const cards = [
    { icon: Phone, label: "Destek Hattı", value: settings.support_phone, href: settings.support_phone ? `tel:${settings.support_phone.replace(/\D/g, "")}` : null },
    { icon: Mail, label: "Destek E-posta", value: settings.contact_email, href: settings.contact_email ? `mailto:${settings.contact_email}` : null },
    { icon: MapPin, label: "Adres", value: settings.address, href: null },
  ];

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
      <div className="max-w-2xl mb-12">
        <h1 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter leading-none">Bize ulaş</h1>
        <p className="mt-4 text-muted-foreground text-lg">Aklına takılan her şey için buradayız. Eğitimler, ödeme veya kurumsal talepler — dilediğin kanaldan yaz.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-ink-surface border border-white/5 rounded-2xl p-7">
            <span className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center"><c.icon className="w-6 h-6 text-gold" /></span>
            <p className="mt-5 overline text-muted-foreground">{c.label}</p>
            {c.href ? <a href={c.href} className="mt-2 block font-medium hover:text-gold transition-colors duration-200 break-words">{c.value}</a> : <p className="mt-2 font-medium leading-relaxed">{c.value}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-ink-surface border border-white/5 rounded-2xl p-7">
          <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-gold" /> Çalışma Saatleri</h2>
          <p className="mt-3 text-sm text-muted-foreground">Hafta içi 09:00 – 18:00 arası destek ekibimiz aktiftir. Mesajlarına en kısa sürede dönüş yapıyoruz.</p>
        </div>
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" data-testid="contact-whatsapp"
            className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl p-7 hover:bg-[#25D366]/15 transition-colors duration-200 flex items-center gap-4">
            <span className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0"><MessageCircle className="w-6 h-6 text-white" fill="white" /></span>
            <div><p className="font-heading font-semibold">WhatsApp'tan Yaz</p><p className="text-sm text-muted-foreground">Anında yanıt için en hızlı yol</p></div>
          </a>
        )}
      </div>

      <div className="mt-8 rounded-2xl overflow-hidden border border-white/10 h-72">
        <iframe title="Harita" className="w-full h-full grayscale opacity-90" loading="lazy"
          src={`https://www.google.com/maps?q=${encodeURIComponent(settings.address || "Ataşehir İstanbul")}&output=embed`} />
      </div>
    </div>
  );
}
