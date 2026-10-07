import { Plus, Trash2, ListTree } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const GroupCurriculumEditor = ({ value = [], onChange }) => {
  const upd = (i, k, v) => onChange(value.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));
  return (
    <div className="pt-2 border-t border-white/10" data-testid="group-curriculum-editor">
      <div className="flex items-center justify-between mb-3">
        <Label className="flex items-center gap-2"><ListTree className="w-4 h-4 text-gold" /> Müfredat <span className="text-xs text-muted-foreground font-normal">(tarih/saat içermez)</span></Label>
        <Button size="sm" variant="ghost" className="text-gold" onClick={() => onChange([...value, { id: "", title: "", topics: [] }])} data-testid="add-curriculum-module"><Plus className="w-4 h-4 mr-1" /> Modül</Button>
      </div>
      <div className="space-y-2">
        {value.length === 0 && <p className="text-xs text-muted-foreground">Henüz modül yok. "Modül" ile ekleyin.</p>}
        {value.map((m, i) => (
          <div key={m.id || i} className="bg-ink border border-white/8 rounded-xl p-3 space-y-2" data-testid={`curriculum-module-${i}`}>
            <div className="flex gap-2">
              <Input value={m.title} onChange={(e) => upd(i, "title", e.target.value)} placeholder={`${i + 1}. Modül: Hesap Kurulumu`} className="bg-ink-surface border-white/10 h-9 text-sm" data-testid={`curriculum-title-${i}`} />
              <Button size="sm" variant="ghost" className="text-destructive h-9 px-2" onClick={() => onChange(value.filter((_, idx) => idx !== i))} data-testid={`curriculum-delete-${i}`}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <Textarea value={(m.topics || []).join("\n")} onChange={(e) => upd(i, "topics", e.target.value.split("\n"))} rows={3} placeholder={"Konu 1\nKonu 2 (her satıra bir konu)"} className="bg-ink-surface border-white/10 text-sm" data-testid={`curriculum-topics-${i}`} />
          </div>
        ))}
      </div>
    </div>
  );
};
