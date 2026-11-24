import { useEffect, useState, lazy, Suspense } from "react";
import { Loader2, Plus, Save, Trash2, ArrowLeft, Users, BellRing, Edit, X } from "lucide-react";
import api, { apiError, formatPrice, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { GroupCurriculumEditor } from "@/components/admin/GroupCurriculumEditor";
import { CrossSellPicker } from "@/components/admin/CrossSellPicker";
import { toast } from "sonner";

const RichTextEditor = lazy(() => import("@/components/admin/RichTextEditor"));
const empty = { title: "", slug: "", description: "", long_description: "", image: "", promo_video: "", price: 0, discount_price: "", lesson_count: 8, lesson_duration: "60-90 dakika", curriculum: [], what_you_learn: [], requirements: [], instructor_id: "", cross_sell_ids: [], sale_stopped: false, is_published: false };
const inputCls = "bg-ink border-white/10 mt-1.5";

function EnrollmentRow({ e, onSaved }) {
  const [f, setF] = useState({ recordings: e.recordings || [], last_lesson_date: e.last_lesson_date || "", note: e.note || "" });
  const setRec = (i, k, v) => setF({ ...f, recordings: f.recordings.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const save = async () => { try { await api.put(`/admin/private-enrollments/${e.enr_id}`, f); toast.success("Kaydedildi"); onSaved(); } catch (err) { toast.error(apiError(err)); } };
  return (
    <div className="bg-ink rounded-xl p-4" data-testid={`private-enr-${e.enr_id}`}>
      <p className="font-semibold text-sm">{e.user_name} <span className="text-muted-foreground font-normal">· {e.user_email}{e.user_phone ? ` · ${e.user_phone}` : ""}</span></p>
      <p className="text-[11px] text-muted-foreground">Kayıt: {formatDate(e.enrolled_at)} · #{e.order_id}</p>
      <div className="space-y-2 mt-3">
        {f.recordings.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input value={r.title} onChange={(ev) => setRec(i, "title", ev.target.value)} placeholder={`${i + 1}. Ders`} className="col-span-4 bg-ink-surface border-white/10 h-9 text-sm" />
            <Input value={r.url} onChange={(ev) => setRec(i, "url", ev.target.value)} placeholder="Google Drive linki" className="col-span-5 bg-ink-surface border-white/10 h-9 text-sm" data-testid={`rec-url-${e.enr_id}-${i}`} />
            <Input type="date" value={r.date || ""} onChange={(ev) => setRec(i, "date", ev.target.value)} className="col-span-2 bg-ink-surface border-white/10 h-9 text-sm" />
            <Button variant="ghost" size="sm" className="col-span-1 text-destructive h-9" onClick={() => setF({ ...f, recordings: f.recordings.filter((_, j) => j !== i) })}><X className="w-4 h-4" /></Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="text-gold" onClick={() => setF({ ...f, recordings: [...f.recordings, { title: "", url: "", date: "" }] })} data-testid={`add-rec-${e.enr_id}`}><Plus className="w-4 h-4 mr-1" /> Ders kaydı ekle</Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <div><Label className="text-xs">Son ders tarihi (soru hakkı +1 ay)</Label><Input type="date" value={f.last_lesson_date} onChange={(ev) => setF({ ...f, last_lesson_date: ev.target.value })} className="bg-ink-surface border-white/10 h-9 mt-1" data-testid={`last-lesson-${e.enr_id}`} /></div>
        <div><Label className="text-xs">Not (sadece siz görürsünüz)</Label><Input value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} className="bg-ink-surface border-white/10 h-9 mt-1" /></div>
      </div>
      <Button size="sm" className="mt-3 bg-gold text-ink font-semibold" onClick={save} data-testid={`save-enr-${e.enr_id}`}><Save className="w-4 h-4 mr-1.5" /> Kaydet</Button>
    </div>
  );
}

function StudentsDialog({ p, onClose }) {
  const [d, setD] = useState(null);
  const load = () => api.get(`/admin/private-trainings/${p.private_id}/students`).then(({ data }) => setD(data));
  useEffect(() => { load(); }, [p.private_id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-ink-surface border-white/10 max-h-[88vh] overflow-y-auto" data-testid="private-students-dialog">
        <DialogTitle>{p.title} — Öğrenciler</DialogTitle>
        {!d ? <Loader2 className="w-5 h-5 animate-spin text-gold" /> : (
          <>
            <div className="space-y-3">{d.enrollments.length === 0 ? <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p> : d.enrollments.map((e) => <EnrollmentRow key={e.enr_id} e={e} onSaved={load} />)}</div>
            <h3 className="font-heading font-semibold text-sm mt-4 flex items-center gap-2"><BellRing className="w-4 h-4 text-gold" /> Haber Ver Listesi ({d.waitlist.filter((w) => !w.notified).length} bekleyen)</h3>
            <div className="text-sm space-y-1">{d.waitlist.map((w) => <p key={w.wl_id} className="flex justify-between bg-ink rounded-lg px-3 py-2"><span>{w.email}</span><span className="text-xs text-muted-foreground">{w.notified ? `Bildirildi · ${formatDate(w.notified_at)}` : `Bekliyor · ${formatDate(w.created_at)}`}</span></p>)}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPrivateTrainings() {
  const [list, setList] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [students, setStudents] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/private-trainings").then(({ data }) => setList(data));
  useEffect(() => { load(); api.get("/admin/instructors").then(({ data }) => setInstructors(data)).catch(() => {}); }, []);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const openEdit = async (id) => { const { data } = await api.get(`/admin/private-trainings/${id}`); setForm({ ...empty, ...data, discount_price: data.discount_price ?? "" }); setEditing(id); };
  const save = async () => {
    setBusy(true);
    const body = { ...form, price: Number(form.price) || 0, lesson_count: Number(form.lesson_count) || 1, discount_price: form.discount_price === "" ? null : Number(form.discount_price) };
    try {
      if (editing) { const { data } = await api.put(`/admin/private-trainings/${editing}`, body); toast.success(data.notified ? `Kaydedildi · ${data.notified} kişiye "kontenjan açıldı" maili gönderildi` : "Kaydedildi"); }
      else { await api.post("/admin/private-trainings", body); toast.success("Eğitim oluşturuldu"); }
      setForm(null); setEditing(null); load();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  const del = async (id) => { if (!window.confirm("Eğitim silinsin mi?")) return; try { await api.delete(`/admin/private-trainings/${id}`); load(); } catch (e) { toast.error(apiError(e)); } };
  const toggleSale = async (p) => { const { data } = await api.get(`/admin/private-trainings/${p.private_id}`); const r = await api.put(`/admin/private-trainings/${p.private_id}`, { ...data, sale_stopped: !p.sale_stopped }); toast.success(p.sale_stopped ? `Satış açıldı${r.data.notified ? ` · ${r.data.notified} kişiye mail gönderildi` : ""}` : "Satış durduruldu"); load(); };

  if (form) return (
    <div className="max-w-4xl space-y-6" data-testid="private-form">
      <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => { setForm(null); setEditing(null); }}><ArrowLeft className="w-4 h-4 mr-2" /> Geri</Button>
        <Button onClick={save} disabled={busy} className="bg-gold text-ink font-semibold" data-testid="save-private">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Kaydet</>}</Button></div>
      <section className="bg-ink-surface border border-white/5 rounded-2xl p-6 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Label>Eğitim Adı</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="Google Ads Bire Bir Canlı Eğitim" data-testid="private-title-input" /></div>
        <div className="sm:col-span-2"><Label>Kısa Açıklama</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} rows={2} data-testid="private-desc-input" /></div>
        <div><Label>Fiyat (₺)</Label><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} data-testid="private-price-input" /></div>
        <div><Label>İndirimli Fiyat (₺) <span className="text-muted-foreground font-normal">· isteğe bağlı</span></Label><Input type="number" value={form.discount_price} onChange={(e) => set("discount_price", e.target.value)} className={inputCls} data-testid="private-discount-input" /></div>
        <div><Label>Ders Sayısı</Label><Input type="number" value={form.lesson_count} onChange={(e) => set("lesson_count", e.target.value)} className={inputCls} data-testid="private-lessons-input" /></div>
        <div><Label>Ders Süresi</Label><Input value={form.lesson_duration} onChange={(e) => set("lesson_duration", e.target.value)} className={inputCls} /></div>
        <div><Label>Eğitmen</Label><select value={form.instructor_id} onChange={(e) => set("instructor_id", e.target.value)} className="w-full h-10 rounded-md bg-ink border border-white/10 px-3 text-sm mt-1.5" data-testid="private-instructor"><option value="">Seçin</option>{instructors.map((i) => <option key={i.instructor_id} value={i.instructor_id}>{i.name}</option>)}</select></div>
        <div><Label>Tanıtım Videosu (YouTube/Vimeo)</Label><Input value={form.promo_video} onChange={(e) => set("promo_video", e.target.value)} className={inputCls} /></div>
        <div className="sm:col-span-2"><Label>Kapak Görseli</Label><div className="mt-1.5"><ImageUpload value={form.image} onChange={(v) => set("image", v)} testId="private-image" /></div></div>
        <div className="sm:col-span-2"><Label>Detaylı Açıklama</Label><div className="mt-1.5"><Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gold" />}><RichTextEditor key={editing || "new"} value={form.long_description || ""} onChange={(v) => set("long_description", v)} testId="private-long-description" /></Suspense></div></div>
        <label className="flex items-center justify-between bg-ink rounded-xl p-4"><span className="text-sm font-medium">Yayında</span><Switch checked={form.is_published} onCheckedChange={(v) => set("is_published", v)} data-testid="private-published" /></label>
        <label className="flex items-center justify-between bg-ink rounded-xl p-4"><span className="text-sm font-medium">Satışı Durdur <span className="block text-[11px] text-muted-foreground font-normal">Açınca bekleyenlere mail gider</span></span><Switch checked={form.sale_stopped} onCheckedChange={(v) => set("sale_stopped", v)} data-testid="private-sale-stopped" /></label>
      </section>
      <GroupCurriculumEditor value={form.curriculum} onChange={(v) => set("curriculum", v)} />
      <CrossSellPicker value={form.cross_sell_ids} onChange={(v) => set("cross_sell_ids", v)} excludeId={editing} />
    </div>
  );

  return (
    <div data-testid="admin-private-page">
      <div className="flex items-center justify-between mb-6"><div><h1 className="font-heading font-bold text-2xl">Bire Bir Canlı Eğitimler</h1><p className="text-sm text-muted-foreground">Kontenjan yok; dolduğunda "Satışı Durdur" ile kapatın.</p></div>
        <Button onClick={() => { setForm({ ...empty, instructor_id: instructors[0]?.instructor_id || "" }); setEditing(null); }} className="bg-gold text-ink font-semibold" data-testid="new-private"><Plus className="w-4 h-4 mr-2" /> Yeni Eğitim</Button></div>
      <div className="space-y-3">
        {list.length === 0 && <p className="text-muted-foreground text-sm">Henüz bire bir eğitim yok.</p>}
        {list.map((p) => (
          <div key={p.private_id} className="bg-ink-surface border border-white/5 rounded-2xl p-4 flex flex-wrap items-center gap-4" data-testid={`admin-private-${p.private_id}`}>
            {p.image && <img src={p.image} alt="" className="w-24 h-14 rounded-lg object-cover" />}
            <div className="flex-1 min-w-[200px]"><p className="font-semibold">{p.title} {!p.is_published && <span className="text-xs text-muted-foreground">(Taslak)</span>}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatPrice(p.discount_price ?? p.price)} ₺ · {p.lesson_count} ders · {p.enrolled} öğrenci · {p.waiting} haber bekleyen</p></div>
            <label className="flex items-center gap-2 text-xs"><Switch checked={!p.sale_stopped} onCheckedChange={() => toggleSale(p)} data-testid={`sale-toggle-${p.private_id}`} /> {p.sale_stopped ? <span className="text-red-400">Satış durduruldu</span> : <span className="text-green-400">Satışta</span>}</label>
            <Button variant="outline" size="sm" className="border-white/15" onClick={() => setStudents(p)} data-testid={`private-students-${p.private_id}`}><Users className="w-4 h-4 mr-1.5" /> Öğrenciler</Button>
            <Button variant="outline" size="sm" className="border-white/15" onClick={() => openEdit(p.private_id)} data-testid={`edit-private-${p.private_id}`}><Edit className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(p.private_id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
      {students && <StudentsDialog p={students} onClose={() => { setStudents(null); load(); }} />}
    </div>
  );
}
