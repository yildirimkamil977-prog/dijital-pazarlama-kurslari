import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Save, User, Lock, ChevronLeft } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function StudentSettings() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingP, setSavingP] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    document.title = "Hesap Ayarları - Akademi";
    if (user) setProfile({ name: user.name || "", email: user.email || "" });
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault(); setSavingP(true);
    try { const { data } = await api.put("/auth/profile", profile); setUser(data); toast.success("Profil güncellendi"); }
    catch (err) { toast.error(apiError(err)); } finally { setSavingP(false); }
  };

  const changePwd = async (e) => {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) { toast.error("Yeni şifreler eşleşmiyor"); return; }
    setSavingPw(true);
    try { await api.post("/auth/change-password", { current_password: pwd.current_password, new_password: pwd.new_password }); toast.success("Şifren değiştirildi"); setPwd({ current_password: "", new_password: "", confirm: "" }); }
    catch (err) { toast.error(apiError(err)); } finally { setSavingPw(false); }
  };

  const isGoogle = user?.auth_provider === "google";
  const inputCls = "bg-ink border-white/10 mt-1.5 h-11";

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12">
      <button onClick={() => navigate("/panel")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 mb-6"><ChevronLeft className="w-4 h-4" /> Panele Dön</button>
      <h1 className="font-heading font-black text-3xl tracking-tighter mb-8">Hesap Ayarları</h1>

      <Tabs defaultValue="profile">
        <TabsList className="bg-ink-surface border border-white/5">
          <TabsTrigger value="profile" data-testid="settings-tab-profile"><User className="w-4 h-4 mr-2" /> Profil</TabsTrigger>
          <TabsTrigger value="password" data-testid="settings-tab-password"><Lock className="w-4 h-4 mr-2" /> Şifre</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <form onSubmit={saveProfile} className="bg-ink-surface border border-white/5 rounded-2xl p-7 space-y-4">
            <div><Label>Ad Soyad</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={inputCls} data-testid="profile-name" required /></div>
            <div><Label>E-posta</Label><Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className={inputCls} data-testid="profile-email" required /></div>
            <Button type="submit" disabled={savingP} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-profile">{savingP ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
          </form>
        </TabsContent>

        <TabsContent value="password" className="mt-6">
          {isGoogle ? (
            <div className="bg-ink-surface border border-white/5 rounded-2xl p-8 text-center text-muted-foreground">Google ile giriş yaptığın için şifre değişikliği bu hesap için geçerli değil.</div>
          ) : (
            <form onSubmit={changePwd} className="bg-ink-surface border border-white/5 rounded-2xl p-7 space-y-4">
              <div><Label>Mevcut Şifre</Label><Input type="password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} className={inputCls} data-testid="current-password" required /></div>
              <div><Label>Yeni Şifre</Label><Input type="password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} className={inputCls} data-testid="new-password" minLength={6} required /></div>
              <div><Label>Yeni Şifre (Tekrar)</Label><Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className={inputCls} data-testid="confirm-password" required /></div>
              <Button type="submit" disabled={savingPw} className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="save-password">{savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : "Şifreyi Değiştir"}</Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
