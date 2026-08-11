import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, GraduationCap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const { googleSession } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);
  const [needsTerms, setNeedsTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/giris"); return; }
    const sid = decodeURIComponent(match[1]);
    setSessionId(sid);
    // Google login always requires terms acceptance -> show a quick confirm screen
    setNeedsTerms(true);
  }, [navigate]);

  const complete = async () => {
    if (!accepted) { toast.error("Devam etmek için sözleşmeleri onaylamalısınız."); return; }
    try {
      const user = await googleSession(sessionId, true);
      window.history.replaceState(null, "", window.location.pathname);
      toast.success("Giriş başarılı!");
      navigate(user.role === "admin" ? "/yonetim" : "/panel");
    } catch (e) {
      toast.error("Google girişi başarısız oldu.");
      navigate("/giris");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-5">
      <div className="w-full max-w-md bg-card border border-white/10 rounded-2xl p-8 text-center">
        <span className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center mx-auto gold-glow">
          <GraduationCap className="w-6 h-6 text-ink" strokeWidth={2.5} />
        </span>
        {needsTerms ? (
          <>
            <h1 className="font-heading text-2xl font-bold mt-6">Son bir adım</h1>
            <p className="text-sm text-muted-foreground mt-2">Google ile giriş yapıyorsun. Devam etmeden önce sözleşmeleri onayla.</p>
            <label className="flex items-start gap-3 text-left mt-6 text-sm text-muted-foreground cursor-pointer">
              <Checkbox checked={accepted} onCheckedChange={setAccepted} data-testid="google-terms-checkbox" className="mt-0.5" />
              <span>
                <a href="/sozlesmeler/uyelik" target="_blank" className="text-gold hover:underline">Üyelik Sözleşmesi</a>,{" "}
                <a href="/sozlesmeler/kvkk" target="_blank" className="text-gold hover:underline">KVKK Aydınlatma Metni</a> ve{" "}
                <a href="/sozlesmeler/gizlilik" target="_blank" className="text-gold hover:underline">Gizlilik Politikası</a>'nı okudum, onaylıyorum.
              </span>
            </label>
            <Button onClick={complete} data-testid="google-complete-btn" className="w-full mt-6 bg-gold hover:bg-gold-hover text-ink font-semibold">
              Girişi Tamamla
            </Button>
          </>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> Giriş yapılıyor...
          </div>
        )}
      </div>
    </div>
  );
}
