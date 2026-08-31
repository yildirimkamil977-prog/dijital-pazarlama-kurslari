import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Users, Video, X, Link2, PlayCircle } from "lucide-react";
import api, { formatPrice, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";

const empty = { title: "", description: "", image: "", promo_video: "", what_you_learn: [], requirements: [], price: 0, capacity: 20, instructor_id: "", lessons: [], is_published: false };

export default function AdminGroupTrainings() {
  const [items, setItems] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // group_id or "new"
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); Promise.all([
    api.get("/admin/group-trainings").then(({ data }) => setItems(data)),
    api.get("/admin/instructors").then(({ data }) => setInstructors(data)).catch(() => {}),
  ]).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false)); };
  useEffect(() => { document.title = "Yönetim - Grup Eğitimleri"; load(); }, []);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = async (id) => { const { data } = await api.get(`/admin/group-trainings/${id}`); setForm({ ...empty, ...data, lessons: data.lessons || [] }); setEditing(id); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addLesson = () => set("lessons", [...form.lessons, { id: "", title: "", date: "", time: "20:00", meet_link: "", recording_url: "" }]);
  const updLesson = (i, k, v) => set("lessons", form.lessons.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const delLesson = (i) => set("lessons", form.lessons.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.title.trim()) { toast.error("Başlık zorunlu"); return; }
    setSaving(true);
    const body = { ...form, price: Number(form.price) || 0, capacity: Number(form.capacity) || 0 };
    try {
      if (editing === "new") await api.post("/admin/group-trainings", body);
      else await api.put(`/admin/group-trainings/${editing}`, body);
      toast.success("Kaydedildi"); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const remove = async (id) => { if (!window.confirm("Silinsin mi?")) return; await api.delete(`/admin/group-trainings/${id}`); toast.success("Silindi"); load(); };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  if (editing) return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading font-black text-2xl tracking-tighter">{editing === "new" ? "Yeni Grup Eğitimi" : "Düzenle"}</h1>
        <div className="flex gap-2"><Button variant="outline" className="border-white/15" onClick={() => setEditing(null)}>Vazgeç</Button>
          <Button onClick={save} disabled={saving} data-testid="save-group" className="bg-gold hover:bg-gold-hover text-ink font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button></div>
      </div>
      <div className="space-y-4 bg-ink-surface border border-white/5 rounded-2xl p-6">
        <div><Label>Başlık</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} className="bg-ink border-white/10 mt-1.5" data-testid="group-title" /></div>
        <div><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} className="bg-ink border-white/10 mt-1.5" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Kazanımlar (her satıra bir madde)</Label><Textarea value={(form.what_you_learn || []).join("\n")} onChange={(e) => set("what_you_learn", e.target.value.split("\n").filter(Boolean))} rows={4} className="bg-ink border-white/10 mt-1.5" placeholder="Google Ads hesabı kurmayı öğreneceksin&#10;Dönüşüm takibi..." /></div>
          <div><Label>Gereksinimler (her satıra bir madde)</Label><Textarea value={(form.requirements || []).join("\n")} onChange={(e) => set("requirements", e.target.value.split("\n").filter(Boolean))} rows={4} className="bg-ink border-white/10 mt-1.5" placeholder="Bilgisayar ve internet&#10;Temel bilgisayar kullanımı" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Fiyat (₺)</Label><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} className="bg-ink border-white/10 mt-1.5" data-testid="group-price" /></div>
          <div><Label>Kontenjan</Label><Input type="number" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} className="bg-ink border-white/10 mt-1.5" data-testid="group-capacity" /></div>
        </div>
        <div><Label>Tanıtım Videosu (Vimeo/YouTube linki)</Label><Input value={form.promo_video} onChange={(e) => set("promo_video", e.target.value)} className="bg-ink border-white/10 mt-1.5" placeholder="https://vimeo.com/..." /></div>
        <div><Label>Eğitmen</Label>
          <select value={form.instructor_id || ""} onChange={(e) => set("instructor_id", e.target.value)} className="w-full bg-ink border border-white/10 rounded-md h-10 px-3 mt-1.5 text-sm">
            <option value="">Seçilmedi</option>{instructors.map((i) => <option key={i.instructor_id} value={i.instructor_id}>{i.name}</option>)}
          </select></div>
        <div><Label>Kapak Görseli</Label><div className="mt-1.5"><ImageUpload value={form.image} onChange={(v) => set("image", v)} testId="group-image" /></div></div>
        <div className="flex items-center gap-3"><Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} data-testid="group-published" /><Label>Yayında</Label></div>

        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between mb-3"><Label className="flex items-center gap-2"><Video className="w-4 h-4 text-gold" /> Ders Takvimi · Meet & Kayıt Linkleri</Label>
            <Button size="sm" variant="ghost" className="text-gold" onClick={addLesson} data-testid="add-lesson"><Plus className="w-4 h-4 mr-1" /> Ders</Button></div>
          <div className="space-y-2">
            {form.lessons.map((l, i) => (
              <div key={i} className="bg-ink border border-white/8 rounded-xl p-3 space-y-2" data-testid={`lesson-row-${i}`}>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Input value={l.title} onChange={(e) => updLesson(i, "title", e.target.value)} placeholder="Ders adı" className="col-span-5 bg-ink-surface border-white/10 h-9 text-sm" />
                  <Input type="date" value={l.date} onChange={(e) => updLesson(i, "date", e.target.value)} className="col-span-4 bg-ink-surface border-white/10 h-9 text-sm" />
                  <Input type="time" value={l.time} onChange={(e) => updLesson(i, "time", e.target.value)} className="col-span-2 bg-ink-surface border-white/10 h-9 text-sm" />
                  <Button size="sm" variant="ghost" className="col-span-1 text-destructive h-9 px-0" onClick={() => delLesson(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative"><Video className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={l.meet_link} onChange={(e) => updLesson(i, "meet_link", e.target.value)} placeholder="Google Meet linki" className="bg-ink-surface border-white/10 h-9 text-sm pl-7" data-testid={`lesson-meet-${i}`} /></div>
                  <div className="relative"><PlayCircle className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={l.recording_url || ""} onChange={(e) => updLesson(i, "recording_url", e.target.value)} placeholder="Ders kaydı linki (Vimeo/YouTube)" className="bg-ink-surface border-white/10 h-9 text-sm pl-7" data-testid={`lesson-recording-${i}`} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Canlı Grup Eğitimleri</h1><p className="text-sm text-muted-foreground mt-1">Kontenjan, fiyat ve ders takvimini yönet.</p></div>
        <Button onClick={openNew} data-testid="add-group" className="bg-gold hover:bg-gold-hover text-ink font-semibold"><Plus className="w-4 h-4 mr-2" /> Yeni Eğitim</Button>
      </div>
      {items.length === 0 ? <p className="text-muted-foreground text-center py-16">Henüz grup eğitimi yok.</p> : (
        <div className="space-y-3">
          {items.map((g) => (
            <div key={g.group_id} data-testid={`admin-group-${g.group_id}`} className="bg-ink-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
              <div><p className="font-medium">{g.title} {!g.is_published && <span className="text-xs text-muted-foreground">(Taslak)</span>}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3"><span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {g.enrolled}/{g.capacity} kayıt</span><span>{formatPrice(g.price)} ₺</span><span>{g.lessons.length} ders</span></p></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" className="border-white/15" onClick={() => openEdit(g.group_id)} data-testid={`edit-group-${g.group_id}`}>Düzenle</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(g.group_id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
