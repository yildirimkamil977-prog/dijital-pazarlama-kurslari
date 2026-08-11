import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useSite } from "@/context/SiteContext";
import { Sparkles } from "lucide-react";

export default function PublicLayout() {
  const { settings } = useSite();
  const promo = settings.promo_enabled && settings.promo_text;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {promo && (
        <div className="relative bg-gradient-to-r from-gold via-amber-400 to-gold text-ink text-center text-xs sm:text-sm font-semibold py-2 px-4 flex items-center justify-center gap-2" data-testid="promo-bar">
          <Sparkles className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{settings.promo_text}</span>
        </div>
      )}
      <Navbar promoOffset={!!promo} />
      <main className={`flex-1 ${promo ? "pt-[112px]" : "pt-[72px]"}`}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
