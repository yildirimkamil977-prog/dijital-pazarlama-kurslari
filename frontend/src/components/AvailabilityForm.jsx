import { useState } from "react";
import { CalendarClock, Info, Loader2, Check } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const SLOTS = ["09:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00", "21:00-23:00"];

export function AvailabilitySummary({ av, note, testId }) {
  return (
    <div className="space-y-1" data-testid={testId}>
      {DAYS.filter((d) => av?.[d]?.length).map((d) => (
        <p key={d} className="text-xs"><span className="font-semibold text-foreground inline-block w-24">{d}</span><span className="text-muted-foreground">{av[d].join(", ")}</span></p>
      ))}
      {note && <p className="text-xs text-muted-foreground pt-1">Not: {note}</p>}
    </div>
  );
}

export function AvailabilityForm({ enrollment, onSaved }) {
  const [av, setAv] = useState(enrollment.availability || {});
  const [note, setNote] = useState(enrollment.availability_note || "");
  const [busy, setBusy] = useState(false);
  const toggle = (d, s) => {
    const cur = av[d] || [];
    setAv({ ...av, [d]: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api.put(`/my/private-enrollments/${enrollment.enr_id}/availability`, { availability: av, note });
      toast.success("Müsaitlik bilgin gönderildi");
      onSaved?.();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  return (
    <div className="bg-ink border border-gold/20 rounded-2xl p-5" data-testid={`availability-form-${enrollment.enr_id}`}>
      <p className="font-heading font-bold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-gold" /> Müsait olduğun gün ve saatler</p>
      <p className="text-xs text-muted-foreground mt-1">Haftanın hangi gün ve saat aralıklarında derse katılabileceğini işaretle. Birden fazla seçebilirsin.</p>
      <div className="mt-4 space-y-2">
        {DAYS.map((d, di) => (
          <div key={d} className="sm:flex sm:items-center gap-3 border-b border-white/5 pb-2 last:border-0">
            <p className="text-xs font-semibold w-20 shrink-0 mb-1.5 sm:mb-0">{d}</p>
            <div className="flex flex-wrap gap-1.5">
              {SLOTS.map((s, si) => {
                const on = (av[d] || []).includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggle(d, s)} aria-pressed={on} data-testid={`slot-${di}-${si}`}
                    className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1 transition-colors duration-150 ${on ? "bg-gold text-ink border-gold" : "bg-ink-surface border-white/10 text-muted-foreground hover:border-gold/40"}`}>
                    {on && <Check className="w-3 h-3" />}{s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Eklemek istediğin bir not varsa yaz (isteğe bağlı)" rows={2} className="bg-ink-surface border-white/10 mt-4 text-sm" data-testid={`availability-note-${enrollment.enr_id}`} />
      <p className="flex items-start gap-2 text-xs text-gold/90 bg-gold/5 border border-gold/15 rounded-lg p-3 mt-3" data-testid="availability-info-note">
        <Info className="w-4 h-4 shrink-0 mt-0.5" /> Seçtiğin gün ve saatler eğitmen tarafından incelenecek ve ders programın için sana dönüş yapılacaktır.
      </p>
      <Button onClick={submit} disabled={busy} className="mt-4 bg-gold hover:bg-gold-hover text-ink font-bold rounded-full px-6" data-testid={`availability-submit-${enrollment.enr_id}`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : enrollment.availability_at ? "Güncelle" : "Gönder"}
      </Button>
    </div>
  );
}
