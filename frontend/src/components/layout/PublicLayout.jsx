import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useSite } from "@/context/SiteContext";
import { Sparkles } from "lucide-react";

export default function PublicLayout() {
  const { settings } = useSite();
  const promos = (settings.promo_text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const promo = settings.promo_enabled && promos.length > 0;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="fixed top-0 inset-x-0 z-50">
        {promo && (
          <div className="relative bg-gradient-to-r from-gold via-amber-400 to-gold text-ink text-xs sm:text-sm font-semibold py-2 overflow-hidden" data-testid="promo-bar">
            <div className="flex w-max animate-marquee-slow">
              {[0, 1].map((group) => (
                <div key={group} className="flex shrink-0" aria-hidden={group === 1}>
                  {promos.map((p, k) => (
                    <span key={k} className="flex items-center gap-2 whitespace-nowrap px-8"><Sparkles className="w-3.5 h-3.5 shrink-0" /> {p}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <Navbar />
      </div>
      <main className={`flex-1 ${promo ? "pt-[104px]" : "pt-[72px]"}`}>
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
