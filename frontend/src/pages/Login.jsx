import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.44 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"/></svg>
);

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Giriş Yap - Akademi";
    if (user) navigate(user.role === "admin" ? "/yonetim" : "/panel");
  }, [user, navigate]);

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/panel";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success("Giriş başarılı!");
      const dest = location.state?.from || (u.role === "admin" ? "/yonetim" : "/panel");
      navigate(dest);
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 py-16 relative">
      <div className="absolute top-20 right-20 w-72 h-72 bg-gold/10 rounded-full blur-[120px]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <span className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center mx-auto gold-glow"><GraduationCap className="w-6 h-6 text-ink" strokeWidth={2.5} /></span>
          <h1 className="mt-5 font-heading font-black text-3xl tracking-tighter">Tekrar hoş geldin</h1>
          <p className="mt-2 text-sm text-muted-foreground">Öğrenme yolculuğuna kaldığın yerden devam et.</p>
        </div>

        <div className="bg-ink-surface border border-white/10 rounded-2xl p-8">
          <Button onClick={handleGoogle} variant="outline" data-testid="google-login-btn" className="w-full h-11 border-white/15 hover:bg-secondary gap-2">
            <GoogleIcon /> Google ile Giriş Yap
          </Button>
          <div className="flex items-center gap-4 my-6"><span className="h-px bg-white/10 flex-1" /><span className="text-xs text-muted-foreground">veya</span><span className="h-px bg-white/10 flex-1" /></div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-sm">E-posta</Label>
              <Input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="ornek@email.com" />
            </div>
            <div>
              <Label className="text-sm">Şifre</Label>
              <Input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={loading} data-testid="login-submit" className="w-full h-11 bg-gold hover:bg-gold-hover text-ink font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Giriş Yap"}
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">Hesabın yok mu? <Link to="/kayit-ol" className="text-gold font-medium hover:underline">Üye Ol</Link></p>
      </div>
    </div>
  );
}
