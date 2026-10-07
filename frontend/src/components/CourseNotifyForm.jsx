import { useState } from "react";
import { BellRing, CheckCircle2, Loader2 } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const CourseNotifyForm = ({ courseId }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post(`/courses/${courseId}/notify`, { email, name: user?.name || "" }); setDone(true); toast.success("Kaydedildi! Satışa açılınca haber vereceğiz."); }
    catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };
  return (
    <div id="course-notify" className="rounded-2xl bg-gradient-to-br from-gold/15 to-blue-500/10 border border-gold/30 p-5" data-testid="course-sale-closed-box">
      <span className="inline-flex items-center gap-2 text-xs font-black text-gold uppercase tracking-wide"><BellRing className="w-4 h-4" /> Yakında Satışta</span>
      <p className="font-heading font-black text-3xl text-gold mt-3" data-testid="course-sale-closed-label">Yakında satışta</p>
      <p className="text-sm text-foreground/85 mt-2 leading-relaxed">Bu eğitim çok yakında satışa açılacak. E-postanı bırak, açıldığı an ilk sen haberdar ol.</p>
      {done ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-green-400 font-medium" data-testid="course-notify-done"><CheckCircle2 className="w-4 h-4" /> Listeye eklendin. Açılınca haber vereceğiz.</p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2.5">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta adresin" className="bg-ink border-white/15 h-11" data-testid="course-notify-email" />
          <Button type="submit" disabled={busy} className="w-full bg-gold hover:bg-gold-hover text-ink font-bold h-12" data-testid="course-notify-submit">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BellRing className="w-4 h-4 mr-2" /> Açılınca Haber Ver</>}
          </Button>
        </form>
      )}
    </div>
  );
};
