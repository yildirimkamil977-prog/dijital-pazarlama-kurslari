import { MessageCircle } from "lucide-react";
import { useSite } from "@/context/SiteContext";

export function WhatsAppCTA({ text = "Sorularınız için WhatsApp'tan yazın, hemen yanıtlayalım.", prefill = "Merhaba, bilgi almak istiyorum.", testId = "whatsapp-cta" }) {
  const { settings } = useSite();
  const wa = (settings.whatsapp_number || settings.support_phone || "").replace(/\D/g, "");
  if (!wa) return null;
  return (
    <a
      href={`https://wa.me/${wa}?text=${encodeURIComponent(prefill)}`}
      target="_blank"
      rel="noreferrer"
      data-testid={testId}
      className="group flex items-center gap-3.5 bg-[#0b141a] border border-[#25D366]/25 rounded-2xl p-4 hover:border-[#25D366]/60 hover:bg-[#0d1a14] transition-colors duration-200"
    >
      <div className="relative shrink-0">
        <span className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/20 group-hover:scale-105 transition-transform duration-200">
          <MessageCircle className="w-6 h-6 text-white" fill="white" />
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#4ade80] border-2 border-[#0b141a]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          {settings.site_name ? "Destek Ekibi" : "Destek"}
          <span className="inline-flex items-center gap-1 text-[11px] text-[#4ade80] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" /> Çevrimiçi</span>
        </p>
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{text}</p>
      </div>
    </a>
  );
}
