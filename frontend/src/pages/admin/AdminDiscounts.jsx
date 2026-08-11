import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Tag } from "lucide-react";
import api, { apiError, formatPrice } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const empty = { code: "", type: "percent", value: 10, active: true, usage_limit: "", min_amount: "" };

export default function AdminDiscounts() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () => api.get("/admin/discounts").then(({ data }) => setCodes(data)).finally(() => setLoading(false));
  useEffect(() => { document.title = "Yönetim - İndirim Kodları"; load(); }, []);

  const create = async () => {
    if (!form.code.trim()) { toast.error("Kod zorunlu"); return; }
    try {
      await api.post("/admin/discounts", {
        code: form.code, type: form.type, value: Number(form.value), active: form.active,
        usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
        min_amount: form.min_amount === "" ? null : Number(form.min_amount),
      });
      toast.success("İndirim kodu oluşturuldu"); setOpen(false); setForm(empty); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const toggle = async (c) => { await api.put(`/admin/discounts/${c.code}`, { ...c, active: !c.active }); load(); };
  const del = async (code) => { await api.delete(`/admin/discounts/${code}`); toast.success("Silindi"); load(); };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">İndirim Kodları</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gold hover:bg-gold-hover text-ink font-semibold" data-testid="new-discount-btn"><Plus className="w-4 h-4 mr-2" /> Yeni Kod</Button></DialogTrigger>
          <DialogContent className="bg-ink-surface border-white/10">
            <DialogHeader><DialogTitle>Yeni İndirim Kodu</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Kod</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="bg-ink border-white/10 mt-1.5" placeholder="INDIRIM20" data-testid="discount-code-input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tür</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="bg-ink border-white/10 mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percent">Yüzde (%)</SelectItem><SelectItem value="fixed">Tutar (₺)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Değer</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="bg-ink border-white/10 mt-1.5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Kullanım Limiti</Label><Input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="bg-ink border-white/10 mt-1.5" placeholder="Sınırsız" /></div>
                <div><Label>Min. Tutar (₺)</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} className="bg-ink border-white/10 mt-1.5" placeholder="Yok" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Aktif</label>
            </div>
            <DialogFooter><Button onClick={create} className="bg-gold text-ink font-semibold" data-testid="save-discount">Oluştur</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {codes.map((c) => (
          <div key={c.code} data-testid={`discount-${c.code}`} className="bg-ink-surface border border-white/5 rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center"><Tag className="w-5 h-5 text-gold" /></span>
                <div>
                  <p className="font-heading font-bold text-lg font-mono">{c.code}</p>
                  <p className="text-sm text-gold">{c.type === "percent" ? `%${c.value} indirim` : `${formatPrice(c.value)} ₺ indirim`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.active} onCheckedChange={() => toggle(c)} />
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(c.code)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex gap-3 mt-4 text-xs text-muted-foreground">
              <Badge className="bg-secondary">{c.used_count || 0}{c.usage_limit ? `/${c.usage_limit}` : ""} kullanım</Badge>
              {c.min_amount ? <Badge className="bg-secondary">Min {formatPrice(c.min_amount)} ₺</Badge> : null}
              {!c.active && <Badge className="bg-destructive/15 text-red-400 border-destructive/20">Pasif</Badge>}
            </div>
          </div>
        ))}
        {codes.length === 0 && <p className="text-muted-foreground col-span-2 text-center py-16">Henüz indirim kodu yok.</p>}
      </div>
    </div>
  );
}
