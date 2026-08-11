import { useSite } from "@/context/SiteContext";
import { MessageCircle } from "lucide-react";

export function WhatsAppButton() {
  const { settings } = useSite();
  const num = (settings.whatsapp_number || "").replace(/\D/g, "");
  if (!num) return null;
  const msg = encodeURIComponent(settings.whatsapp_message || "Merhaba");
  return (
    <a href={`https://wa.me/${num}?text=${msg}`} target="_blank" rel="noreferrer" data-testid="whatsapp-button"
      className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[#25D366] text-white font-semibold shadow-2xl hover:scale-105 transition-transform duration-200"
      style={{ boxShadow: "0 8px 30px -6px rgba(37,211,102,0.6)" }}>
      <MessageCircle className="w-5 h-5" fill="white" /> <span className="hidden sm:inline">WhatsApp Destek</span>
    </a>
  );
}
