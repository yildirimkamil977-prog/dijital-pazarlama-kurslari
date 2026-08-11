import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2, ChevronLeft, ChevronDown, ChevronRight, Save, X, GripVertical, Copy } from "lucide-react";
import api, { apiError, formatDuration } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const uid = () => Math.random().toString(36).slice(2, 10);
const empty = {
  title: "", subtitle: "", description: "", category: "", level: "Tüm Seviyeler",
  price: 0, discount_price: null, thumbnail: "", instructor_name: "Kamil Yıldırım",
  is_published: false, what_you_learn: [], requirements: [], cross_sell_ids: [], modules: [],
};

export default function CourseEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [openModules, setOpenModules] = useState({});
  const [openLessons, setOpenLessons] = useState({});
  const [allCourses, setAllCourses] = useState([]);

  useEffect(() => {
    document.title = isNew ? "Yeni Kurs" : "Kurs Düzenle";
    api.get("/admin/courses").then(({ data }) => setAllCourses(data)).catch(() => {});
    if (!isNew) {
      api.get(`/admin/courses/${id}`).then(({ data }) => setForm({ ...empty, ...data, cross_sell_ids: data.cross_sell_ids || [], discount_price: data.discount_price ?? null }))
        .catch(() => { toast.error("Kurs yüklenemedi"); navigate("/yonetim/kurslar"); }).finally(() => setLoading(false));
    }
  }, [id, isNew, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleModule = (mid) => setOpenModules((s) => ({ ...s, [mid]: !s[mid] }));
  const toggleLesson = (lid) => setOpenLessons((s) => ({ ...s, [lid]: !s[lid] }));

  const addModule = () => { const nm = { id: uid(), title: "Yeni Bölüm", lessons: [] }; set("modules", [...form.modules, nm]); setOpenModules((s) => ({ ...s, [nm.id]: true })); };
  const updModule = (mi, k, v) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, [k]: v } : m));
  const delModule = (mi) => set("modules", form.modules.filter((_, i) => i !== mi));
  const addLesson = (mi) => { const nl = { id: uid(), title: "Yeni Ders", video_url: "", description: "", notes: "", duration_seconds: 0, is_preview: false, resources: [] }; set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: [...m.lessons, nl] } : m)); setOpenLessons((s) => ({ ...s, [nl.id]: true })); };
  const dupLesson = (mi, li) => { const src = form.modules[mi].lessons[li]; const nl = { ...src, id: uid(), title: src.title + " (kopya)", resources: src.resources.map((r) => ({ ...r })) }; set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: [...m.lessons.slice(0, li + 1), nl, ...m.lessons.slice(li + 1)] } : m)); };
  const updLesson = (mi, li, k, v) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, [k]: v } : l) } : m));
  const delLesson = (mi, li) => set("modules", form.modules.map((m, i) => i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m));
  const addResource = (mi, li) => updLesson(mi, li, "resources", [...form.modules[mi].lessons[li].resources, { name: "", url: "" }]);
  const updResource = (mi, li, ri, k, v) => updLesson(mi, li, "resources", form.modules[mi].lessons[li].resources.map((r, x) => x === ri ? { ...r, [k]: v } : r));
  const delResource = (mi, li, ri) => updLesson(mi, li, "resources", form.modules[mi].lessons[li].resources.filter((_, x) => x !== ri));

  const listField = (key, ph) => (
    <div>
      {form[key].map((item, i) => (
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
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;
  const inputCls = "bg-ink border-white/10 mt-1.5";
  const totalLessons = form.modules.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8 sticky top-16 md:top-0 bg-background/90 backdrop-blur z-20 py-3">
        <button onClick={() => navigate("/yonetim/kurslar")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"><ChevronLeft className="w-4 h-4" /> Kurslara Dön</button>
        <Button onClick={save} disabled={saving} data-testid="save-course" className="bg-gold hover:bg-gold-hover text-ink font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button>
      </div>

      <h1 className="font-heading font-black text-2xl tracking-tighter mb-1">{isNew ? "Yeni Kurs" : form.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">{form.modules.length} bölüm · {totalLessons} ders</p>

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
            <div><Label>İndirimli Fiyat (₺)</Label><Input type="number" value={form.discount_price ?? ""} onChange={(e) => set("discount_price", e.target.value === "" ? null : e.target.value)} className={inputCls} /></div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div><Label>Yayında</Label><p className="text-xs text-muted-foreground">Açık olduğunda öğrenciler görebilir</p></div>
            <Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} data-testid="course-published" />
          </div>
        </section>

        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Kazanımlar (Neler öğrenecek?)</h2>{listField("what_you_learn", "Kazanım...")}
        </section>
        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-4">Gereksinimler</h2>{listField("requirements", "Gereksinim...")}
        </section>

        {/* CURRICULUM - collapsible for 100+ lessons */}
        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold">Müfredat <span className="text-sm text-muted-foreground font-normal">({totalLessons} ders)</span></h2>
            <Button type="button" onClick={addModule} data-testid="add-module" variant="outline" size="sm" className="border-white/15"><Plus className="w-4 h-4 mr-1" /> Bölüm Ekle</Button>
          </div>
          <div className="space-y-3">
            {form.modules.map((m, mi) => {
              const isOpen = openModules[m.id] !== false;
              return (
                <div key={m.id} className="border border-white/10 rounded-xl bg-ink/40 overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <button type="button" onClick={() => toggleModule(m.id)} className="text-muted-foreground shrink-0">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                    <span className="w-6 h-6 rounded bg-gold/10 text-gold text-xs flex items-center justify-center font-bold shrink-0">{mi + 1}</span>
                    <Input value={m.title} onChange={(e) => updModule(mi, "title", e.target.value)} className="bg-ink border-white/10 font-medium h-9" placeholder="Bölüm başlığı" />
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{m.lessons.length} ders</span>
                    <Button type="button" variant="outline" size="sm" className="border-white/15 text-destructive shrink-0 h-9" onClick={() => delModule(mi)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      {m.lessons.map((l, li) => {
                        const lOpen = openLessons[l.id];
                        return (
                          <div key={l.id} className="border border-white/5 rounded-lg bg-ink-surface">
                            <div className="flex items-center gap-2 p-2.5">
                              <button type="button" onClick={() => toggleLesson(l.id)} className="text-muted-foreground shrink-0">{lOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                              <Input value={l.title} onChange={(e) => updLesson(mi, li, "title", e.target.value)} className="bg-ink border-white/10 text-sm h-8" placeholder="Ders başlığı" data-testid={`lesson-title-${mi}-${li}`} />
                              {l.is_preview && <span className="text-[10px] text-gold shrink-0">Önizleme</span>}
                              <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">{formatDuration(l.duration_seconds)}</span>
                              <button type="button" onClick={() => dupLesson(mi, li)} className="text-muted-foreground hover:text-foreground shrink-0 p-1" title="Kopyala"><Copy className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => delLesson(mi, li)} className="text-destructive shrink-0 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            {lOpen && (
                              <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3">
                                <Input value={l.video_url} onChange={(e) => updLesson(mi, li, "video_url", e.target.value)} className="bg-ink border-white/10 text-sm" placeholder="Video embed linki (örn: https://www.youtube.com/embed/XXXX)" />
                                <Textarea value={l.description} onChange={(e) => updLesson(mi, li, "description", e.target.value)} className="bg-ink border-white/10 text-sm" rows={2} placeholder="Kısa ders açıklaması" />
                                <div><Label className="text-xs text-muted-foreground">Detaylı Ders Notu</Label>
                                  <Textarea value={l.notes} onChange={(e) => updLesson(mi, li, "notes", e.target.value)} className="bg-ink border-white/10 text-sm mt-1" rows={4} placeholder="Öğrencinin ders altında göreceği detaylı notlar, adımlar, ipuçları..." data-testid={`lesson-notes-${mi}-${li}`} /></div>
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="flex items-center gap-2"><Label className="text-xs">Süre (sn)</Label><Input type="number" value={l.duration_seconds} onChange={(e) => updLesson(mi, li, "duration_seconds", Number(e.target.value))} className="bg-ink border-white/10 h-8 w-24 text-sm" /></div>
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
                            )}
                          </div>
                        );
                      })}
                      <Button type="button" onClick={() => addLesson(mi)} variant="ghost" size="sm" className="text-gold text-sm" data-testid={`add-lesson-${mi}`}><Plus className="w-4 h-4 mr-1" /> Ders Ekle</Button>
                    </div>
                  )}
                </div>
              );
            })}
            {form.modules.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Henüz bölüm yok. "Bölüm Ekle" ile başla.</p>}
          </div>
        </section>

        {/* Cross-sell campaign */}
        <section className="bg-ink-surface border border-white/5 rounded-2xl p-6">
          <h2 className="font-heading font-semibold mb-1">Kampanya — Birlikte Önerilen Eğitimler</h2>
          <p className="text-sm text-muted-foreground mb-4">Bu eğitim sepetteyken önerilecek diğer eğitimleri seç. (İndirim oranı Ayarlar &gt; Kampanya bölümünden belirlenir.)</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {allCourses.filter((c) => c.course_id !== id).map((c) => (
              <label key={c.course_id} className="flex items-center gap-3 bg-ink border border-white/5 rounded-lg p-3 cursor-pointer text-sm">
                <Checkbox checked={form.cross_sell_ids.includes(c.course_id)} onCheckedChange={(v) => set("cross_sell_ids", v ? [...form.cross_sell_ids, c.course_id] : form.cross_sell_ids.filter((x) => x !== c.course_id))} data-testid={`cross-sell-${c.course_id}`} />
                <span className="truncate">{c.title}</span>
              </label>
            ))}
            {allCourses.filter((c) => c.course_id !== id).length === 0 && <p className="text-sm text-muted-foreground">Önerilecek başka eğitim yok.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
