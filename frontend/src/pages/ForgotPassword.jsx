import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { document.title = "Şifremi Unuttum - Akademi"; }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) { setError(apiError(err)); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 py-16 relative">
      <div className="absolute top-20 right-20 w-72 h-72 bg-gold/10 rounded-full blur-[120px]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <span className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center mx-auto gold-glow"><GraduationCap className="w-6 h-6 text-ink" strokeWidth={2.5} /></span>
          <h1 className="mt-5 font-heading font-black text-3xl tracking-tighter">Şifreni mi unuttun?</h1>
          <p className="mt-2 text-sm text-muted-foreground">E-posta adresini gir, sıfırlama bağlantısını gönderelim.</p>
        </div>

        <div className="bg-ink-surface border border-white/10 rounded-2xl p-8">
          {sent ? (
            <div className="text-center py-4" data-testid="forgot-sent">
              <span className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto"><MailCheck className="w-7 h-7 text-green-400" /></span>
              <h2 className="mt-5 font-heading font-semibold text-lg">E-postanı kontrol et</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısını içeren bir e-posta gönderdik. Bağlantı 1 saat geçerlidir.</p>
              <Link to="/giris"><Button variant="outline" className="mt-6 border-white/15"><ArrowLeft className="w-4 h-4 mr-2" /> Girişe dön</Button></Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-sm">E-posta</Label>
                <Input data-testid="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="ornek@email.com" />
              </div>
              {error && <p className="text-sm text-red-400" data-testid="forgot-error">{error}</p>}
              <Button type="submit" disabled={loading} data-testid="forgot-submit" className="w-full h-11 bg-gold hover:bg-gold-hover text-ink font-bold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sıfırlama Bağlantısı Gönder"}
              </Button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6"><Link to="/giris" className="text-gold font-medium hover:underline">← Girişe dön</Link></p>
      </div>
    </div>
  );
}
