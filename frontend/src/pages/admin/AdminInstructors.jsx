import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, User, BookOpen } from "lucide-react";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ImageUpload";
import { SocialLinks } from "@/components/SocialLinks";
import { toast } from "sonner";

const emptySocial = { instagram: "", linkedin: "", youtube: "", twitter: "", facebook: "", tiktok: "", website: "" };
const empty = { name: "", title: "", bio: "", avatar: "", social_links: { ...emptySocial } };
const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", ph: "https://instagram.com/..." },
  { key: "linkedin", label: "LinkedIn", ph: "https://linkedin.com/in/..." },
  { key: "youtube", label: "YouTube", ph: "https://youtube.com/@..." },
  { key: "twitter", label: "X (Twitter)", ph: "https://x.com/..." },
  { key: "facebook", label: "Facebook", ph: "https://facebook.com/..." },
  { key: "tiktok", label: "TikTok", ph: "https://tiktok.com/@..." },
  { key: "website", label: "Web Sitesi", ph: "https://..." },
];

export default function AdminInstructors() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); api.get("/admin/instructors").then(({ data }) => setItems(data)).catch((e) => toast.error(apiError(e))).finally(() => setLoading(false)); };
  useEffect(() => { document.title = "Yönetim - Eğitmenler"; load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty, social_links: { ...emptySocial } }); setOpen(true); };
  const openEdit = (it) => { setEditing(it); setForm({ name: it.name, title: it.title || "", bio: it.bio || "", avatar: it.avatar || "", social_links: { ...emptySocial, ...(it.social_links || {}) } }); setOpen(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSocial = (k, v) => setForm((f) => ({ ...f, social_links: { ...f.social_links, [k]: v } }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Eğitmen adı zorunlu"); return; }
    setSaving(true);
    try {
      if (editing) { await api.put(`/admin/instructors/${editing.instructor_id}`, form); toast.success("Eğitmen güncellendi"); }
      else { await api.post("/admin/instructors", form); toast.success("Eğitmen eklendi"); }
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const remove = async (it) => {
    if (!window.confirm(`"${it.name}" eğitmenini silmek istediğine emin misin? Bu eğitmene bağlı kurslardan bağlantı kaldırılır.`)) return;
    try { await api.delete(`/admin/instructors/${it.instructor_id}`); toast.success("Eğitmen silindi"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Eğitmenler</h1>
          <p className="text-sm text-muted-foreground mt-1">Eğitmen profillerini yönet; kurslara eğitmen atayabilirsin.</p>
        </div>
        <Button onClick={openNew} data-testid="add-instructor" className="bg-gold hover:bg-gold-hover text-ink font-semibold"><Plus className="w-4 h-4 mr-2" /> Eğitmen Ekle</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-ink-surface border border-white/5 rounded-2xl">
          <User className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground mt-4">Henüz eğitmen yok. "Eğitmen Ekle" ile başla.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.instructor_id} data-testid={`instructor-card-${it.instructor_id}`} className="bg-ink-surface border border-white/5 rounded-2xl p-5 flex flex-col">
              <div className="flex items-center gap-4">
                {it.avatar ? <img src={it.avatar} alt={it.name} className="w-16 h-16 rounded-full object-cover border border-white/10" /> : <span className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center"><User className="w-7 h-7 text-gold" /></span>}
                <div className="min-w-0">
                  <p className="font-heading font-semibold truncate">{it.name}</p>
                  {it.title && <p className="text-xs text-gold truncate">{it.title}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><BookOpen className="w-3 h-3" /> {it.course_count || 0} eğitim</p>
                </div>
              </div>
              {it.bio && <p className="text-sm text-muted-foreground mt-4 line-clamp-3 flex-1">{it.bio}</p>}
              <div className="mt-3"><SocialLinks links={it.social_links} /></div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                <Button onClick={() => openEdit(it)} data-testid={`edit-instructor-${it.instructor_id}`} variant="outline" size="sm" className="border-white/15 flex-1"><Pencil className="w-3.5 h-3.5 mr-1.5" /> Düzenle</Button>
                <Button onClick={() => remove(it)} data-testid={`delete-instructor-${it.instructor_id}`} variant="outline" size="sm" className="border-white/15 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-ink-surface border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Eğitmeni Düzenle" : "Yeni Eğitmen"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Ad Soyad *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} className="bg-ink border-white/10 mt-1.5" data-testid="instructor-name" /></div>
            <div><Label>Ünvan</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} className="bg-ink border-white/10 mt-1.5" placeholder="Dijital Pazarlama Uzmanı" data-testid="instructor-title" /></div>
            <div><Label>Biyografi</Label><Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} className="bg-ink border-white/10 mt-1.5" rows={5} placeholder="Eğitmenin deneyimi, uzmanlık alanları..." data-testid="instructor-bio" /></div>
            <div><Label>Profil Resmi</Label><div className="mt-1.5"><ImageUpload value={form.avatar} onChange={(v) => set("avatar", v)} testId="instructor-avatar-upload" /></div></div>
            <div className="pt-2 border-t border-white/5">
              <Label className="text-gold">Sosyal Medya Bağlantıları</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">Sadece doldurduğun bağlantılar sitede görünür.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SOCIAL_FIELDS.map((s) => (
                  <div key={s.key}>
                    <Label className="text-xs">{s.label}</Label>
                    <Input value={form.social_links[s.key]} onChange={(e) => setSocial(s.key, e.target.value)} className="bg-ink border-white/10 mt-1" placeholder={s.ph} data-testid={`instructor-social-${s.key}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/15" onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button onClick={save} disabled={saving} data-testid="save-instructor" className="bg-gold hover:bg-gold-hover text-ink font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
