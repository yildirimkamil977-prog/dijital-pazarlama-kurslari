import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.44 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"/></svg>
);

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Üye Ol - Akademi";
    if (user) navigate("/panel");
  }, [user, navigate]);

  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/panel";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!accept) { toast.error("Devam etmek için sözleşmeleri onaylamalısın."); return; }
    setLoading(true);
    try {
      await register({ ...form, accept_terms: true });
      toast.success("Hesabın oluşturuldu, hoş geldin!");
      navigate("/panel");
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 py-16 relative">
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <span className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center mx-auto gold-glow"><GraduationCap className="w-6 h-6 text-ink" strokeWidth={2.5} /></span>
          <h1 className="mt-5 font-heading font-black text-3xl tracking-tighter">Aramıza katıl</h1>
          <p className="mt-2 text-sm text-muted-foreground">Dakikalar içinde öğrenmeye başla.</p>
        </div>

        <div className="bg-ink-surface border border-white/10 rounded-2xl p-8">
          <Button onClick={handleGoogle} variant="outline" data-testid="google-register-btn" className="w-full h-11 border-white/15 hover:bg-secondary gap-2">
            <GoogleIcon /> Google ile Devam Et
          </Button>
          <div className="flex items-center gap-4 my-6"><span className="h-px bg-white/10 flex-1" /><span className="text-xs text-muted-foreground">veya</span><span className="h-px bg-white/10 flex-1" /></div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-sm">Ad Soyad</Label>
              <Input data-testid="register-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="Adın Soyadın" />
            </div>
            <div>
              <Label className="text-sm">E-posta</Label>
              <Input data-testid="register-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="ornek@email.com" />
            </div>
            <div>
              <Label className="text-sm">Şifre</Label>
              <Input data-testid="register-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className="mt-1.5 bg-ink border-white/10 h-11" placeholder="En az 6 karakter" />
            </div>
            <label className="flex items-start gap-3 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={accept} onCheckedChange={setAccept} data-testid="register-terms" className="mt-0.5" />
              <span>
                <Link to="/sozlesmeler/uyelik" target="_blank" className="text-gold hover:underline">Üyelik Sözleşmesi</Link>,{" "}
                <Link to="/sozlesmeler/kvkk" target="_blank" className="text-gold hover:underline">KVKK</Link> ve{" "}
                <Link to="/sozlesmeler/gizlilik" target="_blank" className="text-gold hover:underline">Gizlilik Politikası</Link>'nı okudum ve onaylıyorum.
              </span>
            </label>
            <Button type="submit" disabled={loading} data-testid="register-submit" className="w-full h-11 bg-gold hover:bg-gold-hover text-ink font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Üye Ol"}
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">Zaten üye misin? <Link to="/giris" className="text-gold font-medium hover:underline">Giriş Yap</Link></p>
      </div>
    </div>
  );
}
