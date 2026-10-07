import { Mail, Loader2, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const LaunchNotifyDialog = ({ open, pending, code, busy, onSend, onSkip, onCancel }) => (
  <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
    <DialogContent className="bg-ink-surface border-white/10 max-w-md" data-testid="launch-notify-dialog">
      <DialogHeader>
        <DialogTitle className="font-heading flex items-center gap-2"><Mail className="w-5 h-5 text-gold" /> Kurs satışa açılıyor</DialogTitle>
        <DialogDescription className="text-muted-foreground leading-relaxed pt-1">
          "Açılınca haber ver" listesinde bekleyen <strong className="text-foreground" data-testid="launch-pending-count">{pending} kişiye</strong> "Kurs satışa açıldı" e-postası gönderilecek.
        </DialogDescription>
      </DialogHeader>
      <div className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${code ? "border-gold/30 bg-gold/10" : "border-white/10 bg-ink"}`} data-testid="launch-code-info">
        <Tag className="w-4 h-4 text-gold mt-0.5 shrink-0" />
        {code ? <span>E-postada açılış indirim kodu <strong className="text-gold">{code}</strong> yer alacak; butona tıklayan kişide kod ödeme sayfasında otomatik uygulanır.</span>
          : <span className="text-muted-foreground">Açılış indirim kodu seçilmedi; e-posta sadece duyuru ve kurs linki içerecek.</span>}
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={onSend} disabled={busy} className="bg-gold hover:bg-gold-hover text-ink font-bold" data-testid="launch-send-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet ve E-postaları Gönder"}</Button>
        <Button onClick={onSkip} disabled={busy} variant="outline" className="border-white/15" data-testid="launch-skip-btn">Göndermeden Kaydet</Button>
        <Button onClick={onCancel} disabled={busy} variant="ghost" className="text-muted-foreground" data-testid="launch-cancel-btn">Vazgeç</Button>
      </div>
    </DialogContent>
  </Dialog>
);
