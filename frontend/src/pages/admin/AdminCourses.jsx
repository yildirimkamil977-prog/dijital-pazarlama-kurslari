import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import api, { formatPrice } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/admin/courses").then(({ data }) => setCourses(data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { document.title = "Yönetim - Kurslar"; load(); }, []);

  const del = async (id) => {
    try { await api.delete(`/admin/courses/${id}`); toast.success("Kurs silindi"); load(); }
    catch { toast.error("Silinemedi"); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 text-gold animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">Kurslar</h1>
        <Button onClick={() => navigate("/yonetim/kurslar/yeni")} data-testid="new-course-btn" className="bg-gold hover:bg-gold-hover text-ink font-semibold"><Plus className="w-4 h-4 mr-2" /> Yeni Kurs</Button>
      </div>

      <div className="space-y-3">
        {courses.map((c) => {
          const lessons = (c.modules || []).reduce((s, m) => s + (m.lessons?.length || 0), 0);
          return (
            <div key={c.course_id} data-testid={`admin-course-${c.course_id}`} className="flex items-center gap-4 bg-ink-surface border border-white/5 rounded-2xl p-4">
              <img src={c.thumbnail} alt={c.title} className="w-24 h-16 object-cover rounded-lg shrink-0 bg-ink-elevated" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{c.title}</h3>
                  {c.is_published ? <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-[10px]"><Eye className="w-3 h-3 mr-1" />Yayında</Badge> : <Badge className="bg-secondary text-muted-foreground text-[10px]"><EyeOff className="w-3 h-3 mr-1" />Taslak</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{c.category} · {lessons} ders · {formatPrice(c.discount_price ?? c.price)} ₺</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => navigate(`/yonetim/kurslar/${c.course_id}`)} data-testid={`edit-course-${c.course_id}`} variant="outline" size="sm" className="border-white/15"><Edit className="w-4 h-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" size="sm" data-testid={`delete-course-${c.course_id}`} className="border-white/15 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                  <AlertDialogContent className="bg-ink-surface border-white/10">
                    <AlertDialogHeader><AlertDialogTitle>Kursu sil?</AlertDialogTitle><AlertDialogDescription>"{c.title}" kalıcı olarak silinecek. Bu işlem geri alınamaz.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction onClick={() => del(c.course_id)} className="bg-destructive hover:bg-destructive/90">Sil</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
        {courses.length === 0 && <p className="text-muted-foreground text-center py-16">Henüz kurs yok. İlk kursunu oluştur.</p>}
      </div>
    </div>
  );
}
