import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiError } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function GoogleAuthButton({ text = "signin_with", testId = "google-login-btn" }) {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [pendingCred, setPendingCred] = useState(null);
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);

  const complete = (u) => {
    toast.success("Giriş başarılı!");
    navigate(u.role === "admin" ? "/yonetim" : "/panel");
  };

  const onSuccess = async (resp) => {
    try {
      const res = await googleLogin(resp.credential);
      if (res?.terms_required) { setPendingCred(resp.credential); setAccept(false); return; }
      complete(res);
    } catch (e) { toast.error(apiError(e)); }
  };

  const confirm = async () => {
    if (!accept) { toast.error("Devam etmek için sözleşmeleri onaylamalısın."); return; }
    setLoading(true);
    try {
      const res = await googleLogin(pendingCred, true);
      setPendingCred(null);
      complete(res);
    } catch (e) { toast.error(apiError(e)); } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex justify-center" data-testid={testId}>
        <GoogleLogin onSuccess={onSuccess} onError={() => toast.error("Google girişi başarısız")} theme="filled_black" size="large" width="320" text={text} locale="tr" />
      </div>
      <Dialog open={!!pendingCred} onOpenChange={(o) => { if (!o) setPendingCred(null); }}>
        <DialogContent className="max-w-md bg-ink-surface border-white/10">
          <DialogHeader><DialogTitle>Sözleşmeleri Onayla</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Hesabını oluşturmak için aşağıdaki sözleşmeleri onaylaman gerekiyor.</p>
          <label className="flex items-start gap-3 text-xs text-muted-foreground cursor-pointer mt-2">
            <Checkbox checked={accept} onCheckedChange={setAccept} data-testid="google-terms-checkbox" className="mt-0.5" />
            <span>
              <Link to="/sozlesmeler/uyelik" target="_blank" className="text-gold hover:underline">Üyelik Sözleşmesi</Link>,{" "}
              <Link to="/sozlesmeler/kvkk" target="_blank" className="text-gold hover:underline">KVKK</Link> ve{" "}
              <Link to="/sozlesmeler/gizlilik" target="_blank" className="text-gold hover:underline">Gizlilik Politikası</Link>'nı okudum ve onaylıyorum.
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" className="border-white/15" onClick={() => setPendingCred(null)}>Vazgeç</Button>
            <Button onClick={confirm} disabled={loading} data-testid="google-terms-confirm" className="bg-gold hover:bg-gold-hover text-ink font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Onayla ve Devam Et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
