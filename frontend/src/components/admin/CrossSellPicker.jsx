import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";

// Pick courses and group trainings to recommend in the cart (cross-sell).
export function CrossSellPicker({ value = [], onChange, excludeId }) {
  const [opts, setOpts] = useState({ courses: [], groups: [] });
  useEffect(() => {
    Promise.all([api.get("/admin/courses"), api.get("/admin/group-trainings")])
      .then(([c, g]) => setOpts({ courses: c.data, groups: g.data })).catch(() => {});
  }, []);
  const toggle = (id, on) => onChange(on ? [...value, id] : value.filter((x) => x !== id));
  const list = [
    ...opts.courses.map((c) => ({ id: c.course_id, title: c.title, kind: "Video Kurs", note: c.sale_closed ? "Satışa kapalı" : !c.is_published ? "Taslak" : "" })),
    ...opts.groups.map((g) => ({ id: g.group_id, title: g.title, kind: "Canlı Grup", note: !g.is_published ? "Taslak" : "" })),
  ].filter((o) => o.id !== excludeId);

  return (
    <section className="bg-ink-surface border border-white/5 rounded-2xl p-6" data-testid="cross-sell-picker">
      <h2 className="font-heading font-semibold mb-1">Kampanya — Birlikte Önerilen Eğitimler</h2>
      <p className="text-sm text-muted-foreground mb-4">Bu eğitim sepetteyken önerilecek eğitimleri seç. Hiçbiri seçilmezse sepette öneri alanı görünmez. Satışa kapalı, taslak ve ücretsiz eğitimler seçili olsa da önerilmez. (İndirim oranı Ayarlar &gt; Kampanya bölümünden belirlenir.)</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map((o) => (
          <label key={o.id} className="flex items-center gap-3 bg-ink border border-white/5 rounded-lg p-3 cursor-pointer text-sm">
            <Checkbox checked={value.includes(o.id)} onCheckedChange={(v) => toggle(o.id, v)} data-testid={`cross-sell-${o.id}`} />
            <span className="truncate flex-1">{o.title}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{o.note || o.kind}</span>
          </label>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Önerilecek başka eğitim yok.</p>}
      </div>
    </section>
  );
}
