import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2, ChevronLeft, GripVertical, Save, X } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const uid = () => Math.random().toString(36).slice(2, 10);
const empty = {
  title: "", subtitle: "", description: "", category: "", level: "Tüm Seviyeler",
  price: 0, discount_price: null, thumbnail: "", instructor_name: "Kamil Yıldırım",
  is_published: false, what_you_learn: [], requirements: [], modules: [],
};

export default function CourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = isNew ? "Yeni Kurs" : "Kurs Düzenle";
    if (!isNew) {
      api.get(`/admin/courses/${id}`).then(({ data }) => setForm({ ...empty, ...data, discount_price: data.discount_price ?? null }))
        .catch(() => { toast.error("Kurs yüklenemedi"); navigate("/yonetim/kurslar"); }).finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Modules & lessons
  const addModule = () => set("modules", [...form.modules, { id: uid(), title: "Yeni Bölüm", lessons: [] }]);
  const updModule = (mi, k, v) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, [k]: v } : m));
  const delModule = (mi) => set("modules", form.modules.filter((_, i) => i !== mi));
  const addLesson = (mi) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: [...m.lessons, { id: uid(), title: "Yeni Ders", video_url: "", description: "", duration_seconds: 0, is_preview: false, resources: [] }] } : m));
  const updLesson = (mi, li, k, v) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, [k]: v } : l) } : m));
  const delLesson = (mi, li) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m));
  const addResource = (mi, li) => updLesson(mi, li, "resources", [...form.modules[mi].lessons[li].resources, { name: "", url: "" }]);
  const updResource = (mi, li, ri, k, v) => updLesson(mi, li, "resources", form.modules[mi].lessons[li].resources.map((r, x) => x === ri ? { ...r, [k]: v } : r));
  const delResource = (mi, li, ri) => updLesson(mi, li, "resources", form.modules[mi].lessons[li].resources.filter((_, x) => x !== ri));

  const listField = (key, value, ph) => (
    <div>
      {value.map((item, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <Input value={item} onChange={(e) => set(key, form[key].map((x, j) => j === i ? e.target.value : x))} className="bg-ink border-white/10" placeholder={ph} />
          <Button type="button" variant="outline" size="sm" className="border-white/15 shrink-0" onClick={() => set(key, form[key].filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="border-white/15" onClick={() => set(key, [...form[key], ""])}><Plus className="w-4 h-4 mr-1" /> Ekle</Button>
    </div>
  );

  const save = async () => {
    if (!form.title.trim()) { toast.error("Kurs başlığı zorunlu"); return; }
    setSaving(true);
    const payload = { ...form, price: Number(form.price) || 0, discount_price: form.discount_price === null || form.discount_price === "" ? null : Number(form.discount_price) };
    try {
      if (isNew) { await api.post("/admin/courses", payload); toast.success("Kurs oluşturuldu"); }
      else { await api.put(`/admin/courses/${id}`, payload); toast.success("Kurs güncellendi"); }
      navigate("/yonetim/kurslar");
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  const inputCls = "bg-ink border-white/10 mt-1.5";

  return (
    <div>
      <div className="flex items-center justify-between mb-8 sticky top-16 md:top-0 bg-background/80 backdrop-blur z-20 py-2">
        <button onClick={() => navigate("/yonetim/kurslar")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"><ChevronLeft className="w-4 h-4" /> Kurslara Dön</button>
        <Button onClick={save} disabled={saving} data-testid="save-course" className="bg-gold hover:bg-gold-hover text-ink font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
      </div>

      <h1 className="font-heading font-black text-2xl tracking-tighter mb-6">{isNew ? "Yeni Kurs" : form.title}</h1>

      <div className="space-y-6">
        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 space-y-4">
          <h2 className="font-heading font-semibold">Temel Bilgiler</h2>
          <div><Label>Başlık *</Label><Input data-testid="course-title" value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></div>
          <div><Label>Kısa Açıklama</Label><Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} /></div>
          <div><Label>Detaylı Açıklama</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} rows={4} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Kategori</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} placeholder="Reklam, SEO..." /></div>
            <div><Label>Seviye</Label><Input value={form.level} onChange={(e) => set("level", e.target.value)} className={inputCls} /></div>
          </div>
          <div><Label>Kapak Görseli (URL)</Label><Input value={form.thumbnail} onChange={(e) => set("thumbnail", e.target.value)} className={inputCls} placeholder="https://..." />
            {form.thumbnail && <img src={form.thumbnail} alt="" className="mt-3 w-48 h-28 object-cover rounded-lg border border-white/10" />}</div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Fiyat (₺)</Label><Input type="number" data-testid="course-price" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} /></div>
            <div><Label>İndirimli Fiyat (₺, opsiyonel)</Label><Input type="number" value={form.discount_price ?? ""} onChange={(e) => set("discount_price", e.target.value === "" ? null : e.target.value)} className={inputCls} /></div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div><Label>Yayında</Label><p className="text-xs text-muted-foreground">Açık olduğunda öğrenciler görebilir</p></div>
            <Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} data-testid="course-published" />
          </div>
        </section>

        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Kazanımlar (Neler öğrenecek?)</h2>
          {listField("what_you_learn", form.what_you_learn, "Kazanım...")}
        </section>

        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Gereksinimler</h2>
          {listField("requirements", form.requirements, "Gereksinim...")}
        </section>

        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold">Müfredat</h2>
            <Button type="button" onClick={addModule} data-testid="add-module" variant="outline" size="sm" className="border-white/15"><Plus className="w-4 h-4 mr-1" /> Bölüm Ekle</Button>
          </div>
          <div className="space-y-4">
            {form.modules.map((m, mi) => (
              <div key={m.id} className="border border-white/10 rounded-xl p-4 bg-ink/40">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <Input value={m.title} onChange={(e) => updModule(mi, "title", e.target.value)} className="bg-ink border-white/10 font-medium" placeholder="Bölüm başlığı" />
                  <Button type="button" variant="outline" size="sm" className="border-white/15 text-destructive shrink-0" onClick={() => delModule(mi)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <div className="space-y-3 pl-6">
                  {m.lessons.map((l, li) => (
                    <div key={l.id} className="border border-white/5 rounded-lg p-3 bg-ink-surface space-y-2">
                      <div className="flex gap-2">
                        <Input value={l.title} onChange={(e) => updLesson(mi, li, "title", e.target.value)} className="bg-ink border-white/10 text-sm" placeholder="Ders başlığı" />
                        <Button type="button" variant="outline" size="sm" className="border-white/15 text-destructive shrink-0" onClick={() => delLesson(mi, li)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                      <Input value={l.video_url} onChange={(e) => updLesson(mi, li, "video_url", e.target.value)} className="bg-ink border-white/10 text-sm" placeholder="Video embed linki (YouTube/Vimeo) — örn: https://www.youtube.com/embed/XXXX" />
                      <Textarea value={l.description} onChange={(e) => updLesson(mi, li, "description", e.target.value)} className="bg-ink border-white/10 text-sm" rows={2} placeholder="Ders açıklaması" />
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs"><Label className="text-xs">Süre (sn)</Label><Input type="number" value={l.duration_seconds} onChange={(e) => updLesson(mi, li, "duration_seconds", Number(e.target.value))} className="bg-ink border-white/10 h-8 w-24 text-sm" /></div>
                        <label className="flex items-center gap-2 text-xs cursor-pointer"><Switch checked={l.is_preview} onCheckedChange={(v) => updLesson(mi, li, "is_preview", v)} /> Ücretsiz önizleme</label>
                      </div>
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-1">Kaynaklar (PDF vb.)</p>
                        {l.resources.map((r, ri) => (
                          <div key={ri} className="flex gap-2 mb-2">
                            <Input value={r.name} onChange={(e) => updResource(mi, li, ri, "name", e.target.value)} className="bg-ink border-white/10 h-8 text-sm" placeholder="Dosya adı" />
                            <Input value={r.url} onChange={(e) => updResource(mi, li, ri, "url", e.target.value)} className="bg-ink border-white/10 h-8 text-sm" placeholder="Dosya URL" />
                            <Button type="button" variant="outline" size="sm" className="border-white/15 shrink-0 h-8" onClick={() => delResource(mi, li, ri)}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        ))}
                        <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => addResource(mi, li)}><Plus className="w-3 h-3 mr-1" /> Kaynak Ekle</Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" onClick={() => addLesson(mi)} variant="ghost" size="sm" className="text-gold text-sm"><Plus className="w-4 h-4 mr-1" /> Ders Ekle</Button>
                </div>
              </div>
            ))}
            {form.modules.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Henüz bölüm yok. "Bölüm Ekle" ile başla.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
