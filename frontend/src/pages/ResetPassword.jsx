import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { document.title = "Şifre Belirle - Akademi"; }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (pw.length < 6) { setError("Şifre en az 6 karakter olmalı."); return; }
    if (pw !== pw2) { setError("Şifreler eşleşmiyor."); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      toast.success("Şifren güncellendi! Yeni şifrenle giriş yapabilirsin.");
      navigate("/giris");
    } catch (err) { setError(apiError(err)); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-5 py-16 relative">
      <div className="absolute top-20 right-20 w-72 h-72 bg-gold/10 rounded-full blur-[120px]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <span className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center mx-auto gold-glow"><GraduationCap className="w-6 h-6 text-ink" strokeWidth={2.5} /></span>
          <h1 className="mt-5 font-heading font-black text-3xl tracking-tighter">Yeni şifre belirle</h1>
          <p className="mt-2 text-sm text-muted-foreground">Hesabın için yeni bir şifre oluştur.</p>
        </div>

        <div className="bg-ink-surface border border-white/10 rounded-2xl p-8">
          {!token ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Geçersiz bağlantı. Lütfen yeni bir sıfırlama talebi oluştur.</p>
              <Link to="/sifremi-unuttum"><Button className="mt-6 bg-gold hover:bg-gold-hover text-ink font-semibold">Şifre Sıfırla</Button></Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="text-sm">Yeni Şifre</Label>
                <Input data-testid="reset-password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="••••••••" />
              </div>
              <div>
                <Label className="text-sm">Yeni Şifre (Tekrar)</Label>
                <Input data-testid="reset-password-confirm" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required className="mt-1.5 bg-ink border-white/10 h-11" placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-red-400" data-testid="reset-error">{error}</p>}
              <Button type="submit" disabled={loading} data-testid="reset-submit" className="w-full h-11 bg-gold hover:bg-gold-hover text-ink font-bold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-2" /> Şifreyi Güncelle</>}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
