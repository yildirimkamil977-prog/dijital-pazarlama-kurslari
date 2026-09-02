import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { login, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Giriş Yap - Akademi";
    if (user) navigate(user.role === "admin" ? "/yonetim" : "/panel");
  }, [user, navigate]);

  const handleGoogleSuccess = async (resp) => {
    try {
      const u = await googleLogin(resp.credential);
      toast.success("Giriş başarılı!");
      navigate(u.role === "admin" ? "/yonetim" : "/panel");
    } catch (err) {
      toast.error(apiError(err));
    }
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
          <div className="flex justify-center" data-testid="google-login-btn">
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error("Google girişi başarısız")} theme="filled_black" size="large" width="320" text="signin_with" locale="tr" />
          </div>
          <div className="flex items-center gap-4 my-6"><span className="h-px bg-white/10 flex-1" /><span className="text-xs text-muted-foreground">veya</span><span className="h-px bg-white/10 flex-1" /></div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-sm">E-posta</Label>
              <Input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="ornek@email.com" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Şifre</Label>
                <Link to="/sifremi-unuttum" data-testid="forgot-password-link" className="text-xs text-gold hover:underline">Şifremi unuttum?</Link>
              </div>
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
