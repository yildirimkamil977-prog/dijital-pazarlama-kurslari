import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { trackRegister } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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
          <GoogleAuthButton testId="google-register-btn" text="signup_with" />
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
                <Link to="/sozlesmeler/kvkk" target="_blank" className="text-gold hover:underline">KVKK Aydınlatma Metni</Link> ve{" "}
                <Link to="/sozlesmeler/gizlilik" target="_blank" className="text-gold hover:underline">Gizlilik ve Çerez Politikası</Link>'nı okudum ve onaylıyorum.
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
